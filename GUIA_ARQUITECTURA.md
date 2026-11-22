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

## 6. Matriz de cumplimiento

| Req | Estado | Implementación |
|---|---|---|
| RF01 | ✅ Cumplido | `AuthContext.jsx` (isSuperAdmin = profile.rol === 'super_admin'); `authService.js` (getProfile lee app.docentes); `RouteGuards.jsx` RequireSuperAdmin; `TeacherManagerPage.jsx` usa createEphemeralClient |
| RF02 | ✅ Cumplido | `PatientsPage.jsx`, `patientsService.js` (solo nombre/alias + avatar; dni nullable) |
| RF03 | ✅ Cumplido | `SubjectSelectPage.jsx` (getCycles/getSubjectsList/getEstadoUnidades) |
| RF04 | ✅ Cumplido | `useGameController.js` (max_preguntas + slice); `GamePage.jsx` (default 5); `SettingsPage.jsx` |
| RF05 | ✅ Cumplido | `utils/shuffle.js` (Fisher-Yates); `useGameController.js` (mezcla preguntas y opciones) |
| RF06 | ✅ Cumplido | `GamePage.jsx` (color + ícono + feedbackMessages + bloqueo doble clic + media_url/media_type) |
| RF07 | ✅ Cumplido | `ResultsPage.jsx` (síntesis + confetti local); `gameService.js` saveGameAttempt (intentos + intento_detalles + tiempo) |
| RF08 | ✅ Cumplido | `SessionContext.jsx` (activeGame/activePatient/studentModeLocked en localStorage); `StudentHubPage.jsx` (Continuar partida) |
| RF09 | ✅ Cumplido | `DashboardPage.jsx` (DoughnutChart chart.js local; métricas propias/globales; CSV filtrado) |
| RF10 | ✅ Cumplido | `PatientHistoryPage.jsx` (eliminar intentos/dibujos con Modal) |
| RF11 | ✅ Cumplido | `SubjectManagerPage.jsx`, `QuestionManagerPage.jsx`, `QuestionFormPage.jsx` (CRUD) |
| RF12 | ✅ Cumplido | `offlineSyncService.js`, `OfflineContext.jsx`, `OfflineBanner.jsx` |
| RF13 | ✅ Cumplido | `csvExport.js` (BOM \uFEFF + escape) |
| RF14 | ✅ Cumplido | `ProfileSelectPage.jsx` (studentModeLocked); `RouteGuards.jsx` RequireTeacherMode; `RecreationZonePage.jsx` (touch-action none, redirige /student-hub) |
| RNF01 | ✅ Cumplido | 0 ocurrencias de innerHTML/dangerouslySetInnerHTML/CDN en src/ |
| RNF02 | ✅ Cumplido | `ErrorBoundary.jsx` envuelve la app en `main.jsx` |
| RNF03 | ✅ Cumplido | Roles reales desde `app.docentes.rol` |
| RNF04 | ✅ Cumplido | `loggerService.js` + visor en Dashboard |
| RNF05 | ✅ Cumplido | `ReAuthModal.jsx` para salir del modo alumno |
| RNF06 | ✅ Cumplido | Offline + localStorage (ver RF08/RF12) |
| RNF07 | ✅ Cumplido | RLS multi-docente en Supabase (migraciones 001-005) |
| RNF08 | ✅ Cumplido | Sin `navigate()` durante render (verificado en páginas) |
| RNF09 | ✅ Cumplido | Accesibilidad: color + ícono en `GamePage.jsx` |
| RNF10 | ✅ Cumplido | `npm run build` exit 0 |
