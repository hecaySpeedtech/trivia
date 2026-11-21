import { Navigate } from "react-router-dom";
import { useAuth } from "../../controllers/AuthContext.jsx";
import { useSession } from "../../controllers/SessionContext.jsx";

export function RequireAuth({ children }) {
  const { user, loading } = useAuth();
  if (loading) return <div className="p-8 text-center">Cargando...</div>;
  if (!user) return <Navigate to="/" replace />;
  return children;
}

export function RequireSuperAdmin({ children }) {
  const { isSuperAdmin, loading } = useAuth();
  if (loading) return <div className="p-8 text-center">Cargando...</div>;
  if (!isSuperAdmin) return <Navigate to="/dashboard" replace />;
  return children;
}

export function RequireTeacherMode({ children }) {
  const session = useSession();
  if (!session.activePatient) return <Navigate to="/profiles" replace />;
  return children;
}