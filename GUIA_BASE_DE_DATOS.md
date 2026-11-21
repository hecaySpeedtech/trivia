# Guía de Base de Datos y Auditoría Técnica — `trivia-educativa-v6`

> **Actualización 2026-11-21 (verificado en producción):** Las migraciones de blindaje (001 docentes/roles, 002 RLS multi-docente, 003 esquema/índices, 004 fix multiple permissive policies) están versionadas en `supabase/migrations/` y consolidadas en `supabase/APLICAR_TODO_EN_SUPABASE.sql`. Aplicadas vía SQL Editor con éxito.
>
> **Conteos verificados (COUNT(*) real):** app.ajustes=1, cycles=2, dibujos=3, docentes=13, estado_unidades=6, intento_detalles=0, intentos=15, levels=18 (0 FK inválidas a materias), logros=3, materias=3, paciente_logros=5, pacientes=3, preguntas=121, respuestas=484, auth.users=13.
>
> **Advisors (security) DESPUÉS:** eliminados `rls_enabled_no_policy` (0), `anon_security_definer_function_executable` (0), `pg_graphql_anon_table_exposed` (0). Restantes por diseño: `pg_graphql_authenticated_table_exposed` (14, authenticated requiere SELECT), `authenticated_security_definer_function_executable` (1, is_super_admin intencional), `auth_leaked_password_protection` (1, función paga Pro, no activada). `multiple_permissive_policies` (3) se elimina aplicando `004_fix_multiple_permissive_policies.sql` (incluido en el consolidado).
>
> **Advisors (performance) DESPUÉS:** eliminado `unindexed_foreign_keys` (0). Restantes: `unused_index` (16, INFO, BD recién migrada sin tráfico) y `multiple_permissive_policies` (3, se elimina con 004).
>
> La guía siguiente describe el estado original auditado.

> Documento generado íntegramente a partir de consultas reales ejecutadas contra el proyecto Supabase `gddpceumixxwrbejgotd` a través del MCP oficial en **modo solo lectura** (`read_only=true`). No se ejecutó ningún `INSERT`, `UPDATE`, `DELETE`, `ALTER`, `DROP` ni otra sentencia de escritura. No se modificó ningún archivo de código fuente.
>
> Cruce realizado contra `GUIA_ARQUITECTURA.md` y `src/services/supabase.js`.
>
> **Privacidad:** para las tablas con personas (`auth.users`, `app.docentes`, `app.pacientes`, `app.intentos`, `app.dibujos`, `app.paciente_logros`) solo se muestran conteos y estadísticas agregadas. Se listan textualmente únicamente las tablas de catálogo/configuración (`app.logros`, `app.cycles`, `app.levels`, `app.materias`, `app.ajustes`, `app.estado_unidades`).

---

## 1. Verificación de Conexión y Misterio de las "0 Filas"

### 1.1 Identidad del rol con el que corre el MCP

Consulta ejecutada exactamente:

```sql
SELECT current_user, current_role, session_user;
```

Resultado real:

| current_user | current_role | session_user |
|---|---|---|
| `supabase_read_only_user` | `supabase_read_only_user` | `supabase_read_only_user` |

Contexto adicional (consultas reales):

```sql
SELECT current_database() AS db, current_setting('row_security') AS row_security, current_setting('server_version') AS server_version;
-- db=postgres | row_security=on | server_version=17.6
```

```sql
SELECT r.rolname, r.rolsuper, r.rolbypassrls, r.rolcanlogin, r.rolcreatedb, r.rolcreaterole
FROM pg_roles r
WHERE r.rolname IN (current_user, 'anon', 'authenticated', 'service_role', 'postgres', 'supabase_auth_admin');
```

| rol | rolsuper | rolbypassrls | rolcanlogin | rolcreatedb | rolcreaterole |
|---|---|---|---|---|---|
| `anon` | false | **false** | false | false | false |
| `authenticated` | false | **false** | false | false | false |
| `postgres` | false | **true** | true | true | true |
| `service_role` | false | **true** | false | false | false |
| `supabase_auth_admin` | false | false | true | false | true |
| `supabase_read_only_user` | false | **true** | true | false | false |

**Conclusión de conexión:** el MCP corre con un rol de solo lectura **que tiene `BYPASSRLS`**. Por lo tanto:

- Las consultas de esta auditoria ven **todas las filas reales**, sin que RLS filtre nada (`row_security=on` está activo a nivel de sesión, pero `rolbypassrls=true` lo neutraliza para este rol).
- En cambio, los roles que usa la app (`anon` y `authenticated`) **no** tienen `BYPASSRLS`: para ellos RLS sí se aplica (ver sección 4).
- El hecho de que el rol sea `supabase_read_only_user` confirma a nivel de base de datos que la conexión configurada en `opencode.json` con `read_only=true` está siendo respetada.

### 1.2 Conteos reales (`COUNT(*)`) — resolución del misterio

Consulta ejecutada (UNION de 14 `COUNT(*)` reales):

```sql
SELECT 'app.cycles' AS tabla, COUNT(*) AS filas FROM app.cycles
UNION ALL SELECT 'app.levels', COUNT(*) FROM app.levels
... (las 14 tablas) ...
ORDER BY tabla;
```

| Tabla | `COUNT(*)` real | Lo que informó `list_tables` |
|---|---:|---:|
| `app.ajustes` | **1** | 0 |
| `app.cycles` | **2** | 0 |
| `app.dibujos` | **3** | 0 |
| `app.docentes` | **3** | 0 |
| `app.estado_unidades` | **6** | 0 |
| `app.intento_detalles` | **0** | 0 |
| `app.intentos` | **15** | 0 |
| `app.levels` | **18** | 0 |
| `app.logros` | **3** | 0 |
| `app.materias` | **3** | 0 |
| `app.paciente_logros` | **5** | 0 |
| `app.pacientes` | **3** | 0 |
| `app.preguntas` | **121** | 0 |
| `app.respuestas` | **484** | 0 |
| `auth.users` | **13** | (no listada) |

**Diagnóstico conclusivo:** las tablas **NO están vacías**. `list_tables` informó 0 filas porque se basa en estadísticas del catálogo, no en conteos reales. La evidencia:

```sql
SELECT c.relname, c.reltuples::bigint AS reltuples_estimado, s.n_live_tup AS n_live_tup
FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
LEFT JOIN pg_stat_user_tables s ON s.relid=c.oid
WHERE n.nspname='app' AND c.relkind IN ('r','p') ORDER BY c.relname;
```

| tabla | reltuples_estimado | n_live_tup | COUNT(*) real |
|---|---:|---:|---:|
| ajustes | -1 | 0 | 1 |
| cycles | -1 | 0 | 2 |
| dibujos | -1 | 0 | 3 |
| docentes | -1 | 0 | 3 |
| estado_unidades | -1 | 0 | 6 |
| intento_detalles | -1 | 0 | 0 |
| intentos | -1 | 0 | 15 |
| levels | -1 | 0 | 18 |
| logros | -1 | 0 | 3 |
| materias | -1 | 0 | 3 |
| paciente_logros | -1 | 0 | 5 |
| pacientes | -1 | 0 | 3 |
| preguntas | 80 | 0 | 121 |
| respuestas | 484 | 0 | 484 |

`reltuples = -1` significa "nunca se ejecutó ANALYZE" y `n_live_tup = 0` es el valor por defecto sin estadísticas recolectadas. Coincide exactamente con el 0 que reportó `list_tables`. **No es RLS filtrando** (el rol bypasea RLS y los conteos reales devuelven datos).

> ⚠️ Este es un **hallazgo crítico de herramienta**: cualquier auditoría que se base solo en `list_tables` concluiría erróneamente que la base está vacía. Siempre verificar con `COUNT(*)`.

### 1.3 Objetos en `public` y esquemas relacionados

```sql
SELECT table_schema, table_name, table_type FROM information_schema.tables WHERE table_schema IN ('app','public');
```

- **14 tablas base**, todas en el esquema `app`.
- **`public`: 0 tablas, 0 vistas.**
- Vistas (`information_schema.views`) en `app`, `public` y `auth`: **0 filas**.
- Funciones en `app` y `public`: **1 sola función**: `public.handle_new_docente()` (lenguaje `plpgsql`, retorna `trigger`, `SECURITY DEFINER = true`). Detalle completo en la sección 5.
- Funciones auxiliares de Supabase Auth encontradas: `auth.uid()`, `auth.jwt()`, `auth.role()` (definiciones en sección 5).

Owner de esquemas (`pg_namespace`):

| esquema | owner | `nspacl` |
|---|---|---|
| `app` | `postgres` | `{postgres=UC/postgres,anon=U/postgres,authenticated=U/postgres}` |
| `public` | `pg_database_owner` | `{pg_database_owner=UC/...,=U/...,postgres=U/...,anon=U/...,authenticated=U/...,service_role=U/...}` |
| `auth` | `supabase_admin` | incluye `anon=U`, `authenticated=U`, `service_role=U` |
| `storage` | `supabase_admin` | incluye `anon=U`, `authenticated=U`, `service_role=U` |

Nótese que **`service_role` NO tiene USAGE en el esquema `app`** (`has_schema_privilege('service_role','app','USAGE') = false`), mientras que `anon` y `authenticated` sí. Es una configuración inusual (normalmente `service_role` tiene acceso total), coherente con un esquema creado manualmente en SQL Editor.

### 1.4 Migraciones y extensiones

- `list_migrations` → **`migrations: []`**. No hay ninguna migración registrada en `supabase_migrations.schema_migrations`. El esquema `app` fue creado probablemente ejecutando SQL directamente en el SQL Editor, sin historial versionado en la BD. Esto explica también que las políticas RLS sean genéricas y no haya `ALTER POLICY` trazables.
- `list_extensions` → extensiones **instaladas** (con `installed_version` no nulo): `plpgsql` 1.0 (pg_catalog), `pgcrypto` 1.3 (extensions), `uuid-ossp` 1.1 (extensions), `pg_stat_statements` 1.11 (extensions), `pg_graphql` 1.5.11 (graphql), `supabase_vault` 0.3.1 (vault). El resto del listado son extensiones **disponibles pero no instaladas** (`installed_version: null`), entre ellas `pg_cron`, `pg_net`, `http`, `pgjwt`, `postgis`, `vector`, `pgmq`, etc.

