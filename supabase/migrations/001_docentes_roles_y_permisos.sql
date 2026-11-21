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
ALTER DEFAULT PRIVILEGES IN SCHEMA app GRANT USAGE, SELECT ON SEQUENCES TO authenticated;