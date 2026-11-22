# LeeLuka — Guía interna para Lukas

> Esta guía es para vos. Si vas a entregar el repositorio a los profesores, conviene borrarla o no incluirla en la entrega final.

## 1. Qué se hizo y qué se arregló (el antes y el después)

- **Migración completa a React + Vite + Tailwind**: la app dejó de ser Vanilla JS y ahora coincide con lo que dice tu Word. La estructura está ordenada en patrón MVC (`src/models`, `src/controllers`, `src/views`).
- **Blindaje real de Supabase**: roles reales (`docente` / `super_admin`), RLS multi-docente, `private.is_super_admin()`, trigger `handle_new_docente()`, revocación de `anon`. Sin credenciales hardcodeadas; todo por `.env`.
- **Encierro hermético del Modo Alumno**: al elegir un perfil se activa `studentModeLocked` y las rutas docentes exigen `ReAuthModal` (contraseña del docente).
- **Modo offline con cola de sincronización**: `offlineSyncService` encola intentos y dibujos, sincroniza al volver la conexión o manualmente.
- **Persistencia ante cortes/F5**: `SessionContext` guarda `activePatient` y `activeGame` en `localStorage`; se puede pausar y continuar la partida.
- **Límite breve de preguntas**: `max_preguntas` configurable (3 a 20, default 5) con sanitización de valores raros.
- **Fisher-Yates real**: mezcla preguntas y opciones en `utils/shuffle.js`.
- **CRUD completo**: alumnos, materias, preguntas (con edición/borrado), ajustes, docentes (solo super_admin).
- **Soporte multimedia**: imágenes/audio/video en preguntas y avatares (Cloudinary, validación de tipo y tamaño).
- **Pruebas con casos límite**: Vitest con tests de XSS/CSV injection, Fisher-Yates, localStorage corrupto, rangos, cola offline y 0 preguntas.
- **Limpieza del código**: sin comentarios robóticos, sin emojis en logs, sin imports muertos.

## 2. Cómo descargar, configurar y correr el proyecto

1. Requisitos: Node.js 20+ y Git.
2. Clonar:
   ```bash
   git clone https://github.com/Elekasal/Videojuego-Trivia-Educativa.git
   cd Videojuego-Trivia-Educativa
   ```
3. Instalar dependencias:
   ```bash
   npm install
   ```
4. Crear el archivo `.env` en la raíz (te paso las claves por mensaje privado) con:
   ```
   VITE_SUPABASE_URL=...
   VITE_SUPABASE_ANON_KEY=...
   VITE_CLOUDINARY_CLOUD_NAME=...
   VITE_CLOUDINARY_UPLOAD_PRESET=...
   VITE_SUPER_ADMIN_EMAIL=admin@trivia.com
   ```
5. Correr en desarrollo:
   ```bash
   npm run dev
   ```
6. Compilar para producción:
   ```bash
   npm run build
   ```
7. Correr las pruebas:
   ```bash
   npm run test
   ```
8. Cuentas de prueba: super_admin con el email configurado en `VITE_SUPER_ADMIN_EMAIL` y la contraseña que te paso por privado. No escribas contraseñas reales en este archivo.

## 3. Mapa simple para entender cómo funciona la app por dentro

- `src/models/`: hablan con Supabase y Cloudinary (servicios).
- `src/controllers/`: estado y lógica (Contexts, hooks como `useGameController`).
- `src/views/`: pantallas y componentes (UI).
- `src/utils/`: utilidades puras (`shuffle`, `csvExport`, `feedbackMessages`).
- `supabase/migrations/`: SQL versionado (001 a 005).
- Recorrido de una partida: `LoginPage` → `ProfileSelectPage` (encierro) → `SubjectSelectPage` → `GamePage` (preguntas mezcladas, max_preguntas) → `ResultsPage` (guarda intento + detalles + logros) → `StudentHubPage`.

## 4. Checklist de cumplimiento con la tesis (RF01–RF14, RNF01–RNF10)