> La extensión `pg_graphql` instalada es relevante: junto con los GRANT a `anon`, hace que todas las tablas `app` sean visibles en el esquema GraphQL público (advertencia de seguridad real, ver sección 4 y 6).

---

## 2. Esquema Exhaustivo Tabla por Tabla

**Leyenda de uso** (cruzado con `src/services/supabase.js`):
- 🟢 **Activa**: consultada por el frontend.
- 🔴 **Sin usar**: existe en la BD pero ninguna función del frontend la consulta (las 6 identificadas en `GUIA_ARQUITECTURA.md`).

**Regla global de claves foráneas verificada en `pg_constraint`:** las **20** foreign keys del esquema `app` tienen `ON DELETE CASCADE` (`confdeltype='c'`) y `ON UPDATE NO ACTION` (`confupdtype='a'`), confirmado además por los disparadores internos `RI_FKey_cascade_del` / `RI_FKey_noaction_upd`. No hay ninguna FK con `RESTRICT`, `SET NULL` ni `SET DEFAULT`.

**Regla global de índices:** los **17** índices de `app` son todos `btree` y `UNIQUE` (son los que crean las PRIMARY KEY y las constraints UNIQUE). **No existe ningún índice secundario/no único** en todo el esquema. El advisor de performance confirma 15 FK sin índice cubriente (sección 6).

---

### 🟢 `app.pacientes` — 3 filas

**Estado de uso:** Activa. `getPatientsList`, `createPatient`, `updatePatientAvatar`.

**Columnas:**
| columna | tipo | NULL | DEFAULT | constraint |
|---|---|---|---|---|
| `id_paciente` | `uuid` | NOT NULL | `gen_random_uuid()` | PRIMARY KEY |
| `nombre` | `text` | NOT NULL | — | — |
| `dni` | `text` | NOT NULL | — | — (sin UNIQUE) |
| `avatar_url` | `text` | NULL | — | — |
| `creado_por` | `uuid` | NULL | — | FK → `app.docentes(id_docente)` |
| `fecha_creacion` | `timestamptz` | NULL | `now()` | — |

**PK:** `pacientes_pkey (id_paciente)`.
**FK:** `pacientes_creado_por_fkey` → `app.docentes(id_docente)` **ON DELETE CASCADE / ON UPDATE NO ACTION**.
**Índice:** `pacientes_pkey` — `CREATE UNIQUE INDEX ... USING btree (id_paciente)`.

---

### 🟢 `app.materias` — 3 filas

**Estado de uso:** Activa. `getSubjectsList`, `createSubject`, `deleteSubject`.

| columna | tipo | NULL | DEFAULT | constraint |
|---|---|---|---|---|
| `id_materia` | `uuid` | NOT NULL | `gen_random_uuid()` | PRIMARY KEY |
| `nombre` | `text` | NOT NULL | — | — (sin UNIQUE) |
| `creado_por` | `uuid` | NULL | — | FK → `app.docentes(id_docente)` |
| `es_publica` | `boolean` | NULL | `false` | — (no usada por RLS) |
| `fecha_creacion` | `timestamptz` | NULL | `now()` | — |

**PK:** `materias_pkey (id_materia)`.
**FK:** `materias_creado_por_fkey` → `app.docentes(id_docente)` **CASCADE / NO ACTION**.
**Índice:** `materias_pkey` — UNIQUE btree `(id_materia)`.

---

### 🟢 `app.preguntas` — 121 filas

**Estado de uso:** Activa. `getAllQuestions`, `getQuestionsForGame`, `createQuestionWithAnswers`, `deleteQuestion`.

| columna | tipo | NULL | DEFAULT | constraint |
|---|---|---|---|---|
| `id_pregunta` | `uuid` | NOT NULL | `gen_random_uuid()` | PRIMARY KEY |
| `id_materia` | `uuid` | NULL | — | FK → `app.materias(id_materia)` |
| `texto_pregunta` | `text` | NOT NULL | — | — |
| `ciclo` | `text` | NOT NULL | — | — (texto libre, sin FK a `cycles`, sin CHECK) |
| `media_url` | `text` | NULL | — | — (no usada por el frontend) |
| `media_type` | `text` | NULL | `'none'::text` | CHECK `media_type = ANY (ARRAY['image','audio','video','none'])` |
| `creado_por` | `uuid` | NULL | — | FK → `app.docentes(id_docente)` |
| `fecha_creacion` | `timestamptz` | NULL | `now()` | — |
| `unidad` | `text` | NULL | — | — (no usada por el frontend) |

**PK:** `preguntas_pkey (id_pregunta)`.
**FKs:**
- `preguntas_id_materia_fkey` → `app.materias(id_materia)` **CASCADE / NO ACTION**.
- `preguntas_creado_por_fkey` → `app.docentes(id_docente)` **CASCADE / NO ACTION**.

**Índice:** `preguntas_pkey` — UNIQUE btree `(id_pregunta)`.

**Integridad real de datos (agregados):** 121 preguntas, 0 sin materia, 0 sin creador, 0 sin unidad, 0 con media. Distribución por ciclo: Primer Ciclo 75 / Segundo Ciclo 46.

---

### 🟢 `app.respuestas` — 484 filas

**Estado de uso:** Activa (join embebido desde `preguntas`).

| columna | tipo | NULL | DEFAULT | constraint |
|---|---|---|---|---|
| `id_respuesta` | `uuid` | NOT NULL | `gen_random_uuid()` | PRIMARY KEY |
| `id_pregunta` | `uuid` | NULL | — | FK → `app.preguntas(id_pregunta)` |
| `texto_respuesta` | `text` | NOT NULL | — | — |
| `es_correcta` | `boolean` | NULL | `false` | — (sin CHECK de "exactamente una correcta") |
| `fecha_creacion` | `timestamptz` | NULL | `now()` | — |

**PK:** `respuestas_pkey (id_respuesta)`.
**FK:** `respuestas_id_pregunta_fkey` → `app.preguntas(id_pregunta)` **CASCADE / NO ACTION**.
**Índice:** `respuestas_pkey` — UNIQUE btree `(id_respuesta)`.

**Integridad real:** 484 respuestas, 0 huérfanas, 121 preguntas con respuestas. **Las 121 preguntas tienen exactamente 4 respuestas y exactamente 1 correcta** (verificado con `GROUP BY`), coincide con lo que asume `QuestionForm.js` (1 correcta + 3 incorrectas).

---

### 🟢 `app.intentos` — 15 filas

**Estado de uso:** Activa. `saveGameAttempt`, `getTeacherMetrics`, `getPatientHistory`.

| columna | tipo | NULL | DEFAULT | constraint |
|---|---|---|---|---|
| `id_intento` | `uuid` | NOT NULL | `gen_random_uuid()` | PRIMARY KEY |
| `id_paciente` | `uuid` | NULL | — | FK → `app.pacientes(id_paciente)` |
| `nombre_materia` | `text` | NOT NULL | — | — (snapshot de texto, no FK) |
| `ciclo` | `text` | NOT NULL | — | — (texto libre, no FK) |
| `respuestas_correctas` | `integer` | NULL | `0` | — |
| `respuestas_incorrectas` | `integer` | NULL | `0` | — |
| `puntaje_total` | `integer` | NULL | `0` | — (el frontend guarda `puntaje_total = correct`) |
| `creado_por` | `uuid` | NULL | — | FK → `app.docentes(id_docente)` |
| `fecha_creacion` | `timestamptz` | NULL | `now()` | — |

**PK:** `intentos_pkey (id_intento)`.
**FKs:**
- `intentos_id_paciente_fkey` → `app.pacientes(id_paciente)` **CASCADE / NO ACTION**.
- `intentos_creado_por_fkey` → `app.docentes(id_docente)` **CASCADE / NO ACTION**.

**Índice:** `intentos_pkey` — UNIQUE btree `(id_intento)`.
**Integridad real:** 0 intentos sin paciente, 0 sin creador. Distribución: Primer Ciclo 7 / Segundo Ciclo 8.

---

### 🟢 `app.dibujos` — 3 filas

**Estado de uso:** Activa. `saveDrawingUrl`, `getPatientDrawings`.

| columna | tipo | NULL | DEFAULT | constraint |
|---|---|---|---|---|
| `id_dibujo` | `uuid` | NOT NULL | `gen_random_uuid()` | PRIMARY KEY |
| `id_paciente` | `uuid` | NULL | — | FK → `app.pacientes(id_paciente)` |
| `imagen_b64` | `text` | NOT NULL | — | — (contiene una **URL de Cloudinary**, no base64) |
| `fecha_creacion` | `timestamptz` | NULL | `now()` | — |

**PK:** `dibujos_pkey (id_dibujo)`.
**FK:** `dibujos_id_paciente_fkey` → `app.pacientes(id_paciente)` **CASCADE / NO ACTION**.
**Índice:** `dibujos_pkey` — UNIQUE btree `(id_dibujo)`.

---

### 🟢 `app.logros` — 3 filas

**Estado de uso:** Activa. `checkAndAwardAchievement`, `getPatientAchievements`.

| columna | tipo | NULL | DEFAULT | constraint |
|---|---|---|---|---|
| `id_logro` | `uuid` | NOT NULL | `gen_random_uuid()` | PRIMARY KEY |
| `nombre` | `text` | NOT NULL | — | — (sin UNIQUE: el nombre exacto es la clave de búsqueda en código) |
| `descripcion` | `text` | NULL | — | — |
| `imagen_url` | `text` | NULL | — | — (contiene un emoji, no una URL) |
| `fecha_creacion` | `timestamptz` | NULL | `now()` | — |

**PK:** `logros_pkey (id_logro)`.
**Índice:** `logros_pkey` — UNIQUE btree `(id_logro)`.

---

### 🟢 `app.paciente_logros` — 5 filas

**Estado de uso:** Activa. `checkAndAwardAchievement`, `getPatientAchievements`.

| columna | tipo | NULL | DEFAULT | constraint |
|---|---|---|---|---|
| `id_paciente_logro` | `uuid` | NOT NULL | `gen_random_uuid()` | PRIMARY KEY |
| `id_paciente` | `uuid` | NULL | — | FK → `app.pacientes(id_paciente)` |
| `id_logro` | `uuid` | NULL | — | FK → `app.logros(id_logro)` |
| `fecha_obtencion` | `timestamptz` | NULL | `now()` | — |

