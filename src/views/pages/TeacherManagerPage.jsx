import { useState } from "react";
import { useNavigate } from "react-router-dom";
import TeacherLayout from "../components/TeacherLayout.jsx";
import { registerTeacher } from "../../models/authService.js";
import { RequireSuperAdmin } from "../components/RouteGuards.jsx";

export default function TeacherManagerPage() {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState("");

  const submit = async (e) => {
    e.preventDefault();
    setLoading(true); setMsg("");
    const r = await registerTeacher(email, password);
    setLoading(false);
    if (r.ok) {
      setMsg("Docente registrado. Cerrá sesión y volvé a entrar.");
      setEmail(""); setPassword("");
    } else {
      setMsg(r.error?.message || "Error");
    }
  };

  return (
    <TeacherLayout>
      <h1 className="text-2xl font-bold mb-4">Registrar Docente</h1>
      <form onSubmit={submit} className="bg-white p-4 rounded shadow max-w-md space-y-3">
        <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="Email" required className="w-full border rounded px-3 py-2" />
        <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Contraseña" required className="w-full border rounded px-3 py-2" />
        {msg && <p className="text-sm">{msg}</p>}
        <button disabled={loading} className="bg-primary text-white px-4 py-2 rounded">{loading ? "..." : "Registrar"}</button>
      </form>
    </TeacherLayout>
  );
}