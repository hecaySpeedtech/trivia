# Guía de Base de Datos — Trivia Educativa (estado real verificado)

Esquema: `app` en Supabase (PostgreSQL). RLS habilitado en todas las tablas.

## Tablas principales

- `app.docentes` (id_docente uuid PK, email, nombre, rol CHECK docente/super_admin, fecha_creacion)
- `app.pacientes` (id_paciente uuid PK, nombre, dni nullable, avatar_url, creado_por, fecha_creacion)
- `app.materias` (id_materia uuid PK, nombre, creado_por, es_publica, fecha_creacion)
- `app.preguntas` (id_pregunta uuid PK, id_materia, texto_pregunta, ciclo CHECK, unidad, media_url, media_type CHECK, creado_por, fecha_creacion)
- `app.respuestas` (id_respuesta uuid PK, id_pregunta, texto_respuesta, es_correcta, fecha_creacion)
- `app.intentos` (id_intento uuid PK, id_paciente, nombre_materia, ciclo CHECK, respuestas_correctas, respuestas_incorrectas, puntaje_total, creado_por, fecha_creacion)
- `app.intento_detalles` (id_detalle uuid PK, id_intento, id_pregunta, id_respuesta_elegida, es_correcta, tiempo_respuesta_segundos, fecha_creacion)
- `app.dibujos` (id_dibujo uuid PK, id_paciente, imagen_url, fecha_creacion)
- `app.logros` (id_logro uuid PK, nombre UNIQUE, descripcion, imagen_url, fecha_creacion)
- `app.paciente_logros` (id_paciente_logro uuid PK, id_paciente, id_logro, fecha_obtencion; UNIQUE(id_paciente,id_logro))
- `app.ajustes` (id_docente PK, max_preguntas default 10)
- `app.estado_unidades` (id_estado uuid PK, id_materia, ciclo, unidad, habilitada, id_docente)
- `app.cycles` (id serial PK, name UNIQUE CHECK Primer/Segundo Ciclo)
- `app.levels` (id serial PK, subject_id uuid FK materias, cycle_id int FK cycles, level_no CHECK 1-3)

## Seguridad y advisors

- Roles reales en `app.docentes.rol`.
- `app.is_super_admin()` migrado a `private.is_super_admin()` (esquema privado) en migración `005_cierre_advisors_final.sql`.
- Políticas RLS multi-docente (migraciones 001-005).
- `pg_graphql` deshabilitada (no se usa GraphQL en el frontend).
- `dni` nullable; no se generan DNI aleatorios.

## Migraciones

- `001_docentes_roles_y_permisos.sql`
- `002_rls_aislamiento_multidocente.sql`
- `003_esquema_tesis_e_indices.sql`
- `004_fix_multiple_permissive_policies.sql`
- `005_cierre_advisors_final.sql`

## Advisors post-005 (verificado)

- Security: únicamente `auth_leaked_password_protection` (WARN, requiere plan Pro para activar).
- Performance: únicamente `unused_index` (INFO, 14 índices sin uso aún; no es error).
- Eliminados: `multiple_permissive_policies` (3 tablas), `authenticated_security_definer_function_executable` (`app.is_super_admin`), `pg_graphql_authenticated_table_exposed` (14 tablas).