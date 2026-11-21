-- 001_docentes_roles_y_permisos.sql
-- Blindaje de docentes, roles reales y cierre de RPC peligrosa.

-- 1. Agregar columna rol en app.docentes
ALTER TABLE app.docentes
  ADD COLUMN IF NOT EXISTS rol text NOT NULL DEFAULT 'docente';

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'docentes_rol_check' AND conrelid = 'app.docentes'::regclass
  ) THEN
    ALTER TABLE app.docentes
      ADD CONSTRAINT docentes_rol_check CHECK (rol IN ('docente', 'super_admin'));
  END IF;
END $$;

-- 2. Backfill: usuarios de auth.users sin fila en app.docentes
INSERT INTO app.docentes (id_docente, email, nombre, rol)
SELECT u.id,
       u.email,
       COALESCE(NULLIF(u.raw_user_meta_data->>'full_name', ''), split_part(u.email, '@', 1)),
       'docente'
FROM auth.users u
LEFT JOIN app.docentes d ON d.id_docente = u.id
WHERE d.id_docente IS NULL
ON CONFLICT (id_docente) DO NOTHING;

-- 3. Rellenar nombre donde sea NULL
UPDATE app.docentes
SET nombre = COALESCE(NULLIF(nombre, ''), split_part(email, '@', 1))
WHERE nombre IS NULL OR nombre = '';

-- 4. Setear super_admin para admin@trivia.com
UPDATE app.docentes
SET rol = 'super_admin'
WHERE lower(email) = 'admin@trivia.com';

-- 5. Actualizar trigger handle_new_docente
CREATE OR REPLACE FUNCTION public.handle_new_docente()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'app'
AS $function$
BEGIN
  INSERT INTO app.docentes (id_docente, email, nombre, rol)
  VALUES (
    new.id,
    new.email,
    COALESCE(NULLIF(new.raw_user_meta_data->>'full_name', ''), split_part(new.email, '@', 1)),
    'docente'
  )
  ON CONFLICT (id_docente) DO NOTHING;
  RETURN new;
END;
$function$;

-- 6. Cerrar vulnerabilidad RPC (advisors 0028 y 0029)
REVOKE EXECUTE ON FUNCTION public.handle_new_docente() FROM PUBLIC, anon, authenticated;

-- 7. Funcion segura is_super_admin
CREATE OR REPLACE FUNCTION app.is_super_admin()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'app', 'public'
AS $$
  SELECT EXISTS (SELECT 1 FROM app.docentes WHERE id_docente = auth.uid() AND rol = 'super_admin');
$$;

REVOKE ALL ON FUNCTION app.is_super_admin() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION app.is_super_admin() TO authenticated;

-- 8. Corregir GRANTs del esquema app
GRANT USAGE ON SCHEMA app TO service_role;
GRANT ALL ON ALL TABLES IN SCHEMA app TO service_role;
GRANT ALL ON ALL SEQUENCES IN SCHEMA app TO service_role;

REVOKE ALL ON ALL TABLES IN SCHEMA app FROM anon;
REVOKE ALL ON ALL SEQUENCES IN SCHEMA app FROM anon;
REVOKE USAGE ON SCHEMA app FROM anon;

REVOKE ALL ON ALL TABLES IN SCHEMA app FROM authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA app TO authenticated;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA app TO authenticated;

-- Default privileges
ALTER DEFAULT PRIVILEGES IN SCHEMA app REVOKE ALL ON TABLES FROM anon;
ALTER DEFAULT PRIVILEGES IN SCHEMA app REVOKE ALL ON SEQUENCES FROM anon;
ALTER DEFAULT PRIVILEGES IN SCHEMA app GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO authenticated;
ALTER DEFAULT PRIVILEGES IN SCHEMA app GRANT USAGE, SELECT ON SEQUENCES TO authenticated;-- 002_rls_aislamiento_multidocente.sql
-- Politicas RLS estrictas multi-docente.

-- Helper: drop all old permissive policies
DO $$
DECLARE
  t text;
  pol text;