| ID | Nombre (tesis) | Cómo lo resuelve la app | Archivo a mostrar |
|---|---|---|---|
| RF01 | Acceso institucional | Auth + roles + cliente efímero | `AuthContext.jsx`, `authService.js`, `RouteGuards.jsx` |
| RF02 | Identificación pedagógica | Alumnos por nombre/alias + avatar; DNI nullable | `PatientsPage.jsx`, `patientsService.js` |
| RF03 | Configuración didáctica inicial | Materias/ciclos/unidades/ajustes | `SubjectSelectPage.jsx`, `SettingsPage.jsx` |
| RF04 | Presentación de consignas (sesiones breves finitas) | max_preguntas + slice | `useGameController.js`, `GamePage.jsx` |
| RF05 | Aleatorización de actividades | Fisher-Yates | `utils/shuffle.js`, `useGameController.js` |
| RF06 | Retroalimentación formativa | Color + ícono + bloqueo doble clic + media | `GamePage.jsx`, `utils/feedbackMessages.js` |
| RF07 | Síntesis del desempeño | Resultados + confetti + detalles + tiempo | `ResultsPage.jsx`, `gameService.js` |
| RF08 | Sincronización de sesiones | Guardado + offline | `gameService.js`, `offlineSyncService.js` |
| RF09 | Consulta docente centralizada | Dashboard + gráfico + historial | `DashboardPage.jsx`, `DoughnutChart.jsx`, `PatientHistoryPage.jsx` |
| RF10 | Depuración responsable | Eliminación con confirmación | `PatientsPage.jsx`, `PatientHistoryPage.jsx` |
| RF11 | Gestión autónoma de contenidos | CRUD materias/preguntas/ajustes | `SubjectManagerPage.jsx`, `QuestionFormPage.jsx`, `SettingsPage.jsx` |
| RF12 | Mitigación de interrupciones | activeGame + pausa/retorno | `SessionContext.jsx`, `GamePage.jsx`, `StudentHubPage.jsx` |
| RF13 | Reportes de acompañamiento | Dashboard + historial + CSV (BOM + escape) | `DashboardPage.jsx`, `PatientHistoryPage.jsx`, `utils/csvExport.js` |
| RF14 | Zona de contención socioafectiva | Dibujo + logro + encierro | `RecreationZonePage.jsx`, `useCanvasController.js` |
| RNF01 | Usabilidad | Layouts claros | `StudentLayout.jsx`, `TeacherLayout.jsx` |
| RNF02 | Accesibilidad contextual | Color + ícono + touch-action + lang es | `GamePage.jsx`, `index.html` |
| RNF03 | Eficiencia percibida | Librerías locales + índices FK | `vite.config.js`, migraciones |
| RNF04 | Compatibilidad multiplataforma | SPA React + Vite | `vite.config.js`, `vercel.json` |
| RNF05 | Seguridad y privacidad | Auth + RLS + roles + .env + 0 innerHTML | migraciones 001–005 |
| RNF06 | Confiabilidad transaccional | localStorage + offline + banner | `offlineSyncService.js`, `OfflineContext.jsx` |
| RNF07 | Organización arquitectónica | MVC | `src/models`, `src/controllers`, `src/views` |
| RNF08 | Portabilidad y despliegue | Vite + Vercel + .env.example | `vite.config.js`, `vercel.json` |
| RNF09 | Evolutividad modular | Servicios desacoplados + migraciones | `src/models/*` |
| RNF10 | Observabilidad básica | ErrorBoundary + logger | `ErrorBoundary.jsx`, `loggerService.js` |

## 5. Guía de estudio y preguntas típicas del jurado

1. **¿Por qué React + Vite y cliente grueso en un hospital?**  
   Porque el hospital puede tener Wi-Fi inestable; el cliente grueso permite offline, respuestas inmediatas y menos dependencia del servidor. Vite da builds rápidos y SPA desplegable en Vercel.

2. **¿Cómo aplican MVC en React?**  
   `models/` acceden a datos, `controllers/` manejan estado y lógica, `views/` renderizan UI. Los componentes no llaman a Supabase directamente salvo casos puntuales.

3. **¿Cómo funciona RLS en Supabase para proteger datos de menores?**  
   Cada docente solo ve sus alumnos/preguntas/intentos (`creado_por = auth.uid()`); super_admin ve todo. `anon` no tiene acceso. Las políticas están en migraciones 001–005.

4. **¿Por qué no se guarda DNI?**  
   Se hizo nullable y se saneó a NULL para respetar privacidad (RNF05). La identificación es por nombre/alias + avatar.

5. **¿Cómo se resuelve la caída del Wi-Fi?**  
   `offlineSyncService` encola intentos/dibujos en `localStorage` y sincroniza al evento `online` o manualmente. Hay banner de estado.

6. **¿Cómo se evita que un chico salga del Modo Alumno al panel docente?**  
   `studentModeLocked` en sesión + `RequireTeacherMode` + `ReAuthModal` exigiendo contraseña docente.

7. **¿Cómo evitan XSS y CSV injection?**  
   Sin `innerHTML`; React escapa por defecto. En CSV se neutralizan fórmulas (`=,+,-,@,\t,\r`) y se escapan comas/comillas/saltos.

8. **¿Por qué `private.is_super_admin()` y cliente efímero?**  
   La función está en esquema privado para no exponerla a `anon`. El cliente efímero registra docentes sin desloguear al admin actual.

9. **¿Cómo funciona Fisher-Yates?**  
   Recorre el array de atrás hacia adelante intercambiando con un índice aleatorio; garantiza permutación uniforme sin mutar el original.

10. **¿Cómo se evita doble envío/puntaje?**  
    Banderas `loading`/`submitting`, `disabled` en botones y guardas por índice en `useGameController`.

11. **¿Cómo se maneja localStorage corrupto?**  
    `try/catch` + validación de forma en `SessionContext`, `loggerService` y `offlineSyncService`; se limpia la clave dañada.

12. **¿Cómo se validan imágenes?**  
    Tipo (jpeg/png/webp) y tamaño (≤5 MB) antes de subir a Cloudinary.

13. **¿Qué pasa con 0 preguntas?**  
    El juego muestra mensaje amigable y no crashea; `max_preguntas` se sanitiza a 3–20.

14. **¿Cómo se persiste una partida?**  
    `activeGame` en `localStorage` guarda preguntas, índice, puntaje y detalles; se restaura al volver.

## 6. Aviso importante antes de entregar a la universidad

`LeeLuka.md` es una guía interna para vos. Conviene borrarla (o no incluirla) cuando entregues el repositorio final a los profesores.