**PK:** `paciente_logros_pkey (id_paciente_logro)`.
**FKs:**
- `paciente_logros_id_paciente_fkey` → `app.pacientes(id_paciente)` **CASCADE / NO ACTION**.
- `paciente_logros_id_logro_fkey` → `app.logros(id_logro)` **CASCADE / NO ACTION**.

**Índice:** `paciente_logros_pkey` — UNIQUE btree `(id_paciente_logro)`.
**Integridad real (agregados):** "Primeros Pasos" 3 otorgados, "Puntaje Perfecto" 2, "Pequeño Artista" 0.

---

### 🔴 `app.cycles` — 2 filas

**Estado de uso:** **Sin usar** por el frontend (que hardcodea los strings "Primer Ciclo" / "Segundo Ciclo").

| columna | tipo | NULL | DEFAULT | constraint |
|---|---|---|---|---|
| `id` | `integer` | NOT NULL | `nextval('app.cycles_id_seq')` | PRIMARY KEY |
| `name` | `text` | NOT NULL | — | UNIQUE + CHECK `name = ANY (ARRAY['Primer Ciclo','Segundo Ciclo'])` |

**PK:** `cycles_pkey (id)`. **UNIQUE:** `cycles_name_key (name)`. **CHECK:** `cycles_name_check`.
**Índices:** `cycles_pkey` UNIQUE btree `(id)`; `cycles_name_key` UNIQUE btree `(name)`.

---

### 🔴 `app.levels` — 18 filas

**Estado de uso:** **Sin usar** por el frontend.

| columna | tipo | NULL | DEFAULT | constraint |
|---|---|---|---|---|
| `id` | `integer` | NOT NULL | `nextval('app.levels_id_seq')` | PRIMARY KEY |
| `subject_id` | `integer` | NOT NULL | — | **SIN FOREIGN KEY** (tipo `int4`, incompatible con `materias.id_materia uuid`) |
| `cycle_id` | `integer` | NOT NULL | — | FK → `app.cycles(id)` |
| `level_no` | `integer` | NOT NULL | — | CHECK `level_no >= 1 AND level_no <= 3` |

**PK:** `levels_pkey (id)`. **UNIQUE:** `levels_subject_id_cycle_id_level_no_key (subject_id, cycle_id, level_no)`.
**FK:** `levels_cycle_id_fkey` → `app.cycles(id)` **CASCADE / NO ACTION**.
**Índices:** `levels_pkey` UNIQUE btree `(id)`; `levels_subject_id_cycle_id_level_no_key` UNIQUE btree `(subject_id, cycle_id, level_no)`.

---

### 🔴 `app.docentes` — 3 filas

**Estado de uso:** **Sin usar** directamente por el frontend (lo puebla el trigger). Todas las FK `creado_por` apuntan acá.

| columna | tipo | NULL | DEFAULT | constraint |
|---|---|---|---|---|
| `id_docente` | `uuid` | NOT NULL | — | PRIMARY KEY + FK → `auth.users(id)` |
| `email` | `text` | NULL | — | — |
| `nombre` | `text` | NULL | — | — |
| `fecha_creacion` | `timestamptz` | NULL | `now()` | — |

**PK:** `docentes_pkey (id_docente)`.
**FK:** `docentes_id_docente_fkey` → `auth.users(id)` **CASCADE / NO ACTION**.
**Índice:** `docentes_pkey` — UNIQUE btree `(id_docente)`.
**Integridad real (solo conteos):** 3 docentes, 0 sin email, **3 sin nombre** (el trigger intenta llenarlo desde `raw_user_meta_data->>'full_name'`, que viene vacío). `auth.users` tiene 13 filas → **10 usuarios no tienen fila en `app.docentes`**.

---

### 🔴 `app.intento_detalles` — 0 filas

**Estado de uso:** **Sin usar** por el frontend (no guarda el detalle por pregunta).

| columna | tipo | NULL | DEFAULT | constraint |
|---|---|---|---|---|
| `id_detalle` | `uuid` | NOT NULL | `gen_random_uuid()` | PRIMARY KEY |
| `id_intento` | `uuid` | NULL | — | FK → `app.intentos(id_intento)` |
| `id_pregunta` | `uuid` | NULL | — | FK → `app.preguntas(id_pregunta)` |
| `id_respuesta_elegida` | `uuid` | NULL | — | FK → `app.respuestas(id_respuesta)` |
| `es_correcta` | `boolean` | NOT NULL | — | — |
| `tiempo_respuesta_segundos` | `integer` | NULL | — | — (no usado) |
| `fecha_creacion` | `timestamptz` | NULL | `now()` | — |

**PK:** `intento_detalles_pkey (id_detalle)`.
**FKs (3):** a `intentos`, `preguntas` y `respuestas`, todas **CASCADE / NO ACTION**.
**Índice:** `intento_detalles_pkey` — UNIQUE btree `(id_detalle)`.

---

### 🔴 `app.ajustes` — 1 fila

**Estado de uso:** **Sin usar** por el frontend.

| columna | tipo | NULL | DEFAULT | constraint |
|---|---|---|---|---|
| `id_docente` | `uuid` | NOT NULL | — | PRIMARY KEY + FK → `app.docentes(id_docente)` |
| `max_preguntas` | `integer` | NULL | `10` | — (el dato real es **4**, pero `getQuestionsForGame` no aplica LIMIT) |

**PK:** `ajustes_pkey (id_docente)`.
**FK:** `ajustes_id_docente_fkey` → `app.docentes(id_docente)` **CASCADE / NO ACTION**.
**Índice:** `ajustes_pkey` — UNIQUE btree `(id_docente)`.

---

### 🔴 `app.estado_unidades` — 6 filas

**Estado de uso:** **Sin usar** por el frontend.

| columna | tipo | NULL | DEFAULT | constraint |
|---|---|---|---|---|
| `id_estado` | `uuid` | NOT NULL | `gen_random_uuid()` | PRIMARY KEY |
| `id_materia` | `uuid` | NULL | — | FK → `app.materias(id_materia)` |
| `ciclo` | `text` | NOT NULL | — | — |
| `unidad` | `text` | NOT NULL | — | — |
| `habilitada` | `boolean` | NULL | `false` | — |
| `id_docente` | `uuid` | NULL | — | FK → `app.docentes(id_docente)` |

**PK:** `estado_unidades_pkey (id_estado)`.
**UNIQUE:** `estado_unidades_id_materia_ciclo_unidad_id_docente_key (id_materia, ciclo, unidad, id_docente)`.
**FKs (2):** a `materias` y `docentes`, ambas **CASCADE / NO ACTION**.
**Índices:** `estado_unidades_pkey` UNIQUE btree `(id_estado)`; `estado_unidades_id_materia_ciclo_unidad_id_docente_key` UNIQUE btree de 4 columnas.

---

## 3. Diagrama Entidad-Relación Real (Mermaid `erDiagram`)

```mermaid
erDiagram
    AUTH_USERS ||--o| DOCENTES : "id_docente (FK CASCADE)"
    DOCENTES ||--o{ PACIENTES : "creado_por"
    DOCENTES ||--o{ MATERIAS : "creado_por"
    DOCENTES ||--o{ PREGUNTAS : "creado_por"
    DOCENTES ||--o{ INTENTOS : "creado_por"
    DOCENTES ||--o{ AJUSTES : "id_docente"
    DOCENTES ||--o{ ESTADO_UNIDADES : "id_docente"
    MATERIAS ||--o{ PREGUNTAS : "id_materia"
    MATERIAS ||--o{ ESTADO_UNIDADES : "id_materia"
    PREGUNTAS ||--o{ RESPUESTAS : "id_pregunta"
    PREGUNTAS ||--o{ INTENTO_DETALLES : "id_pregunta"
    RESPUESTAS ||--o{ INTENTO_DETALLES : "id_respuesta_elegida"
    PACIENTES ||--o{ INTENTOS : "id_paciente"
    PACIENTES ||--o{ DIBUJOS : "id_paciente"
    PACIENTES ||--o{ PACIENTE_LOGROS : "id_paciente"
    INTENTOS ||--o{ INTENTO_DETALLES : "id_intento"
    LOGROS ||--o{ PACIENTE_LOGROS : "id_logro"
    CYCLES ||--o{ LEVELS : "cycle_id"

    AUTH_USERS {
        uuid id PK
        text email
    }
    DOCENTES {
        uuid id_docente PK_FK
        text email
        text nombre
        timestamptz fecha_creacion
    }
    PACIENTES {
        uuid id_paciente PK
        text nombre
        text dni
        text avatar_url
        uuid creado_por FK
        timestamptz fecha_creacion
    }
    MATERIAS {
        uuid id_materia PK
        text nombre
        uuid creado_por FK
        boolean es_publica
        timestamptz fecha_creacion
    }
    PREGUNTAS {
        uuid id_pregunta PK
        uuid id_materia FK
        text texto_pregunta
        text ciclo
        text media_url
        text media_type
        uuid creado_por FK
        timestamptz fecha_creacion
        text unidad
    }
    RESPUESTAS {
        uuid id_respuesta PK
        uuid id_pregunta FK
        text texto_respuesta
        boolean es_correcta
        timestamptz fecha_creacion
    }
    INTENTOS {
        uuid id_intento PK
        uuid id_paciente FK
        text nombre_materia
        text ciclo
        int4 respuestas_correctas
        int4 respuestas_incorrectas
        int4 puntaje_total
        uuid creado_por FK
        timestamptz fecha_creacion
    }
    INTENTO_DETALLES {
        uuid id_detalle PK
        uuid id_intento FK
        uuid id_pregunta FK
        uuid id_respuesta_elegida FK
        boolean es_correcta
        int4 tiempo_respuesta_segundos
        timestamptz fecha_creacion
    }
    DIBUJOS {
        uuid id_dibujo PK
        uuid id_paciente FK
        text imagen_b64
        timestamptz fecha_creacion
    }
    LOGROS {
        uuid id_logro PK
        text nombre
        text descripcion
        text imagen_url
        timestamptz fecha_creacion
    }
    PACIENTE_LOGROS {
        uuid id_paciente_logro PK
        uuid id_paciente FK
        uuid id_logro FK
        timestamptz fecha_obtencion
    }
    CYCLES {
        int4 id PK
        text name
    }
    LEVELS {
        int4 id PK
        int4 subject_id
        int4 cycle_id FK
        int4 level_no
    }
    AJUSTES {
        uuid id_docente PK_FK
        int4 max_preguntas
    }
    ESTADO_UNIDADES {
        uuid id_estado PK
        uuid id_materia FK
        text ciclo
        text unidad
        boolean habilitada
        uuid id_docente FK
    }
```

