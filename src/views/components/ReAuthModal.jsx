import { useState } from "react";
import { useAuth } from "../../controllers/AuthContext.jsx";
import { verifyPassword } from "../../models/authService.js";

export default function ReAuthModal({ open, onSuccess, onCancel }) {
  const { user } = useAuth();
  const [pwd, setPwd] = useState("");
  const [err, setErr] = useState("");
  const [loading, setLoading] = useState(false);

  if (!open) return null;

  const submit = async (e) => {
    e.preventDefault();
    setLoading(true); setErr("");
    const ok = await verifyPassword(user.email, pwd);
    setLoading(false);
    if (ok) { setPwd(""); onSuccess?.(); }
    else setErr("Contraseña incorrecta");
  };

  return (
    <div role="dialog" aria-modal="true" className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <form onSubmit={submit} className="bg-white rounded-xl p-6 max-w-sm w-full shadow-xl">
        <h2 className="text-lg font-bold mb-2">Verificación docente</h2>
        <p className="text-gray-600 mb-4 text-sm">Ingresá tu contraseña para continuar.</p>
        <input type="password" value={pwd} onChange={(e) => setPwd(e.target.value)}
          className="w-full border rounded px-3 py-2 mb-2" autoFocus />
        {err && <p className="text-accent text-sm mb-2">{err}</p>}
        <div className="flex justify-end gap-2">
          <button type="button" className="px-4 py-2 rounded bg-gray-200" onClick={onCancel}>Cancelar</button>
          <button type="submit" disabled={loading} className="px-4 py-2 rounded bg-primary text-white">
            {loading ? "Verificando..." : "Confirmar"}
          </button>
        </div>
      </form>
    </div>
  );
}