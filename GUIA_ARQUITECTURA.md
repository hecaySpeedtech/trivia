# Guía de Arquitectura — Trivia Educativa Hospitalaria (React + Supabase)

## 1. Stack real

- **Frontend:** React 18.3.1 + Vite 7.3.1 + React Router 6.28
- **Estilos:** Tailwind CSS 3 (PostCSS + Autoprefixer)
- **Gráficos:** chart.js 4.5.1 (empaquetado local, sin CDN)
- **Confetti:** canvas-confetti 1.9.3 (local)
- **Iconos:** lucide-react 0.468.0
- **Backend:** Supabase (PostgreSQL, Auth, RLS) — esquema `app`
- **Multimedia:** Cloudinary (upload unsigned)
- **Despliegue:** Vercel (SPA rewrite a `index.html`)

### Comandos

```bash
npm install
npm run dev      # desarrollo
npm run build    # producción (exit 0 requerido)
npm run preview  # previsualización
```

### Variables de entorno (`.env`)

```
VITE_SUPABASE_URL=https://<project>.supabase.co
VITE_SUPABASE_ANON_KEY=<anon-key>
VITE_CLOUDINARY_CLOUD_NAME=<cloud-name>
VITE_CLOUDINARY_UPLOAD_PRESET=<preset>
```

## 2. Árbol real de archivos

```
src/
  main.jsx
  App.jsx
  controllers/
    AuthContext.jsx
    SessionContext.jsx
    OfflineContext.jsx
    useGameController.js
    useCanvasController.js
  models/
    supabaseClient.js
    authService.js
    patientsService.js
    subjectsService.js
    questionsService.js
    settingsService.js
    gameService.js
    drawingsService.js
    cloudinaryService.js
    offlineSyncService.js
    loggerService.js
  utils/
    shuffle.js
    feedbackMessages.js
    csvExport.js
  views/
    components/
      ErrorBoundary.jsx
      DoughnutChart.jsx
      Modal.jsx
      OfflineBanner.jsx
      ReAuthModal.jsx
      RouteGuards.jsx
      StudentLayout.jsx
      TeacherLayout.jsx
    pages/
      LoginPage.jsx
      DashboardPage.jsx
      PatientsPage.jsx
      ProfileSelectPage.jsx
      StudentHubPage.jsx
      SubjectSelectPage.jsx
      GamePage.jsx
      ResultsPage.jsx
      RecreationZonePage.jsx
      PatientHistoryPage.jsx
      SubjectManagerPage.jsx
      QuestionManagerPage.jsx
      QuestionFormPage.jsx
      SettingsPage.jsx
      TeacherManagerPage.jsx
  styles/index.css
```

## 3. Diagrama de arquitectura MVC (Mermaid)

```mermaid
flowchart TD
  U[Usuario] --> V[Views (React JSX)]
  V --> C[Controllers (Contexts / hooks)]
  C --> M[Models (services)]
  M --> SB[(Supabase PostgreSQL app.*)]
  M --> CL[Cloudinary]
  C --> LS[(localStorage)]
  LS --> C
  V --> RB[ErrorBoundary + loggerService]
```

## 4. Flujo Modo Docente

1. `LoginPage.jsx` → `authService.login` → Supabase Auth.
2. `AuthContext.jsx` carga perfil real desde `app.docentes` (`rol`).
3. Rutas protegidas por `RequireAuth` (`RouteGuards.jsx`).
4. `RequireSuperAdmin` bloquea `/teacher-manager` para docentes comunes.
5. Si `studentModeLocked === true`, `RequireTeacherMode` exige `ReAuthModal`.
6. Dashboard muestra métricas propias (docente) o globales (super_admin).
7. CRUD: alumnos, materias, preguntas, ajustes, docentes (solo super_admin).

## 5. Flujo Modo Alumno (encierro + offline)

1. `/profiles` activa `studentModeLocked = true` (`ProfileSelectPage.jsx`).
2. Alumno elige perfil → `activePatient` persistido en `localStorage` (`SessionContext.jsx`).
3. Juego: `SubjectSelectPage.jsx` → `GamePage.jsx`.
   - `useGameController.js` mezcla preguntas y opciones (Fisher-Yates).
   - `max_preguntas` desde `app.ajustes` (default 5).
   - Retroalimentación visual + mensaje cálido.
4. Resultados: `ResultsPage.jsx` → confetti local → guarda `app.intentos` + `app.intento_detalles` + logros.
5. Dibujo: `RecreationZonePage.jsx` → Cloudinary → `app.dibujos.imagen_url` + logro.
6. Partida en curso persistida en `activeGame` → F5 o "Pausar y volver" retoma desde `StudentHubPage.jsx`.
7. Offline: `offlineSyncService.js` + `OfflineContext.jsx` encolan intentos/dibujos y sincronizan al evento `online` o botón manual.