**Relaciones que NO existen y por lo tanto NO se dibujan:**
- `LEVELS.subject_id` **no tiene FK** a `app.materias` (además es `int4`, mientras `id_materia` es `uuid`). Los 18 registros guardan `subject_id` 1, 2 o 3, que no se pueden resolver contra ninguna materia real.
- `INTENTOS.nombre_materia` e `INTENTOS.ciclo` son snapshots de texto, sin FK a `materias` ni a `cycles`.
- `PREGUNTAS.ciclo` e `INTENTOS.ciclo` son texto libre sin CHECK (solo `CYCLES.name` tiene CHECK).

**Bloques:**

- 🟢 **Núcleo activo hoy (8 tablas):** `PACIENTES`, `MATERIAS`, `PREGUNTAS`, `RESPUESTAS`, `INTENTOS`, `DIBUJOS`, `LOGROS`, `PACIENTE_LOGROS`. Son exactamente las que consulta `src/services/supabase.js`.
- 🔴 **Diseñadas en BD pero no conectadas al frontend (6 tablas):** `CYCLES`, `LEVELS`, `DOCENTES`, `INTENTO_DETALLES`, `AJUSTES`, `ESTADO_UNIDADES`. (`AUTH_USERS` se muestra como nodo externo de Supabase Auth, no cuenta como una de las 14 tablas de `app`.)

---

## 4. Auditoría Profunda de Seguridad: Políticas RLS, Roles y Permisos

### 4.1 Estado general de RLS

Las **14 tablas** de `app` tienen `relrowsecurity = true` y `relforcerowsecurity = false`. Es decir, RLS está activo pero **no forzado** (el owner `postgres` y los roles con `BYPASSRLS` no están sujetos a él).

Distribución de políticas (`pg_policies`): **38 políticas en total**, todas `PERMISSIVE`, todas con roles `{authenticated}`. **Ninguna política aplica al rol `anon`.**

| tabla | cant. de políticas | comandos |
|---|---:|---|
| `ajustes` | 1 | ALL |
| `dibujos` | 4 | DELETE, INSERT, SELECT, UPDATE |
| `estado_unidades` | 1 | ALL |
| `intento_detalles` | 4 | DELETE, INSERT, SELECT, UPDATE |
| `intentos` | 4 | DELETE, INSERT, SELECT, UPDATE |
| `logros` | 4 | DELETE, INSERT, SELECT, UPDATE |
| `materias` | 4 | DELETE, INSERT, SELECT, UPDATE |
| `paciente_logros` | 4 | DELETE, INSERT, SELECT, UPDATE |
| `pacientes` | 4 | DELETE, INSERT, SELECT, UPDATE |
| `preguntas` | 4 | DELETE, INSERT, SELECT, UPDATE |
| `respuestas` | 4 | DELETE, INSERT, SELECT, UPDATE |
| `cycles` | **0** | — |
| `docentes` | **0** | — |
| `levels` | **0** | — |

### 4.2 Todas las políticas (expresiones exactas de `pg_policies`)

**Políticas correctas (aislamiento por docente):**

| tabla | policyname | cmd | roles | USING | WITH CHECK |
|---|---|---|---|---|---|
| `ajustes` | `Docentes gestionan sus propios ajustes` | ALL | `{authenticated}` | `(id_docente = ( SELECT auth.uid() AS uid))` | `(id_docente = ( SELECT auth.uid() AS uid))` |
| `estado_unidades` | `Docentes gestionan sus estados de unidades` | ALL | `{authenticated}` | `(id_docente = ( SELECT auth.uid() AS uid))` | `(id_docente = ( SELECT auth.uid() AS uid))` |

**Políticas permisivas ( patrón idéntico repetido en 9 tablas ):**

Para cada una de las tablas `dibujos`, `intento_detalles`, `intentos`, `logros`, `materias`, `paciente_logros`, `pacientes`, `preguntas`, `respuestas` existen exactamente estas 4 políticas:

| policyname | cmd | roles | USING | WITH CHECK |
|---|---|---|---|---|
| `Permitir lectura` | SELECT | `{authenticated}` | `true` | `null` |
| `Permitir insert` | INSERT | `{authenticated}` | `null` | `(( SELECT auth.uid() AS uid) IS NOT NULL)` |
| `Permitir update` | UPDATE | `{authenticated}` | `(( SELECT auth.uid() AS uid) IS NOT NULL)` | `null` |
| `Permitir delete` | DELETE | `{authenticated}` | `(( SELECT auth.uid() AS uid) IS NOT NULL)` | `null` |

Expandido explícitamente (9 tablas × 4 = 36 políticas):

| # | tabla | policyname | cmd | USING | WITH CHECK |
|---:|---|---|---|---|---|
| 1 | dibujos | Permitir lectura | SELECT | `true` | — |
| 2 | dibujos | Permitir insert | INSERT | — | `auth.uid() IS NOT NULL` |
| 3 | dibujos | Permitir update | UPDATE | `auth.uid() IS NOT NULL` | — |
| 4 | dibujos | Permitir delete | DELETE | `auth.uid() IS NOT NULL` | — |
| 5 | intento_detalles | Permitir lectura | SELECT | `true` | — |
| 6 | intento_detalles | Permitir insert | INSERT | — | `auth.uid() IS NOT NULL` |
| 7 | intento_detalles | Permitir update | UPDATE | `auth.uid() IS NOT NULL` | — |
| 8 | intento_detalles | Permitir delete | DELETE | `auth.uid() IS NOT NULL` | — |
| 9 | intentos | Permitir lectura | SELECT | `true` | — |
| 10 | intentos | Permitir insert | INSERT | — | `auth.uid() IS NOT NULL` |
| 11 | intentos | Permitir update | UPDATE | `auth.uid() IS NOT NULL` | — |
| 12 | intentos | Permitir delete | DELETE | `auth.uid() IS NOT NULL` | — |
| 13 | logros | Permitir lectura | SELECT | `true` | — |
| 14 | logros | Permitir insert | INSERT | — | `auth.uid() IS NOT NULL` |
| 15 | logros | Permitir update | UPDATE | `auth.uid() IS NOT NULL` | — |
| 16 | logros | Permitir delete | DELETE | `auth.uid() IS NOT NULL` | — |
| 17 | materias | Permitir lectura | SELECT | `true` | — |
| 18 | materias | Permitir insert | INSERT | — | `auth.uid() IS NOT NULL` |
| 19 | materias | Permitir update | UPDATE | `auth.uid() IS NOT NULL` | — |
| 20 | materias | Permitir delete | DELETE | `auth.uid() IS NOT NULL` | — |
| 21 | paciente_logros | Permitir lectura | SELECT | `true` | — |
| 22 | paciente_logros | Permitir insert | INSERT | — | `auth.uid() IS NOT NULL` |
| 23 | paciente_logros | Permitir update | UPDATE | `auth.uid() IS NOT NULL` | — |
| 24 | paciente_logros | Permitir delete | DELETE | `auth.uid() IS NOT NULL` | — |
| 25 | pacientes | Permitir lectura | SELECT | `true` | — |
| 26 | pacientes | Permitir insert | INSERT | — | `auth.uid() IS NOT NULL` |
| 27 | pacientes | Permitir update | UPDATE | `auth.uid() IS NOT NULL` | — |
| 28 | pacientes | Permitir delete | DELETE | `auth.uid() IS NOT NULL` | — |
| 29 | preguntas | Permitir lectura | SELECT | `true` | — |
| 30 | preguntas | Permitir insert | INSERT | — | `auth.uid() IS NOT NULL` |
| 31 | preguntas | Permitir update | UPDATE | `auth.uid() IS NOT NULL` | — |
| 32 | preguntas | Permitir delete | DELETE | `auth.uid() IS NOT NULL` | — |
| 33 | respuestas | Permitir lectura | SELECT | `true` | — |
| 34 | respuestas | Permitir insert | INSERT | — | `auth.uid() IS NOT NULL` |
| 35 | respuestas | Permitir update | UPDATE | `auth.uid() IS NOT NULL` | — |
| 36 | respuestas | Permitir delete | DELETE | `auth.uid() IS NOT NULL` | — |

Todas son `PERMISSIVE` y para roles `{authenticated}`.

### 4.3 Permisos (GRANT) por rol

**A nivel de esquema (`pg_namespace.nspacl`):**

| esquema | `anon` | `authenticated` | `service_role` |
|---|---|---|---|
| `app` | `U` (USAGE) | `U` (USAGE) | **sin privilegios** |
| `public` | `U` | `U` | `U` |
| `auth` | `U` | `U` | `U` |
| `storage` | `U` | `U` | `U` |

Verificado con `has_schema_privilege`: `anon` → app=true, public=true; `authenticated` → app=true, public=true; `service_role` → app=**false**, public=true.

**A nivel de tabla (`pg_class.relacl`):**

| tabla | `anon` | `authenticated` |
|---|---|---|
| `ajustes` | `arwd` | `arwd` |
| `estado_unidades` | `arwd` | `arwd` |
| `cycles` | `arwdDxtm` | `arwdDxtm` |
| `dibujos` | `arwdDxtm` | `arwdDxtm` |
| `docentes` | `arwdDxtm` | `arwdDxtm` |
| `intento_detalles` | `arwdDxtm` | `arwdDxtm` |
| `intentos` | `arwdDxtm` | `arwdDxtm` |
| `levels` | `arwdDxtm` | `arwdDxtm` |
| `logros` | `arwdDxtm` | `arwdDxtm` |
| `materias` | `arwdDxtm` | `arwdDxtm` |
| `paciente_logros` | `arwdDxtm` | `arwdDxtm` |
| `pacientes` | `arwdDxtm` | `arwdDxtm` |
| `preguntas` | `arwdDxtm` | `arwdDxtm` |
| `respuestas` | `arwdDxtm` | `arwdDxtm` |