BEGIN
  FOR t IN SELECT unnest(ARRAY['dibujos','intento_detalles','intentos','logros','materias','paciente_logros','pacientes','preguntas','respuestas']) LOOP
    FOR pol IN SELECT policyname FROM pg_policies WHERE schemaname='app' AND tablename=t LOOP
      EXECUTE format('DROP POLICY IF EXISTS %I ON app.%I', pol, t);
    END LOOP;
  END LOOP;
  -- docentes, cycles, levels, ajustes, estado_unidades
  FOR t IN SELECT unnest(ARRAY['docentes','cycles','levels','ajustes','estado_unidades']) LOOP
    FOR pol IN SELECT policyname FROM pg_policies WHERE schemaname='app' AND tablename=t LOOP
      EXECUTE format('DROP POLICY IF EXISTS %I ON app.%I', pol, t);
    END LOOP;
  END LOOP;
END $$;

-- app.docentes
CREATE POLICY "docentes_select_own_or_admin" ON app.docentes
  FOR SELECT TO authenticated
  USING (id_docente = (SELECT auth.uid()) OR app.is_super_admin());
CREATE POLICY "docentes_update_own_keep_role" ON app.docentes
  FOR UPDATE TO authenticated
  USING (id_docente = (SELECT auth.uid()))
  WITH CHECK (id_docente = (SELECT auth.uid()) AND rol = (SELECT d.rol FROM app.docentes d WHERE d.id_docente = (SELECT auth.uid())));

-- Catalogos de solo lectura: cycles, levels, logros
CREATE POLICY "cycles_select_all" ON app.cycles
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "cycles_admin_write" ON app.cycles
  FOR ALL TO authenticated
  USING (app.is_super_admin()) WITH CHECK (app.is_super_admin());

CREATE POLICY "levels_select_all" ON app.levels
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "levels_admin_write" ON app.levels
  FOR ALL TO authenticated
  USING (app.is_super_admin()) WITH CHECK (app.is_super_admin());

CREATE POLICY "logros_select_all" ON app.logros
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "logros_admin_write" ON app.logros
  FOR ALL TO authenticated
  USING (app.is_super_admin()) WITH CHECK (app.is_super_admin());

-- app.pacientes
CREATE POLICY "pacientes_all_own_or_admin" ON app.pacientes
  FOR ALL TO authenticated
  USING (creado_por = (SELECT auth.uid()) OR app.is_super_admin())
  WITH CHECK (creado_por = (SELECT auth.uid()) OR app.is_super_admin());

-- app.materias
CREATE POLICY "materias_select" ON app.materias
  FOR SELECT TO authenticated
  USING (es_publica = true OR creado_por = (SELECT auth.uid()) OR app.is_super_admin());
CREATE POLICY "materias_insert_own" ON app.materias
  FOR INSERT TO authenticated
  WITH CHECK (creado_por = (SELECT auth.uid()));
CREATE POLICY "materias_update_own_or_admin" ON app.materias
  FOR UPDATE TO authenticated
  USING (creado_por = (SELECT auth.uid()) OR app.is_super_admin())
  WITH CHECK (creado_por = (SELECT auth.uid()) OR app.is_super_admin());
CREATE POLICY "materias_delete_own_or_admin" ON app.materias
  FOR DELETE TO authenticated
  USING (creado_por = (SELECT auth.uid()) OR app.is_super_admin());

-- app.preguntas
CREATE POLICY "preguntas_select" ON app.preguntas
  FOR SELECT TO authenticated
  USING (
    creado_por = (SELECT auth.uid())
    OR app.is_super_admin()
    OR EXISTS (SELECT 1 FROM app.materias m WHERE m.id_materia = preguntas.id_materia AND m.es_publica = true)
  );
CREATE POLICY "preguntas_insert_own" ON app.preguntas
  FOR INSERT TO authenticated
  WITH CHECK (creado_por = (SELECT auth.uid()));
CREATE POLICY "preguntas_update_own_or_admin" ON app.preguntas
  FOR UPDATE TO authenticated
  USING (creado_por = (SELECT auth.uid()) OR app.is_super_admin())
  WITH CHECK (creado_por = (SELECT auth.uid()) OR app.is_super_admin());
