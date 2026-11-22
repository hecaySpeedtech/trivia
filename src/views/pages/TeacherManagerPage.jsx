import { useState } from "react";
import { useNavigate } from "react-router-dom";
import TeacherLayout from "../components/TeacherLayout.jsx";
import { registerTeacher } from "../../models/authService.js";
import { RequireSuperAdmin } from "../components/RouteGuards.jsx";

function validEmail(e) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e);
}

export default function TeacherManagerPage() {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState("");
  const [err, setErr] = useState("");

  const submit = async (e) => {
    e.preventDefault();
    setErr(""); setMsg("");
    if (!validEmail(email)) { setErr("Ingresá un correo válido."); return; }
    if (password.length < 6) { setErr("La contraseña debe tener al menos 6 caracteres."); return; }
    setLoading(true);
    const r = await registerTeacher(email.trim(), password);
    setLoading(false);
    if (r.ok) {
      setMsg("Docente registrado. Cerrá sesión y volvé a entrar.");
      setEmail(""); setPassword("");
    } else {
      setErr(r.error?.message || "No se pudo registrar el docente. Puede que el correo ya exista.");
    }
  };

  return (
    <TeacherLayout>
      <h1 className="text-2xl font-bold mb-4">Registrar Docente</h1>
      <form onSubmit={submit} className="bg-white p-4 rounded shadow max-w-md space-y-3">
        <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="Email" className="w-full border rounded px-3 py-2" />
        <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Contraseña" className="w-full border rounded px-3 py-2" />
        {err && <p className="text-sm text-accent">{err}</p>}
        {msg && <p className="text-sm text-green-700">{msg}</p>}
        <button disabled={loading} className="bg-primary text-white px-4 py-2 rounded">{loading ? "Registrando..." : "Registrar"}</button>
      </form>
    </TeacherLayout>
  );
}