Leyenda PostgreSQL: `a`=INSERT, `r`=SELECT, `w`=UPDATE, `d`=DELETE, `D`=TRUNCATE, `x`=REFERENCES, `t`=TRIGGER, `m`=MAINTAIN.

`has_table_privilege` confirma: `anon` tiene SELECT e INSERT en `app.pacientes`; `authenticated` tiene SELECT, UPDATE y DELETE (y el resto).

**Default ACL para objetos futuros en `app`:**
```
postgres (owner de tipo r): {anon=arwd/postgres, authenticated=arwd/postgres}
postgres (owner de tipo S): {anon=rU/postgres, authenticated=rU/postgres}
```
Es decir, **toda tabla nueva que se cree en `app` hereda automámente INSERT/SELECT/UPDATE/DELETE para `anon` y `authenticated`**. Las secuencias `cycles_id_seq` y `levels_id_seq` tienen `rwU` para ambos roles.

> Observación de herramienta: `information_schema.role_table_grants` devolvió `[]` para estos roles, mientras que `pg_class.relacl` y `has_table_privilege` confirman los grants. Se tomó `pg_catalog` como fuente de verdad por ser la definición efectiva.

### 4.4 Evaluación de los 5 puntos críticos

#### (1) ¿Puede el rol `anon` leer o escribir algo sensible en `app`?

- **Lectura/escritura de filas vía API: NO**, porque RLS está activo y **no existe ninguna política para `anon`** en `app` → default deny. Un request sin token con la anon key no ve filas de `pacientes`, `preguntas`, etc.
- **Pero el riesgo no es cero:**
  - `anon` tiene **GRANT de tabla** `arwd`/`arwdDxtm` en las 14 tablas. En particular el permiso **`D` = TRUNCATE en 12 tablas**, y TRUNCATE **no está sujeto a RLS**. PostgREST no expone TRUNCATE, pero cualquier otra superficie con acceso SQL (o un rol mal asignado) podría vaciar tablas.
  - La extensión `pg_graphql` expansiona el esquema y el advisor reporta que **las 14 tablas son visibles en el esquema GraphQL para `anon`** (WARN — ver sección 6). Se filtran nombres de tablas/columnas, no filas, pero es fuga de metadata.
  - `anon` puede **ejecutar** `public.handle_new_docente()` porque es `SECURITY DEFINER` con `EXECUTE` a `public`/`anon` (advisor WARN 0028). No se ejecutó la función (habría sido una escritura), pero el advisor lo marca explícitamente como explotable.
- **Veredicto:** exposición de metadata y superficie de abuso, no lectura directa de datos personales. Corregir los GRANTs.

#### (2) ¿Puede un docente autenticado leer/modificar/borrar datos de OTRO docente?

**SÍ, sin restricción.** Este es el hallazgo de seguridad más grave de la auditoría.

| Operación | Motivo en RLS | Consecuencia real |
|---|---|---|
| SELECT | `USING true` en 9 tablas | Cualquier docente ve **todas** las filas de alumnos, preguntas, intentos y dibujos de todos los docentes. |
| INSERT | `WITH CHECK auth.uid() IS NOT NULL` | Puede insertar filas con `creado_por` de otro docente (o `NULL`, ya que la columna es nullable). |
| UPDATE | `USING auth.uid() IS NOT NULL` | Puede modificar **cualquier fila** de esas tablas, sin importar quién la creó. |
| DELETE | `USING auth.uid() IS NOT NULL` | Puede borrar **cualquier fila** de esas tablas. `auth.uid() IS NOT NULL` solo verifica "estar logueado", no propiedad. |

Notas adicionales:
- Las políticas `UPDATE` no tienen `WITH CHECK`, pero en PostgreSQL eso significa que se reutiliza el `USING`... en este caso `USING auth.uid() IS NOT NULL` → vuelve a ser "cualquier autenticado".
- Las únicas excepciones correctas son `ajustes` y `estado_unidades` (filtran por `id_docente = auth.uid()`).
- La capa de aplicación **no compensa esto**: `getPatientsList()` no filtra por `creado_por`, `getAllQuestions()` no filtra, `getTeacherMetrics()` filtra por `creado_por` solo para las métricas del dashboard, pero `getPatientHistory(id)` consulta por `id_paciente` sin verificar propiedad.
- Con `ON DELETE CASCADE` en todas las FKs, un docente que borre un alumno ajeno elimina también sus intentos, dibujos y logros en cascada.

#### (3) ¿Cómo interactúa `materias.es_publica` con RLS?

**No interactúa: no aparece en ninguna política.** Verificado en las 38 expresiones de `pg_policies`: ninguna referencia a `es_publica`, `creado_por` (salvo en `ajustes`/`estado_unidades`) ni a `auth.jwt()`/`auth.role()`.

Datos reales: las **3** materias existentes tienen `es_publica = true` y el mismo `creado_por`. Por lo tanto:
- La columna es actualmente **inerte**: no implementa lógica multi-docente alguna.
- Si el objetivo era "materias públicas visibles para todos, privadas para su creador", **la lógica no está implementada** en la BD. Hoy, con `SELECT ... true`, **todas** las materias son visibles para cualquier docente, tengan `es_publica=true` o `false`.
- El frontend tampoco la consulta (`getSubjectsList()` traes `SELECT *` y mapea solo `id`/`nombre`).

#### (4) ¿Existe freno real en BD/Auth contra el abuso de `/teacher-manager` o `registerTeacher`?

**No existe ninguno.** Evidencia:

- `TeacherManager.js` llama a `registerTeacher()` → `supabase.auth.signUp({ email, password })`. Cualquier usuario autenticado puede invocar esa API directamente, aunque la UI esconda el botón.
- El router (`src/router/index.js`) no tiene guardia de rol; `/teacher-manager` es accesible por URL directa para cualquier sesión.
- El "Super Admin" es una comparación de string en el frontend: `SUPER_ADMIN_EMAIL = "admin@trivia.com"` en `Dashboard.js`. No hay `role`, `app_metadata`, claim JWT ni tabla de roles consultada en BD.
- No hay políticas RLS sobre `auth.users` ni sobre `app.docentes` que restrinjan quién puede crear cuentas (y `docentes` ni siquiera tiene políticas: está cerrado al API pero lo puebla el trigger).
- Verificación sin exponer datos: `EXISTS(SELECT 1 FROM auth.users WHERE lower(email)='admin@trivia.com')` → **true**; `EXISTS(... FROM app.docentes ...)` → **true**. Existe, pero es solo un email, no un rol.

**Conclusión:** el control de acceso a registro de docentes es **puramente cosmético**. Depender de que Supabase Auth requiera confirmación de email (no verificable desde estos datos) no equivale a un control de autorización.

#### (5) ¿Tablas con RLS activo pero sin políticas, o con políticas demasiado permisivas?

- **Sin políticas (3):** `app.cycles`, `app.docentes`, `app.levels`. Confirmado por `get_advisors('security')` → lint `rls_enabled_no_policy` con `count: 3`. Con RLS activo y sin políticas, `anon` y `authenticated` **no pueden acceder a ninguna fila** de esas tablas (default deny). No rompe la app porque el frontend no las consulta y `docentes` la escribe un trigger `SECURITY DEFINER`.
- **Demasiado permisivas (9 tablas):** `dibujos`, `intento_detalles`, `intentos`, `logros`, `materias`, `paciente_logros`, `pacientes`, `preguntas`, `respuestas`, con `USING true` / `auth.uid() IS NOT NULL`. El advisor **no las marca como lint**, pero son el problema de fondo del punto (2).
- No hay políticas `RESTRICTIVE` (todas son `PERMISSIVE`).

---

## 5. Triggers, Funciones RPC, Vistas y Automatizaciones

### 5.1 Triggers no internos (definidos por el proyecto)

Existe **exactamente 1 trigger no interno** en `auth`, `app` o `public`:

| esquema.tabla | trigger | habilitado | definición exacta (`pg_get_triggerdef`) |
|---|---|---|---|
| `auth.users` | `on_auth_user_created` | `O` (enabled) | `CREATE TRIGGER on_auth_user_created AFTER INSERT ON auth.users FOR EACH ROW EXECUTE FUNCTION handle_new_docente()` |

**✅ Verificación obligatoria cumplida: SÍ existe el trigger que crea el registro en `app.docentes` al registrar un docente.** Es `AFTER INSERT ... FOR EACH ROW`, así que cubre el alta desde `registerTeacher()` y también el alta manual desde Supabase Auth. Sin él, los `creado_por = session.user.id` que envía el frontend violarían la FK a `app.docentes`.

**Caveat crítico detectado:** hay **13 usuarios en `auth.users` pero solo 3 filas en `app.docentes`; 10 usuarios no tienen fila de docente**. Como el trigger existe y está habilitado, lo más probable es que esos 10 usuarios se crearon antes de que se instalara el trigger (no hay migraciones que lo confirmen). Cualquiera de esos 10 que inicie sesión y trate de crear paciente/materia/pregunta/intento recibirá un **error de violación de FK** en `creado_por`. La app no tiene ningún mecanismo de backfill.

### 5.2 Triggers internos (generados por claves foráneas)

Además del trigger de negocio, `pg_trigger` muestra disparadores internos `RI_ConstraintTrigger_*` creados automáticamente por PostgreSQL para implementar las 20 FKs:

- **`app`: 66 disparadores internos** (`RI_FKey_check_ins`, `RI_FKey_check_upd`, `RI_FKey_cascade_del`, `RI_FKey_noaction_upd`) distribuidos en las 14 tablas. Ejemplos representativos extraídos:
  - `CREATE CONSTRAINT TRIGGER "RI_ConstraintTrigger_a_111052" AFTER DELETE ON app.materias FROM app.preguntas NOT DEFERRABLE INITIALLY IMMEDIATE FOR EACH ROW EXECUTE FUNCTION "RI_FKey_cascade_del"()` → confirma el borrado en cascada de preguntas al borrar materia.
  - `CREATE CONSTRAINT TRIGGER "RI_ConstraintTrigger_a_111089" AFTER DELETE ON app.pacientes FROM app.intentos ... "RI_FKey_cascade_del"()` → confirma cascada a intentos al borrar paciente.
  - `CREATE CONSTRAINT TRIGGER "RI_ConstraintTrigger_a_111007" AFTER DELETE ON auth.users FROM app.docentes ... "RI_FKey_cascade_del"()` → borrar un usuario Auth borra su docente y, en cascada, todos sus datos.
  - Todos son `NOT DEFERRABLE INITIALLY IMMEDIATE`.