CREATE POLICY "preguntas_delete_own_or_admin" ON app.preguntas
  FOR DELETE TO authenticated
  USING (creado_por = (SELECT auth.uid()) OR app.is_super_admin());

-- app.respuestas
CREATE POLICY "respuestas_select" ON app.respuestas
  FOR SELECT TO authenticated
  USING (
    EXISTS (SELECT 1 FROM app.preguntas p WHERE p.id_pregunta = respuestas.id_pregunta AND (
      p.creado_por = (SELECT auth.uid()) OR app.is_super_admin()
      OR EXISTS (SELECT 1 FROM app.materias m WHERE m.id_materia = p.id_materia AND m.es_publica = true)
    ))
  );
CREATE POLICY "respuestas_insert" ON app.respuestas
  FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (SELECT 1 FROM app.preguntas p WHERE p.id_pregunta = respuestas.id_pregunta AND (
      p.creado_por = (SELECT auth.uid()) OR app.is_super_admin()
    ))
  );
CREATE POLICY "respuestas_update" ON app.respuestas
  FOR UPDATE TO authenticated
  USING (
    EXISTS (SELECT 1 FROM app.preguntas p WHERE p.id_pregunta = respuestas.id_pregunta AND (
      p.creado_por = (SELECT auth.uid()) OR app.is_super_admin()
    ))
  )
  WITH CHECK (
    EXISTS (SELECT 1 FROM app.preguntas p WHERE p.id_pregunta = respuestas.id_pregunta AND (
      p.creado_por = (SELECT auth.uid()) OR app.is_super_admin()
    ))
  );
CREATE POLICY "respuestas_delete" ON app.respuestas
  FOR DELETE TO authenticated
  USING (
    EXISTS (SELECT 1 FROM app.preguntas p WHERE p.id_pregunta = respuestas.id_pregunta AND (
      p.creado_por = (SELECT auth.uid()) OR app.is_super_admin()
    ))
  );

-- app.intentos
CREATE POLICY "intentos_all_own_or_admin" ON app.intentos
  FOR ALL TO authenticated
  USING (creado_por = (SELECT auth.uid()) OR app.is_super_admin())
  WITH CHECK (creado_por = (SELECT auth.uid()) OR app.is_super_admin());

-- app.intento_detalles
CREATE POLICY "intento_detalles_all" ON app.intento_detalles
  FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM app.intentos i WHERE i.id_intento = intento_detalles.id_intento AND (i.creado_por = (SELECT auth.uid()) OR app.is_super_admin())))
  WITH CHECK (EXISTS (SELECT 1 FROM app.intentos i WHERE i.id_intento = intento_detalles.id_intento AND (i.creado_por = (SELECT auth.uid()) OR app.is_super_admin())));

-- app.dibujos
CREATE POLICY "dibujos_all" ON app.dibujos
  FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM app.pacientes p WHERE p.id_paciente = dibujos.id_paciente AND (p.creado_por = (SELECT auth.uid()) OR app.is_super_admin())))
  WITH CHECK (EXISTS (SELECT 1 FROM app.pacientes p WHERE p.id_paciente = dibujos.id_paciente AND (p.creado_por = (SELECT auth.uid()) OR app.is_super_admin())));

-- app.paciente_logros
CREATE POLICY "paciente_logros_all" ON app.paciente_logros
  FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM app.pacientes p WHERE p.id_paciente = paciente_logros.id_paciente AND (p.creado_por = (SELECT auth.uid()) OR app.is_super_admin())))
  WITH CHECK (EXISTS (SELECT 1 FROM app.pacientes p WHERE p.id_paciente = paciente_logros.id_paciente AND (p.creado_por = (SELECT auth.uid()) OR app.is_super_admin())));

-- ajustes y estado_unidades (mantener estrictos)
-- (recrear por si acaso)
CREATE POLICY "ajustes_all_own" ON app.ajustes
  FOR ALL TO authenticated
  USING (id_docente = (SELECT auth.uid()))
  WITH CHECK (id_docente = (SELECT auth.uid()));

CREATE POLICY "estado_unidades_all_own" ON app.estado_unidades
  FOR ALL TO authenticated
  USING (id_docente = (SELECT auth.uid()) OR app.is_super_admin())
  WITH CHECK (id_docente = (SELECT auth.uid()) OR app.is_super_admin());-- 003_esquema_tesis_e_indices.sql
