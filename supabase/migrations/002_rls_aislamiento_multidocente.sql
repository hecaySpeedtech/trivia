-- 002_rls_aislamiento_multidocente.sql
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
  WITH CHECK (id_docente = (SELECT auth.uid()) OR app.is_super_admin());