- **`auth.users`: 22 disparadores internos** adicionales (FKs de Supabase a `auth.identities`, `auth.sessions`, `auth.mfa_factors`, `auth.one_time_tokens`, `auth.oauth_authorizations`, `auth.oauth_consents`, `auth.webauthn_credentials`, `auth.webauthn_challenges`, `auth.scim_users`, `auth.mfa_recovery_code_sets`, y `app.docentes`).

No hay triggers de auditoría (`updated_at`), ni de validación de negocio, ni de sincronización con Cloudinary.

### 5.3 Funciones

**`public.handle_new_docente()` — definición SQL real (`pg_get_functiondef`):**

```sql
CREATE OR REPLACE FUNCTION public.handle_new_docente()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'app'
AS $function$
BEGIN
  INSERT INTO app.docentes (id_docente, email, nombre)
  VALUES (
    new.id,
    new.email,
    new.raw_user_meta_data->>'full_name'
  );
  RETURN new;
END;
$function$
```

- `SECURITY DEFINER = true` (se ejecuta con permisos de `postgres`, por eso puede insertar en `app.docentes` aunque esa tabla no tenga políticas RLS).
- `search_path` explícito `public, app` (buena práctica parcial).
- `proacl` real: `{=X/postgres,postgres=X/postgres,anon=X/postgres,authenticated=X/postgres,service_role=X/postgres}` → **`EXECUTE` abierto a `anon`, `authenticated` y `public`** (`has_function_privilege('anon',...)=true`, `has_function_privilege('authenticated',...)=true`). El advisor lo reporta con dos WARN (0028 y 0029) porque es invocable por RPC: `/rest/v1/rpc/handle_new_docente`. **No se invocó** para no violar la regla de solo lectura.
- Efecto visible: los 3 docentes tienen `email` pero **nombre = NULL**, porque `raw_user_meta_data->>'full_name'` no se enviaba en `registerTeacher`.

**Funciones auxiliares de Auth (definiciones reales):**

```sql
CREATE OR REPLACE FUNCTION auth.uid()
 RETURNS uuid LANGUAGE sql STABLE
AS $function$
  select coalesce(
    nullif(current_setting('request.jwt.claim.sub', true), ''),
    (nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'sub')
  )::uuid
$function$

CREATE OR REPLACE FUNCTION auth.role()
 RETURNS text LANGUAGE sql STABLE
AS $function$
  select coalesce(
    nullif(current_setting('request.jwt.claim.role', true), ''),
    (nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'role')
  )::text
$function$

CREATE OR REPLACE FUNCTION auth.jwt()
 RETURNS jsonb LANGUAGE sql STABLE
AS $function$
  select coalesce(
    nullif(current_setting('request.jwt.claim', true), ''),
    nullif(current_setting('request.jwt.claims', true), '')
  )::jsonb
$function$
```

Estas son las que usan (en teoría) las políticas RLS. Las 4 políticas por tabla usan `auth.uid()` solo como chequeo de "hay usuario", no como filtro de propiedad.

**No hay otras RPCs en `app` ni en `public`.** No hay Edge Functions desplegadas (`list_edge_functions` → `functions: []`).

### 5.4 Vistas

**Ninguna.** `information_schema.views` devolvió 0 filas para `app`, `public` y `auth`. Toda la lógica de agregación (métricas, efectividad, historial) vive en el frontend/PostgREST, no en la BD.

---

## 6. Catálogos Reales, Storage, Edge Functions, Advisors y Logs

### 6.1 `app.logros` — contenido exacto (3 filas)

| id_logro | nombre | descripcion | imagen_url | fecha_creacion |
|---|---|---|---|---|
| `74db1e7a-9e32-455c-86a0-16c4671896fa` | **Pequeño Artista** | Realizó y guardó su primer dibujo. | `🎨` | 2026-03-03T01:39:22.832138+00:00 |
| `a3e53ee1-9820-46da-a78c-bc98ce867e22` | **Primeros Pasos** | Completó su primera trivia. | `⭐` | 2026-03-03T01:39:22.832138+00:00 |
| `466d9391-3fb9-4839-b6f5-a020efbc3940` | **Puntaje Perfecto** | Respondió todas las preguntas correctamente en una partida. | `🏆` | 2026-03-03T01:39:22.832138+00:00 |

**Verificación letra por letra de los nombres usados en el código:**

```sql
SELECT nombre, COUNT(*) FROM app.logros
WHERE nombre IN ('Primeros Pasos','Puntaje Perfecto','Pequeño Artista') GROUP BY nombre;
-- Primeros Pasos: 1 | Puntaje Perfecto: 1 | Pequeño Artista: 1
```

✅ **Los 3 nombres coinciden exactamente.** Esto corrige la sospecha inicial de `GUIA_ARQUITECTURA.md` ("fallo silencioso si el nombre no coincide"): los nombres están bien. El otorgamiento real es: Primeros Pasos 3 veces, Puntaje Perfecto 2, **Pequeño Artista 0** (aunque hay 3 dibujos guardados — el logro no se otorgó en esas cargas o se hizo con otro mecanismo).

### 6.2 `app.cycles` — contenido exacto (2 filas)

| id | name |
|---:|---|
| 1 | `Primer Ciclo` |
| 2 | `Segundo Ciclo` |

✅ Coinciden con los valores hardcodeados en `SubjectSelect.js` y `QuestionForm.js`.

### 6.3 `app.levels` — contenido exacto (18 filas)

| id | subject_id | cycle_id | level_no |
|---:|---:|---:|---:|
| 1 | 1 | 1 | 1 |
| 2 | 1 | 1 | 2 |
| 3 | 1 | 1 | 3 |
| 4 | 1 | 2 | 1 |
| 5 | 1 | 2 | 2 |
| 6 | 1 | 2 | 3 |
| 7 | 2 | 1 | 1 |
| 8 | 2 | 1 | 2 |
| 9 | 2 | 1 | 3 |
| 10 | 2 | 2 | 1 |
| 11 | 2 | 2 | 2 |
| 12 | 2 | 2 | 3 |
| 13 | 3 | 1 | 1 |
| 14 | 3 | 1 | 2 |
| 15 | 3 | 1 | 3 |
| 16 | 3 | 2 | 1 |
| 17 | 3 | 2 | 2 |
| 18 | 3 | 2 | 3 |

Patrón: 3 "materias" lógicas (1, 2, 3) × 2 ciclos × 3 unidades. Como `subject_id` es `int4` y no tiene FK, **no hay forma de saber a qué `materias.id_materia` (uuid) corresponde cada una**; parece un diseño anterior de ID entero nunca migrado.

### 6.4 `app.materias` — contenido exacto (3 filas)

| id_materia | nombre | creado_por | es_publica | fecha_creacion |
|---|---|---|---|---|
| `d204a8b3-33e3-45a2-b0b5-fef9fbb7bd8d` | Matemáticas | `4005cf57-0621-4146-89eb-e0fe3793dae0` | `true` | 2026-03-03T00:16:09.988958+00:00 |
| `b3b0e931-54e2-4b80-a254-3eba2381efbf` | Lengua | `4005cf57-0621-4146-89eb-e0fe3793dae0` | `true` | 2026-03-03T00:16:09.988958+00:00 |
| `ea8614bf-116e-485e-9acb-d25aa1466806` | Ciencias Naturales | `4005cf57-0621-4146-89eb-e0fe3793dae0` | `true` | 2026-03-03T00:16:09.988958+00:00 |

### 6.5 `app.ajustes` — contenido exacto (1 fila)

| id_docente | max_preguntas |
|---|---:|
| `4005cf57-0621-4146-89eb-e0fe3793dae0` | **4** |

El frontend **no lee este valor**: `getQuestionsForGame()` no aplica `LIMIT`, por lo que una partida de "Primer Ciclo" carga hasta 75 preguntas (o 46 de Segundo Ciclo), no 4.

### 6.6 `app.estado_unidades` — contenido exacto (6 filas)

| id_estado | id_materia | ciclo | unidad | habilitada | id_docente |
|---|---|---|---|---|---|
| `041793ce-92ff-48f7-91a8-c7997e79bd2c` | `ea8614bf...` (Ciencias Naturales) | Primer Ciclo | Unidad 2 | true | `4005cf57...` |
| `9837f807-e947-4959-9ed6-d5ba4bda5e91` | `b3b0e931...` (Lengua) | Primer Ciclo | Unidad 1 | true | `4005cf57...` |
| `b7f26d09-879b-435d-a1b2-e07c309494d6` | `d204a8b3...` (Matemáticas) | Primer Ciclo | Unidad 2 | true | `4005cf57...` |
| `baa11107-fdeb-43c4-be31-e930257f6ec5` | `ea8614bf...` (Ciencias Naturales) | Primer Ciclo | Unidad 1 | true | `4005cf57...` |
| `bdfeb89c-8b74-447e-b537-e93092bbd23d` | `b3b0e931...` (Lengua) | Primer Ciclo | Unidad 2 | true | `4005cf57...` |
| `c0969524-f7b9-4ffd-8913-54c65742b7ca` | `d204a8b3...` (Matemáticas) | Primer Ciclo | Unidad 1 | true | `4005cf57...` |

Las 6 filas son del **Primer Ciclo** (no hay ninguna de Segundo Ciclo), todas `habilitada=true`.

### 6.7 Storage y Edge Functions

- `SELECT id, name, public, file_size_limit, allowed_mime_types FROM storage.buckets ORDER BY name;` → **0 filas**. No hay buckets.
- Políticas RLS en el esquema `storage` → **0 filas**.
- `list_edge_functions()` → **`functions: []`**. No hay functions desplegadas.

