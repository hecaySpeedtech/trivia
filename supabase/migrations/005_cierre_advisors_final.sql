-- 005_cierre_advisors_final.sql
-- Cierre final de advisors de seguridad y performance (idempotente).

BEGIN;

-- 1) Eliminar avisos multiple_permissive_policies en cycles, levels, logros
--    (eliminar la politica FOR ALL del admin; quedan SELECT + INSERT/UPDATE/DELETE separadas)
DROP POLICY IF EXISTS "cycles_write_admin" ON app.cycles;
DROP POLICY IF EXISTS "levels_write_admin" ON app.levels;
DROP POLICY IF EXISTS "logros_write_admin" ON app.logros;

-- 2) Mover is_super_admin() al esquema privado
CREATE SCHEMA IF NOT EXISTS private;

CREATE OR REPLACE FUNCTION private.is_super_admin()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'app', 'public'
AS $$
  SELECT EXISTS (SELECT 1 FROM app.docentes WHERE id_docente = auth.uid() AND rol = 'super_admin');
$$;

REVOKE ALL ON SCHEMA private FROM PUBLIC, anon;
GRANT USAGE ON SCHEMA private TO authenticated, service_role;

REVOKE ALL ON FUNCTION private.is_super_admin() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION private.is_super_admin() TO authenticated, service_role;

-- Actualizar todas las politicas RLS de app que llaman a app.is_super_admin()
DO $$
DECLARE
  r record;
  roles_sql text;
  stmt text;
BEGIN
  FOR r IN
    SELECT schemaname, tablename, policyname, cmd, roles, qual, with_check
    FROM pg_policies
    WHERE schemaname = 'app'
      AND (qual ILIKE '%app.is_super_admin()%' OR with_check ILIKE '%app.is_super_admin()%')
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON %I.%I', r.policyname, r.schemaname, r.tablename);

    SELECT COALESCE(string_agg(quote_ident(x), ', '), 'authenticated') INTO roles_sql
    FROM unnest(r.roles) AS x;

    stmt := 'CREATE POLICY ' || quote_ident(r.policyname)
         || ' ON ' || quote_ident(r.schemaname) || '.' || quote_ident(r.tablename)
         || ' FOR ' || r.cmd
         || ' TO ' || roles_sql;

    IF r.qual IS NOT NULL THEN
      stmt := stmt || ' USING (' || replace(r.qual, 'app.is_super_admin()', 'private.is_super_admin()') || ')';
    END IF;
    IF r.with_check IS NOT NULL THEN
      stmt := stmt || ' WITH CHECK (' || replace(r.with_check, 'app.is_super_admin()', 'private.is_super_admin()') || ')';
    END IF;

    EXECUTE stmt;
  END LOOP;
END $$;

-- Eliminar la funcion expuesta en app
DROP FUNCTION IF EXISTS app.is_super_admin();

COMMIT;

-- 3) Cerrar avisos pg_graphql_authenticated_table_exposed (WARN 0027)
-- El proyecto React no usa GraphQL (verificado en src/). Deshabilitar la extension.
-- Si el Dashboard lo requiere, tambien puede apagarse desde Database -> Extensions.
DROP EXTENSION IF EXISTS pg_graphql CASCADE;