-- Esquema alineado a la tesis, integridad e indices.

-- 1. RF02: pacientes.dni nullable
ALTER TABLE app.pacientes ALTER COLUMN dni DROP NOT NULL;
UPDATE app.pacientes SET dni = NULL; -- sanea DNIs falsos aleatorios

-- 2. DEFAULT auth.uid() en creado_por
ALTER TABLE app.pacientes ALTER COLUMN creado_por SET DEFAULT auth.uid();
ALTER TABLE app.materias ALTER COLUMN creado_por SET DEFAULT auth.uid();
ALTER TABLE app.preguntas ALTER COLUMN creado_por SET DEFAULT auth.uid();
ALTER TABLE app.intentos ALTER COLUMN creado_por SET DEFAULT auth.uid();

-- Backfill creado_por NULL en materias (asignar al primer super_admin/docente)
UPDATE app.materias SET creado_por = (SELECT id_docente FROM app.docentes ORDER BY fecha_creacion LIMIT 1) WHERE creado_por IS NULL;
UPDATE app.preguntas SET creado_por = (SELECT id_docente FROM app.docentes ORDER BY fecha_creacion LIMIT 1) WHERE creado_por IS NULL;
UPDATE app.intentos SET creado_por = (SELECT id_docente FROM app.docentes ORDER BY fecha_creacion LIMIT 1) WHERE creado_por IS NULL;
UPDATE app.pacientes SET creado_por = (SELECT id_docente FROM app.docentes ORDER BY fecha_creacion LIMIT 1) WHERE creado_por IS NULL;

-- 3. fecha_creacion NOT NULL DEFAULT now()
DO $$
DECLARE t text;
BEGIN
  FOR t IN SELECT unnest(ARRAY['pacientes','materias','preguntas','respuestas','intentos','intento_detalles','dibujos','logros','paciente_logros','docentes']) LOOP
    EXECUTE format('UPDATE app.%I SET fecha_creacion = now() WHERE fecha_creacion IS NULL', t);
    EXECUTE format('ALTER TABLE app.%I ALTER COLUMN fecha_creacion SET DEFAULT now()', t);
    EXECUTE format('ALTER TABLE app.%I ALTER COLUMN fecha_creacion SET NOT NULL', t);
  END LOOP;
END $$;

-- 4. CHECK ciclo en preguntas e intentos
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='preguntas_ciclo_check') THEN
    ALTER TABLE app.preguntas ADD CONSTRAINT preguntas_ciclo_check CHECK (ciclo IN ('Primer Ciclo','Segundo Ciclo'));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='intentos_ciclo_check') THEN
    ALTER TABLE app.intentos ADD CONSTRAINT intentos_ciclo_check CHECK (ciclo IN ('Primer Ciclo','Segundo Ciclo'));
  END IF;
END $$;

-- 5. Unica respuesta correcta por pregunta
CREATE UNIQUE INDEX IF NOT EXISTS uq_respuestas_una_correcta ON app.respuestas (id_pregunta) WHERE es_correcta = true;

-- 6. UNIQUE nombre en logros; UNIQUE (id_paciente, id_logro) en paciente_logros
-- deduplicar paciente_logros antes
DELETE FROM app.paciente_logros a USING app.paciente_logros b
WHERE a.ctid < b.ctid AND a.id_paciente = b.id_paciente AND a.id_logro = b.id_logro;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='logros_nombre_key') THEN
    ALTER TABLE app.logros ADD CONSTRAINT logros_nombre_key UNIQUE (nombre);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='paciente_logros_paciente_logro_key') THEN
    ALTER TABLE app.paciente_logros ADD CONSTRAINT paciente_logros_paciente_logro_key UNIQUE (id_paciente, id_logro);
  END IF;
END $$;

-- 7. Renombrar dibujos.imagen_b64 -> imagen_url
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='app' AND table_name='dibujos' AND column_name='imagen_b64') THEN
    ALTER TABLE app.dibujos RENAME COLUMN imagen_b64 TO imagen_url;
  END IF;
END $$;

