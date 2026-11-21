import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../../controllers/AuthContext.jsx";
import { LogOut, Users, BookOpen, HelpCircle, Settings, UserCog } from "lucide-react";

export default function TeacherLayout({ children }) {
  const { profile, logout, isSuperAdmin } = useAuth();
  const navigate = useNavigate();
  return (
    <div className="min-h-screen bg-bg">
      <header className="bg-white shadow px-4 py-3 flex items-center justify-between">
        <div className="font-bold text-primary">Trivia Educativa</div>
        <nav className="flex gap-4 text-sm">
          <Link to="/dashboard" className="hover:text-primary">Dashboard</Link>
          <Link to="/patients" className="hover:text-primary flex items-center gap-1"><Users size={16}/>Alumnos</Link>
          <Link to="/subject-manager" className="hover:text-primary flex items-center gap-1"><BookOpen size={16}/>Materias</Link>
          <Link to="/questions" className="hover:text-primary flex items-center gap-1"><HelpCircle size={16}/>Preguntas</Link>
          <Link to="/settings" className="hover:text-primary flex items-center gap-1"><Settings size={16}/>Ajustes</Link>
          {isSuperAdmin && <Link to="/teacher-manager" className="hover:text-primary flex items-center gap-1"><UserCog size={16}/>Docentes</Link>}
        </nav>
        <div className="flex items-center gap-3">
          <span className="text-sm text-gray-600">{profile?.nombre || profile?.email}</span>
          <button onClick={async () => { await logout(); navigate("/"); }} className="text-gray-500 hover:text-accent"><LogOut size={18}/></button>
        </div>
      </header>
      <main className="max-w-6xl mx-auto p-4">{children}</main>
    </div>
  );
}