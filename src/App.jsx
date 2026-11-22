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
      <Route path="/dashboard" element={<RequireAuth><RequireTeacherMode><DashboardPage /></RequireTeacherMode></RequireAuth>} />
      <Route path="/patients" element={<RequireAuth><RequireTeacherMode><PatientsPage /></RequireTeacherMode></RequireAuth>} />
      <Route path="/profiles" element={<RequireAuth><ProfileSelectPage /></RequireAuth>} />
      <Route path="/student-hub" element={<RequireAuth><StudentHubPage /></RequireAuth>} />
      <Route path="/subjects" element={<RequireAuth><SubjectSelectPage /></RequireAuth>} />
      <Route path="/game" element={<RequireAuth><GamePage /></RequireAuth>} />
      <Route path="/results" element={<RequireAuth><ResultsPage /></RequireAuth>} />
      <Route path="/recreation" element={<RequireAuth><RecreationZonePage /></RequireAuth>} />
      <Route path="/history" element={<RequireAuth><RequireTeacherMode><PatientHistoryPage /></RequireTeacherMode></RequireAuth>} />
      <Route path="/subject-manager" element={<RequireAuth><RequireTeacherMode><SubjectManagerPage /></RequireTeacherMode></RequireAuth>} />
      <Route path="/questions" element={<RequireAuth><RequireTeacherMode><QuestionManagerPage /></RequireTeacherMode></RequireAuth>} />
      <Route path="/question-form" element={<RequireAuth><RequireTeacherMode><QuestionFormPage /></RequireTeacherMode></RequireAuth>} />
      <Route path="/question-form/:id" element={<RequireAuth><RequireTeacherMode><QuestionFormPage /></RequireTeacherMode></RequireAuth>} />
      <Route path="/settings" element={<RequireAuth><RequireTeacherMode><SettingsPage /></RequireTeacherMode></RequireAuth>} />
      <Route path="/teacher-manager" element={<RequireAuth><RequireSuperAdmin><RequireTeacherMode><TeacherManagerPage /></RequireTeacherMode></RequireSuperAdmin></RequireAuth>} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}