## 6. Matriz de cumplimiento (Capítulo 5 de la tesis)

| ID | Requerimiento | Estado | Implementación real en `src/` |
|---|---|---|---|
| RF01 | Acceso institucional | ✅ Cumplido | `AuthContext.jsx` (`isSuperAdmin`), `authService.js` (`getProfile`), `RouteGuards.jsx` (`RequireSuperAdmin`), `TeacherManagerPage.jsx` (cliente efímero) |
| RF02 | Identificación pedagógica | ✅ Cumplido | `PatientsPage.jsx`, `patientsService.js` (nombre/alias + avatar; `dni` nullable) |
| RF03 | Configuración didáctica inicial | ✅ Cumplido | `SubjectSelectPage.jsx` (`getCycles`, `getSubjectsList`, `getEstadoUnidades`), `SettingsPage.jsx` |
| RF04 | Presentación de consignas (sesiones breves finitas) | ✅ Cumplido | `useGameController.js` (`max_preguntas` + `slice`), `GamePage.jsx` (default 5) |
| RF05 | Aleatorización de actividades | ✅ Cumplido | `utils/shuffle.js` (`fisherYates`), `useGameController.js` (preguntas y opciones) |
| RF06 | Retroalimentación formativa | ✅ Cumplido | `GamePage.jsx` (color + ícono + bloqueo doble clic + media), `utils/feedbackMessages.js` |
| RF07 | Síntesis del desempeño | ✅ Cumplido | `ResultsPage.jsx` (síntesis + confetti local), `gameService.js` (`saveGameAttempt` con intentos + detalles + tiempo) |
| RF08 | Sincronización de sesiones | ✅ Cumplido | `gameService.js`, `offlineSyncService.js`, `OfflineContext.jsx` |
| RF09 | Consulta docente centralizada | ✅ Cumplido | `DashboardPage.jsx`, `DoughnutChart.jsx`, `PatientHistoryPage.jsx` |
| RF10 | Depuración responsable | ✅ Cumplido | `PatientsPage.jsx`, `PatientHistoryPage.jsx` (eliminación con `Modal`) |
| RF11 | Gestión autónoma de contenidos | ✅ Cumplido | `SubjectManagerPage.jsx`, `QuestionManagerPage.jsx`, `QuestionFormPage.jsx`, `SettingsPage.jsx` |
| RF12 | Mitigación de interrupciones | ✅ Cumplido | `SessionContext.jsx` (`activeGame`), `GamePage.jsx` (pausa/retorno), `StudentHubPage.jsx` (Continuar partida) |
| RF13 | Reportes de acompañamiento | ✅ Cumplido | `DashboardPage.jsx`, `PatientHistoryPage.jsx`, `utils/csvExport.js` (BOM + escape) |
| RF14 | Zona de contención socioafectiva | ✅ Cumplido | `RecreationZonePage.jsx`, `useCanvasController.js`, logro "Pequeño Artista", encierro a `/student-hub` |
| RNF01 | Usabilidad | ✅ Cumplido | `StudentLayout.jsx`, `TeacherLayout.jsx` |
| RNF02 | Accesibilidad contextual | ✅ Cumplido | `GamePage.jsx` (color + ícono), canvas `touch-action: none`, `lang="es"` en `index.html` |
| RNF03 | Eficiencia percibida | ✅ Cumplido | Chart.js y canvas-confetti locales; índices en 15+ FKs |
| RNF04 | Compatibilidad multiplataforma | ✅ Cumplido | SPA React + Vite (navegador, tablets, celulares, PC) |
| RNF05 | Seguridad y privacidad | ✅ Cumplido | Auth + RLS (migraciones 001–005), roles reales, `RequireTeacherMode` + `ReAuthModal`, `.env`, 0 `innerHTML` |
| RNF06 | Confiabilidad transaccional | ✅ Cumplido | `localStorage` + `offlineSyncService` + auto-sync `online` + `OfflineBanner` |
| RNF07 | Organización arquitectónica | ✅ Cumplido | MVC en `src/models/`, `src/controllers/`, `src/views/` |
| RNF08 | Portabilidad y despliegue | ✅ Cumplido | `vite.config.js`, `vercel.json`, `.env.example`, `npm run build` exit 0 |
| RNF09 | Evolutividad modular | ✅ Cumplido | Servicios/componentes desacoplados + migraciones versionadas |
| RNF10 | Observabilidad básica | ✅ Cumplido | `ErrorBoundary.jsx` en `main.jsx`, `loggerService.js` con visor en `DashboardPage` |