-- 8. Recrear app.levels con subject_id uuid FK a materias
-- (datos falsos, se regeneran)
DROP TABLE IF EXISTS app.levels CASCADE;
CREATE TABLE app.levels (
  id serial PRIMARY KEY,
  subject_id uuid NOT NULL REFERENCES app.materias(id_materia) ON DELETE CASCADE,
  cycle_id integer NOT NULL REFERENCES app.cycles(id) ON DELETE CASCADE,
  level_no integer NOT NULL CHECK (level_no BETWEEN 1 AND 3),
  UNIQUE (subject_id, cycle_id, level_no)
);

-- Poplar niveles 1,2,3 para cada materia x ciclo
INSERT INTO app.levels (subject_id, cycle_id, level_no)
SELECT m.id_materia, c.id, l
FROM app.materias m
CROSS JOIN app.cycles c
CROSS JOIN (SELECT 1 AS l UNION ALL SELECT 2 UNION ALL SELECT 3) ls
ON CONFLICT DO NOTHING;

-- RLS para levels (lectura authenticated)
ALTER TABLE app.levels ENABLE ROW LEVEL SECURITY;
-- politicas ya creadas en migracion 002; recrear por seguridad
DROP POLICY IF EXISTS "levels_select_all" ON app.levels;
DROP POLICY IF EXISTS "levels_admin_write" ON app.levels;
CREATE POLICY "levels_select_all" ON app.levels FOR SELECT TO authenticated USING (true);
CREATE POLICY "levels_admin_write" ON app.levels FOR ALL TO authenticated USING (app.is_super_admin()) WITH CHECK (app.is_super_admin());

-- 9. Indices de FKs (15) + compuesto preguntas
CREATE INDEX IF NOT EXISTS idx_dibujos_id_paciente ON app.dibujos (id_paciente);
CREATE INDEX IF NOT EXISTS idx_estado_unidades_id_docente ON app.estado_unidades (id_docente);
CREATE INDEX IF NOT EXISTS idx_intento_detalles_id_intento ON app.intento_detalles (id_intento);
CREATE INDEX IF NOT EXISTS idx_intento_detalles_id_pregunta ON app.intento_detalles (id_pregunta);
CREATE INDEX IF NOT EXISTS idx_intento_detalles_id_respuesta ON app.intento_detalles (id_respuesta_elegida);
CREATE INDEX IF NOT EXISTS idx_intentos_creado_por ON app.intentos (creado_por);
CREATE INDEX IF NOT EXISTS idx_intentos_id_paciente ON app.intentos (id_paciente);
CREATE INDEX IF NOT EXISTS idx_levels_cycle_id ON app.levels (cycle_id);
CREATE INDEX IF NOT EXISTS idx_materias_creado_por ON app.materias (creado_por);
CREATE INDEX IF NOT EXISTS idx_paciente_logros_id_logro ON app.paciente_logros (id_logro);
CREATE INDEX IF NOT EXISTS idx_paciente_logros_id_paciente ON app.paciente_logros (id_paciente);
CREATE INDEX IF NOT EXISTS idx_pacientes_creado_por ON app.pacientes (creado_por);
CREATE INDEX IF NOT EXISTS idx_preguntas_creado_por ON app.preguntas (creado_por);
CREATE INDEX IF NOT EXISTS idx_preguntas_id_materia ON app.preguntas (id_materia);
CREATE INDEX IF NOT EXISTS idx_respuestas_id_pregunta ON app.respuestas (id_pregunta);

CREATE INDEX IF NOT EXISTS idx_preguntas_materia_ciclo_unidad ON app.preguntas (id_materia, ciclo, unidad);

-- 10. ANALYZE sobre las 14 tablas
ANALYZE app.ajustes;
ANALYZE app.cycles;
ANALYZE app.dibujos;
ANALYZE app.docentes;
ANALYZE app.estado_unidades;
ANALYZE app.intento_detalles;
ANALYZE app.intentos;
ANALYZE app.levels;
ANALYZE app.logros;
ANALYZE app.materias;
ANALYZE app.paciente_logros;
ANALYZE app.pacientes;
ANALYZE app.preguntas;
ANALYZE app.respuestas;