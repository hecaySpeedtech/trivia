-- 003_esquema_tesis_e_indices.sql
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
  FOR t IN SELECT unnest(ARRAY['pacientes','materias','preguntas','respuestas','intentos','intento_detalles','dibujos','logros','docentes']) LOOP
    EXECUTE format('UPDATE app.%I SET fecha_creacion = now() WHERE fecha_creacion IS NULL', t);
    EXECUTE format('ALTER TABLE app.%I ALTER COLUMN fecha_creacion SET DEFAULT now()', t);
    EXECUTE format('ALTER TABLE app.%I ALTER COLUMN fecha_creacion SET NOT NULL', t);
  END LOOP;
END $$;

-- 3b. fecha_obtencion en paciente_logros
UPDATE app.paciente_logros SET fecha_obtencion = now() WHERE fecha_obtencion IS NULL;
ALTER TABLE app.paciente_logros ALTER COLUMN fecha_obtencion SET DEFAULT now();
ALTER TABLE app.paciente_logros ALTER COLUMN fecha_obtencion SET NOT NULL;

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

-- Grants explicitos para levels (creada despues de 001)
GRANT SELECT, INSERT, UPDATE, DELETE ON app.levels TO authenticated;
GRANT USAGE, SELECT ON SEQUENCE app.levels_id_seq TO authenticated;

-- RLS para levels (lectura authenticated)
ALTER TABLE app.levels ENABLE ROW LEVEL SECURITY;
-- politicas ya creadas en migracion 002; recrear por seguridad
DROP POLICY IF EXISTS "levels_select_all" ON app.levels;
DROP POLICY IF EXISTS "levels_admin_write" ON app.levels;
DROP POLICY IF EXISTS "levels_admin_insert" ON app.levels;
DROP POLICY IF EXISTS "levels_admin_update" ON app.levels;
DROP POLICY IF EXISTS "levels_admin_delete" ON app.levels;
CREATE POLICY "levels_select_all" ON app.levels FOR SELECT TO authenticated USING (true);
CREATE POLICY "levels_admin_insert" ON app.levels FOR INSERT TO authenticated WITH CHECK (app.is_super_admin());
CREATE POLICY "levels_admin_update" ON app.levels FOR UPDATE TO authenticated USING (app.is_super_admin()) WITH CHECK (app.is_super_admin());
CREATE POLICY "levels_admin_delete" ON app.levels FOR DELETE TO authenticated USING (app.is_super_admin());

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