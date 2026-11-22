import { Navigate, useNavigate } from "react-router-dom";
import { useEffect, useState } from "react";
import { useAuth } from "../../controllers/AuthContext.jsx";
import { useSession } from "../../controllers/SessionContext.jsx";
import ReAuthModal from "./ReAuthModal.jsx";

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
  const navigate = useNavigate();
  const locked = !!session.studentModeLocked;
  const [show, setShow] = useState(locked);

  useEffect(() => {
    if (locked) setShow(true);
    else setShow(false);
  }, [locked]);

  if (!show) return children;

  return (
    <ReAuthModal
      open={true}
      onSuccess={() => {
        session.update({ studentModeLocked: false, activePatient: null, activeGame: null });
        setShow(false);
      }}
      onCancel={() => navigate("/profiles")}
    />
  );
}