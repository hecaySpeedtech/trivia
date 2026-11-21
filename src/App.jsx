import { Routes, Route, Navigate } from "react-router-dom";
import { RequireAuth, RequireSuperAdmin, RequireTeacherMode } from "./views/components/RouteGuards.jsx";
import LoginPage from "./views/pages/LoginPage.jsx";
import DashboardPage from "./views/pages/DashboardPage.jsx";
import PatientsPage from "./views/pages/PatientsPage.jsx";
import ProfileSelectPage from "./views/pages/ProfileSelectPage.jsx";
import StudentHubPage from "./views/pages/StudentHubPage.jsx";
import SubjectSelectPage from "./views/pages/SubjectSelectPage.jsx";
import GamePage from "./views/pages/GamePage.jsx";
import ResultsPage from "./views/pages/ResultsPage.jsx";
import RecreationZonePage from "./views/pages/RecreationZonePage.jsx";
import PatientHistoryPage from "./views/pages/PatientHistoryPage.jsx";
import SubjectManagerPage from "./views/pages/SubjectManagerPage.jsx";
import QuestionManagerPage from "./views/pages/QuestionManagerPage.jsx";
import QuestionFormPage from "./views/pages/QuestionFormPage.jsx";
import SettingsPage from "./views/pages/SettingsPage.jsx";
import TeacherManagerPage from "./views/pages/TeacherManagerPage.jsx";

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<LoginPage />} />
      <Route path="/dashboard" element={<RequireAuth><DashboardPage /></RequireAuth>} />
      <Route path="/patients" element={<RequireAuth><PatientsPage /></RequireAuth>} />
      <Route path="/profiles" element={<RequireAuth><ProfileSelectPage /></RequireAuth>} />
      <Route path="/student-hub" element={<RequireAuth><StudentHubPage /></RequireAuth>} />
      <Route path="/subjects" element={<RequireAuth><SubjectSelectPage /></RequireAuth>} />
      <Route path="/game" element={<RequireAuth><GamePage /></RequireAuth>} />
      <Route path="/results" element={<RequireAuth><ResultsPage /></RequireAuth>} />
      <Route path="/recreation" element={<RequireAuth><RecreationZonePage /></RequireAuth>} />
      <Route path="/history" element={<RequireAuth><PatientHistoryPage /></RequireAuth>} />
      <Route path="/subject-manager" element={<RequireAuth><SubjectManagerPage /></RequireAuth>} />
      <Route path="/questions" element={<RequireAuth><QuestionManagerPage /></RequireAuth>} />
      <Route path="/question-form" element={<RequireAuth><QuestionFormPage /></RequireAuth>} />
      <Route path="/question-form/:id" element={<RequireAuth><QuestionFormPage /></RequireAuth>} />
      <Route path="/settings" element={<RequireAuth><SettingsPage /></RequireAuth>} />
      <Route path="/teacher-manager" element={<RequireAuth><RequireSuperAdmin><TeacherManagerPage /></RequireSuperAdmin></RequireAuth>} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}