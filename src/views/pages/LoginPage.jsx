import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../../controllers/AuthContext.jsx";

export default function LoginPage() {
  const { login, user } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  if (user) { navigate("/dashboard", { replace: true }); }

  const submit = async (e) => {
    e.preventDefault();
    setLoading(true); setError("");
    const r = await login(email, password);
    setLoading(false);
    if (r.ok) navigate("/dashboard");
    else setError(r.error?.message || "Error de inicio de sesión");
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-bg">
      <form onSubmit={submit} className="bg-white p-8 rounded-xl shadow max-w-sm w-full">
        <h1 className="text-2xl font-bold text-primary mb-4">Iniciar sesión</h1>
        <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="Email" required className="w-full border rounded px-3 py-2 mb-3" />
        <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Contraseña" required className="w-full border rounded px-3 py-2 mb-3" />
        {error && <p className="text-accent text-sm mb-3">{error}</p>}
        <button disabled={loading} className="w-full bg-primary text-white py-2 rounded">{loading ? "Ingresando..." : "Ingresar"}</button>
      </form>
    </div>
  );
}