Esto es coherente con el código: las imágenes (fotos de perfil y dibujos) se suben a **Cloudinary**, no a Supabase Storage. Supabase solo guarda la URL devuelta. La columna `imagen_b64` conserva un nombre histórico engañoso.

### 6.8 Advisors reales

#### `get_advisors('security')` — 6 lints

| lint | nivel | facing | count | detalle / remediación |
|---|---|---|---:|---|
| `rls_enabled_no_policy` | INFO | EXTERNAL | **3** | `app.cycles`, `app.docentes`, `app.levels` tienen RLS activo sin políticas. [lint 0008](https://supabase.com/docs/guides/database/database-linter?lint=0008_rls_enabled_no_policy) |
| `pg_graphql_anon_table_exposed` | **WARN** | EXTERNAL | **14** | Las 14 tablas `app` son visibles en GraphQL para `anon` porque puede SELECT. [lint 0026](https://supabase.com/docs/guides/database/database-linter?lint=0026_pg_graphql_anon_table_exposed) |
| `pg_graphql_authenticated_table_exposed` | **WARN** | EXTERNAL | **14** | Las 14 tablas `app` son visibles en GraphQL para `authenticated`. [lint 0027](https://supabase.com/docs/guides/database/database-linter?lint=0027_pg_graphql_authenticated_table_exposed) |
| `anon_security_definer_function_executable` | **WARN** | EXTERNAL | **1** | `public.handle_new_docente()` ejecutable por `anon` vía `/rest/v1/rpc/handle_new_docente`. [lint 0028](https://supabase.com/docs/guides/database/database-linter?lint=0028_anon_security_definer_function_executable) |
| `authenticated_security_definer_function_executable` | **WARN** | EXTERNAL | **1** | ídem para `authenticated`. [lint 0029](https://supabase.com/docs/guides/database/database-linter?lint=0029_authenticated_security_definer_function_executable) |
| `auth_leaked_password_protection` | **WARN** | EXTERNAL | **1** | Protección de contraseñas filtradas (HaveIBeenPwned) desactivada. [docs](https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection) |

Tablas afectadas por los lints GraphQL 0026 y 0027 (las 14): `ajustes`, `cycles`, `dibujos`, `docentes`, `estado_unidades`, `intento_detalles`, `intentos`, `levels`, `logros`, `materias`, `paciente_logros`, `pacientes`, `preguntas`, `respuestas`.

Observación: el advisor **no** reporta las 9 políticas con `USING true` como problema; ese hallazgo surge del análisis directo de `pg_policies` (sección 4.4.2) y es más grave que los WARN listados.

#### `get_advisors('performance')` — 1 lint

| lint | nivel | count | detalle |
|---|---|---:|---|
| `unindexed_foreign_keys` | INFO | **15** | FKs sin índice cubriente. [lint 0001](https://supabase.com/docs/guides/database/database-linter?lint=0001_unindexed_foreign_keys) |

Las 15 FKs sin índice (todas las listadas; coinciden con el hecho de que solo existen índices de PK/UNIQUE):

| # | tabla | FK | columna(s) |
|---:|---|---|---|
| 1 | dibujos | `dibujos_id_paciente_fkey` | 2 |
| 2 | estado_unidades | `estado_unidades_id_docente_fkey` | 6 |
| 3 | intento_detalles | `intento_detalles_id_intento_fkey` | 2 |
| 4 | intento_detalles | `intento_detalles_id_pregunta_fkey` | 3 |
| 5 | intento_detalles | `intento_detalles_id_respuesta_elegida_fkey` | 4 |
| 6 | intentos | `intentos_creado_por_fkey` | 8 |
| 7 | intentos | `intentos_id_paciente_fkey` | 2 |
| 8 | levels | `levels_cycle_id_fkey` | 3 |
| 9 | materias | `materias_creado_por_fkey` | 3 |
| 10 | paciente_logros | `paciente_logros_id_logro_fkey` | 3 |
| 11 | paciente_logros | `paciente_logros_id_paciente_fkey` | 2 |
| 12 | pacientes | `pacientes_creado_por_fkey` | 5 |
| 13 | preguntas | `preguntas_creado_por_fkey` | 7 |
| 14 | preguntas | `preguntas_id_materia_fkey` | 2 |
| 15 | respuestas | `respuestas_id_pregunta_fkey` | 2 |

#### `get_advisors('health')`

`lints: []` — sin advertencias de salud.

### 6.9 Logs recientes (`query_logs`, ventana por defecto 24 h)

Fuentes disponibles y volumen real:

| source | n |
|---|---:|
| `pgbouncer_logs` | 52 |
| `postgres_logs` | 16 |
| `edge_logs` | 5 |
| `postgrest_logs` | 2 |
| `realtime_logs` | 1 |
| `storage_logs` | 1 |

Severidad de `postgres_logs` / `postgrest_logs` (usando `log_attributes['parsed.error_severity']` y `['parsed.sql_state_code']` — las claves reales del stream, descubiertas con `arrayJoin(mapKeys(log_attributes))`):

| source | severidad | sqlstate | n |
|---|---|---|---:|
| postgres_logs | LOG | 00000 | 12 |
| postgres_logs | **ERROR** | **42P01** | 3 |
| postgres_logs | LOG | 08006 | 1 |
| postgrest_logs | (vacío) | (vacío) | 2 |

Búsquedas agregadas de patrones problemáticos: `permission denied` → 0, `foreign key` → 0, `column` → 0.

**Interpretación:** los 3 errores `42P01` (relation does not exist) se correlacionan con los intentos de esta auditoría de consultar `SELECT ... FROM logs` como si fuera una tabla SQL (la herramienta correcta es `query_logs`, un stream de ClickHouse). No hay errores recientes de FK, permisos o columnas inexistentes provenientes de la app. El `08006` es un aborto de conexión aislado. Nota: la ventana es de 24 h, por lo que no cubre incidentes anteriores.

---

## 7. Cruce Definitivo: Código (`GUIA_ARQUITECTURA.md`) vs. Base de Datos Real

### 7.1 Tabla de desajustes y bugs confirmados

| # | Tema | Lo que asume/hace el código | Realidad verificada en BD | Impacto |
|---:|---|---|---|---|
| 1 | `list_tables` = 0 filas | — | Conteos reales: 121 preguntas, 484 respuestas, 15 intentos, 13 usuarios, etc. `reltuples=-1`, `n_live_tup=0` | **Herramienta engañosa**: nunca auditar solo con `list_tables`. |
| 2 | `id_paciente` | El frontend guarda strings en `state.patient.id` desde `data-id` | Columna `uuid` con `gen_random_uuid()`; los strings son UUID válidos | Funciona. Pero `Patients.js` setea paciente **sin `avatarUrl`** en los botones Jugar/Historial/Dibujar; `SubjectSelect` no lo usa, `PatientHistory` tampoco. Solo `ProfileSelect` lo incluye para el Hub. |
| 3 | `fecha_creacion` | Código usa `p.fecha_creacion \|\| p.created_at \|\| new Date()` | Todas las tablas tienen `fecha_creacion timestamptz NULL DEFAULT now()`; nunca hay `created_at` | El fallback es código muerto; `NOT NULL` no está garantizado (podría venir NULL si se inserta explícitamente). |
| 4 | `imagen_b64` | `saveDrawingUrl` guarda la URL de Cloudinary | Columna `text NOT NULL` sin validación de formato; 3 filas reales | **Confirmado**: nombre engañoso, semántica = URL. La galería la usa como `<img src>`. |
| 5 | `dni` aleatorio | `createPatient` genera 8 dígitos con `Math.random()` | `dni text NOT NULL`, **sin UNIQUE ni CHECK**, 3 filas | Se pueden crear alumnos con DNI duplicado o inválido sin error de BD. |
| 6 | `ciclo` como texto | Hardcodeado en SubjectSelect/QuestionForm | `preguntas.ciclo` y `intentos.ciclo` son `text` sin FK ni CHECK; solo `cycles.name` tiene CHECK. Datos reales: 75/46 y 7/8, todos válidos | Si mañana se cambia el string en la UI, se rompe la consulta sin que la BD lo detecte. La tabla `cycles` existe pero no se usa. |
| 7 | `levels.subject_id` | No se usa | `int4` sin FK, incompatible con `materias.id_materia uuid`; 18 filas con valores 1..3 | **Diseño roto**: no se puede asociar un level con una materia real. |
| 8 | `creado_por` en `createSubject` | `createSubject(name)` inserta solo `{nombre: name}` | `creado_por` es nullable, pero las RLS correctas de `ajustes`/`estado_unidades` esperan `id_docente = auth.uid()` | Las materias nuevas quedan sin dueño; sumado a la política permisiva de `materias`, cualquiera las ve/edita. |
| 9 | **10 usuarios sin docente** | Trigger `handle_new_docente` debería cubrirlos | 13 `auth.users` vs 3 `app.docentes`; 10 huérfanos | **Crítico**: esos usuarios recibirán error de FK al crear pacientes/preguntas/intentos (`creado_por = session.user.id`). No hay backfill. |
| 10 | `nombre` de docentes | El trigger lee `raw_user_meta_data->>'full_name'` | 3 docentes con `nombre IS NULL` | El campo nunca se muestra en la UI, pero está vacío. |
| 11 | Logros | `checkAndAwardAchievement` busca por nombre exacto | Los 3 nombres existen **letra por letra** | ✅ No hay bug acá. Pequeño Artista tiene 0 otorgamientos pese a 3 dibujos. |
| 12 | `getPatientAchievements` | Asume `ach.logros` como objeto con `nombre/descripcion/imagen_url` | Existe la FK y los datos; la relation embebida de PostgREST suele devolver objeto en relaciones 1:1 | Funciona con los datos actuales, pero sin null-check. |
| 13 | Borrar materia | El `confirm()` dice "también se eliminarán sus preguntas" | ✅ `preguntas_id_materia_fkey ... ON DELETE CASCADE` + trigger `RI_FKey_cascade_del`; además cascada a `respuestas` y `estado_unidades` | Confirmado. Borrar 1 materia destruye sus preguntas y respuestas irreversiblemente. |
| 14 | Borrar pregunta | `deleteQuestion()` sin aviso de cascada | `respuestas_id_pregunta_fkey ... ON DELETE CASCADE` (y `intento_detalles`) | Confirmado. El frontend no advierte que también borra respuestas. |
| 15 | Borrar alumno | No existe función de borrado en el frontend | Si se hiciera por API: cascada a `intentos` → `intento_detalles`, `dibujos`, `paciente_logros` | Riesgo latente de pérdida masiva de historial. |
| 16 | `max_preguntas` | No se consulta | `ajustes` tiene `max_preguntas = 4`; `getQuestionsForGame` no limita | Una partida puede tener hasta 75 preguntas; la UI no muestra progreso real esperado. |
| 17 | `intento_detalles` | No se escribe | 0 filas; `tiempo_respuesta_segundos` nunca se llena | No hay analítica por pregunta ni tiempos de respuesta. |
| 18 | `media_url` / `media_type` / `unidad` | No se consultan | 0 preguntas con media; `media_type` default `none`; `unidad` poblada pero sin CHECK | Funcionalidad multimedia preparada y sin usar. |
| 19 | `es_publica` | No se consulta | 3/3 en `true`; ninguna política RLS la referencia | No hay lógica multi-docente en BD. |
| 20 | `respuestas.es_correcta` | El form fuerza 1 correcta + 3 incorrectas | Sin CHECK en BD. Datos actuales: 121/121 con exactamente 1 correcta | La integridad hoy es correcta pero no está garantizada por la BD. |
| 21 | `puntaje_total` | `saveGameAttempt` guarda `correct` | Columna `int4`, sin CHECK; 15 filas | El "puntaje" es un conteo, no un porcentaje. |
| 22 | Storage | Fotos/vía Cloudinary | 0 buckets, 0 políticas de storage, 0 Edge Functions | Coherente. Cloudinary es el único storage de imágenes. |
| 23 | Aislamiento multi-docente | Frontend asume que cada docente ve lo suyo (usa `creado_por = session.user.id` en métricas) | 9 tablas con `USING true` / `auth.uid() IS NOT NULL`; sin filtro de propiedad | **Crítico**: cualquier docente ve/edita/borra datos ajenos por API directa. |
| 24 | Super Admin | Comparación de email en `Dashboard.js` | No hay rol, claim, tabla ni política que lo respalde; `admin@trivia.com` existe como usuario normal | **Crítico**: `/teacher-manager` no está protegido en BD/Auth. |

### 7.2 Funcionalidades ya preparadas en BD que el frontend no aprovecha

| Recurso | Qué permite hoy | Cómo se podría usar |
|---|---|---|
| **`app.cycles`** (2 filas, CHECK + UNIQUE en `name`) | Ciclos escolares canónicos con integridad | Reemplazar los strings hardcodeados por un `SELECT id, name` y guardar `id_ciclo` (FK) en `preguntas`/`intentos`. |
| **`app.levels`** (18 filas, UNIQUE compuesto, CHECK 1–3) | 3 unidades por materia y ciclo | Habilitar/ordenar preguntas por unidad; requiere primero arreglar `subject_id` (int → uuid con FK a `materias`). |
| **`app.docentes`** (3 filas, FK a `auth.users`) | Perfil del docente (email, nombre, alta automática) | Mostrar nombre del docente, auditar quién creó cada registro, base para policies por propiedad. Requiere backfill de 10 usuarios y llenar `nombre`. |
| **`app.intento_detalles`** (0 filas, 3 FKs, `tiempo_respuesta_segundos`) | Guardar cada respuesta individual con tiempo y corrección | Analytics por pregunta (índice de dificultad), estadísticas por alumno y temporizador real. `Game.js` ya sabe qué respuesta eligió. |
| **`app.ajustes`** (1 fila, `max_preguntas=4`) | Configuración por docente | Aplicar `LIMIT` en `getQuestionsForGame()` y exponer un control en el dashboard. |
| **`app.estado_unidades`** (6 filas, `habilitada`, UNIQUE por materia+ciclo+unidad+docente) | Habilitar/deshabilitar unidades por docente | Filtrar qué unidades se juegan; hoy solo tiene datos del Primer Ciclo. |
| **`preguntas.media_url` + `media_type`** (CHECK image/audio/video/none, 0 usadas) | Preguntas con imagen/audio/video | Soporte de preguntas multimodales (el frontend ya sube imágenes a Cloudinary para dibujos). |
| **`preguntas.unidad`** (todas pobladas, sin CHECK) | Agrupar preguntas por unidad | Conectar con `levels` y con `estado_unidades`. |
| **`materias.es_publica`** (todas `true`) | Compartir materias entre docentes | Implementar RLS: `USING (es_publica OR creado_por = auth.uid())`. |
| **`pg_cron`, `pg_net`, `http`, `pgmq`** (disponibles, no instaladas) | Programación y webhooks | Futuras automatizaciones (no instaladas, mencionadas solo como disponibilidad). |

### 7.3 Plan priorizado de saneamiento

#### 🔴 ALTA — corregir antes de seguir programando

**Base de datos:**
1. **Reemplazar las 36 políticas permisivas** por políticas que filtren por propiedad: `USING (creado_por = auth.uid())` y `WITH CHECK (creado_por = auth.uid())` en `pacientes`, `materias`, `preguntas`, `intentos`, `dibujos`, `paciente_logros`, `intento_detalles`, `respuestas` (y `logros` como catálogo de solo lectura). Hoy es una brecha de multitenancy total.
2. **Revocar GRANTs a `anon`** en las 14 tablas (`REVOKE ALL ON ALL TABLES IN SCHEMA app FROM anon`) y quitar `D`/`x`/`t`/`m` también a `authenticated`, dejando solo lo necesario. Ajustar `ALTER DEFAULT PRIVILEGES` para que las tablas nuevas no hereden `arwd` a `anon`.
3. **Revocar `EXECUTE` de `public.handle_new_docente()`** a `anon`, `authenticated` y `public`, dejándolo solo para el trigger (o convertirlo en `SECURITY INVOKER` dentro de una función de trigger protegida).
4. **Backfill de `app.docentes`** para los 10 usuarios de `auth.users` que no tienen fila; y llenar `nombre` (hoy 3/3 NULL). Sin esto, esos usuarios no pueden usar la app.
5. **Arreglar el control de Super Admin**: crear una tabla `app.admin_emails` o un claim `app_metadata.role='super_admin'` y una política/RPC que lo verifique; el email hardcodeado en el frontend no es seguridad.

**Frontend:**
6. **Quitar el email hardcodeado** `admin@trivia.com` y reemplazarlo por una verificación fuerte; agregar guardia de ruta para `/teacher-manager`.
7. **Sanitizar toda interpolación HTML** (`patient_name`, `q.text`, `showModal(title, message)`): hoy hay riesgo XSS con datos de la BD.

#### 🟡 MEDIA — saneamiento funcional

8. Migrar `ciclo` de texto a FK hacia `app.cycles.id` en `preguntas` e `intentos` (mantener `cycles.name` como CHECK).
9. Reparar `app.levels.subject_id`: cambiar a `uuid` y crear FK a `materias(id_materia)`; definir qué significan los IDs 1, 2, 3 actuales.
10. Aplicar `max_preguntas` desde `app.ajustes` en `getQuestionsForGame()` (hoy se cargan hasta 75 preguntas).
11. Escribir `intento_detalles` desde `Game.js` (respuesta elegida, `es_correcta`, tiempo) para habilitar analítica.
12. Agregar `UNIQUE (dni)` y validación de formato, o eliminar el DNI aleatorio y pedirlo por formulario.
13. Hacer `creado_por NOT NULL` con DEFAULT `auth.uid()` donde corresponda, y que `createSubject` lo envíe.
14. Agregar índices en las 15 FKs reportadas por el advisor (especialmente `preguntas(id_materia)`, `respuestas(id_pregunta)`, `intentos(id_paciente, creado_por)`), clave para el crecimiento a 121→miles de preguntas.
15. Aplicar el patrón correcto de propiedad también a `ajustes`/`estado_unidades` cuando se conecten al frontend (ya está bien implementado en RLS).

#### 🟢 BAJA — deuda y consistencia

16. Renombrar `dibujos.imagen_b64` → `imagen_url` (o documentar semánticamente).
17. Agregar `NOT NULL` + `DEFAULT now()` explícito en las columnas `fecha_creacion` hoy nullable, y quitar los fallbacks muertos en el código.
18. Agregar CHECK `UNIQUE (id_pregunta) WHERE es_correcta` para garantizar exactamente una respuesta correcta por pregunta en BD.
19. Versionar el esquema con migraciones (`list_migrations` está vacío): volcar el DDL actual a `supabase/migrations/` para tener historial y poder reproducir el entorno.
20. Ejecutar `ANALYZE` (o dejar de confiar en `list_tables`) para que las estadísticas dejen de reportar 0 filas.
21. Habilitar protección de contraseñas filtradas (advisor WARN) y revisar la política de confirmación de email para `registerTeacher`.
22. Conectar o eliminar del todo las tablas no usadas que no se vayan a implementar (evitar esquema muerto).

---

### Cierre

- **Auditoría 100% de solo lectura**: todas las consultas fueron `SELECT` sobre `information_schema`, `pg_catalog`, tablas de la app, más las herramientas `list_tables`, `list_migrations`, `list_extensions`, `list_edge_functions`, `get_advisors` y `query_logs`. No se llamó a `handle_new_docente()` ni a ninguna RPC que escriba.
- **Conteos reales confirmados**: 14 tablas de `app` con datos (solo `intento_detalles` vacía) + 13 usuarios en Auth. El "0 filas" era un artefacto de estadísticas.
- **Hallazgos críticos**: (a) falta de aislamiento multi-docente en 9 tablas, (b) GRANTs amplios a `anon` + RPC `SECURITY DEFINER` expuesta, (c) 10 usuarios sin fila en `docentes` que romperán inserts por FK, (d) Super Admin solo decorativo, (e) `levels.subject_id` inconectable, (f) `max_preguntas` e `intento_detalles` sin usar.
- **Cosas que sí estaban bien**: nombres de logros exactos, ciclos coherentes, FKs con CASCADE correcto, integridad de preguntas/respuestas (1 correcta + 3 incorrectas en 121/121), trigger de alta de docentes presente, autenticación delegada de `ajustes` y `estado_unidades` correcta, health advisor limpio.
