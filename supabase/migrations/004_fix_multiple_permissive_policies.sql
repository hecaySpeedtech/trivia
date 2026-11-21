-- 004_fix_multiple_permissive_policies.sql
-- Elimina las politicas FOR ALL (que incluyen SELECT) en catalogos de solo lectura
-- para evitar multiple_permissive_policies (performance WARN).

DO $$
DECLARE pol text;
BEGIN
  FOR pol IN SELECT unnest(ARRAY['cycles_admin_write','levels_admin_write','logros_admin_write']) LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON app.cycles', pol);
  END LOOP;
END $$;

-- cycles
DROP POLICY IF EXISTS "cycles_admin_write" ON app.cycles;
DROP POLICY IF EXISTS "cycles_admin_insert" ON app.cycles;
DROP POLICY IF EXISTS "cycles_admin_update" ON app.cycles;
DROP POLICY IF EXISTS "cycles_admin_delete" ON app.cycles;
CREATE POLICY "cycles_admin_insert" ON app.cycles FOR INSERT TO authenticated WITH CHECK (app.is_super_admin());
CREATE POLICY "cycles_admin_update" ON app.cycles FOR UPDATE TO authenticated USING (app.is_super_admin()) WITH CHECK (app.is_super_admin());
CREATE POLICY "cycles_admin_delete" ON app.cycles FOR DELETE TO authenticated USING (app.is_super_admin());

-- levels
DROP POLICY IF EXISTS "levels_admin_write" ON app.levels;
DROP POLICY IF EXISTS "levels_admin_insert" ON app.levels;
DROP POLICY IF EXISTS "levels_admin_update" ON app.levels;
DROP POLICY IF EXISTS "levels_admin_delete" ON app.levels;
CREATE POLICY "levels_admin_insert" ON app.levels FOR INSERT TO authenticated WITH CHECK (app.is_super_admin());
CREATE POLICY "levels_admin_update" ON app.levels FOR UPDATE TO authenticated USING (app.is_super_admin()) WITH CHECK (app.is_super_admin());
CREATE POLICY "levels_admin_delete" ON app.levels FOR DELETE TO authenticated USING (app.is_super_admin());

-- logros
DROP POLICY IF EXISTS "logros_admin_write" ON app.logros;
DROP POLICY IF EXISTS "logros_admin_insert" ON app.logros;
DROP POLICY IF EXISTS "logros_admin_update" ON app.logros;
DROP POLICY IF EXISTS "logros_admin_delete" ON app.logros;
CREATE POLICY "logros_admin_insert" ON app.logros FOR INSERT TO authenticated WITH CHECK (app.is_super_admin());
CREATE POLICY "logros_admin_update" ON app.logros FOR UPDATE TO authenticated USING (app.is_super_admin()) WITH CHECK (app.is_super_admin());
CREATE POLICY "logros_admin_delete" ON app.logros FOR DELETE TO authenticated USING (app.is_super_admin());