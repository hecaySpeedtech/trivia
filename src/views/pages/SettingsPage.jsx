import { useEffect, useState } from "react";
import TeacherLayout from "../components/TeacherLayout.jsx";
import { useAuth } from "../../controllers/AuthContext.jsx";
import { getSettings, saveSettings, getEstadoUnidades, toggleUnidad } from "../../models/settingsService.js";

export default function SettingsPage() {
  const { user } = useAuth();
  const [maxP, setMaxP] = useState(5);

  const sanitizeMax = (v) => {
    const n = Number(v);
    if (!Number.isFinite(n)) return 5;
    return Math.min(20, Math.max(3, Math.round(n)));
  };
  const [units, setUnits] = useState([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!user) return;
    (async () => {
      const s = await getSettings(user.id);
      if (s.ok && s.data) setMaxP(s.data.max_preguntas || 5);
      const u = await getEstadoUnidades(user.id);
      if (u.ok) setUnits(u.data);
    })();
  }, [user]);

  const save = async () => {
    if (!user) return;
    const safe = sanitizeMax(maxP);
    setMaxP(safe);
    setLoading(true);
    await saveSettings(user.id, safe);
    setLoading(false);
    alert("Guardado");
  };

  const toggle = async (id, val) => {
    await toggleUnidad(id, !val);
    const u = await getEstadoUnidades(user.id);
    if (u.ok) setUnits(u.data);
  };

  return (
    <TeacherLayout>
      <h1 className="text-2xl font-bold mb-4">Ajustes</h1>
      <div className="bg-white p-4 rounded shadow mb-4">
        <label className="block mb-2 font-medium">Máximo de preguntas por partida</label>
        <input type="number" min={3} max={20} value={maxP} onChange={(e) => setMaxP(sanitizeMax(e.target.value))} className="border rounded px-3 py-2" />
        <button onClick={save} disabled={loading} className="ml-2 bg-primary text-white px-4 py-2 rounded">{loading ? "..." : "Guardar"}</button>
      </div>
      <div className="bg-white p-4 rounded shadow">
        <h2 className="font-bold mb-2">Estado de unidades</h2>
        {units.map((u) => (
          <div key={u.id_estado} className="flex justify-between items-center py-1">
            <span>{u.ciclo} — {u.unidad} — {u.id_materia}</span>
            <button onClick={() => toggle(u.id_estado, u.habilitada)} className={`px-3 py-1 rounded text-sm ${u.habilitada ? "bg-green-500 text-white" : "bg-gray-300"}`}>
              {u.habilitada ? "Habilitada" : "Deshabilitada"}
            </button>
          </div>
        ))}
        {units.length === 0 && <div className="text-gray-500">Sin unidades configuradas</div>}
      </div>
    </TeacherLayout>
  );
}