import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useSession } from "../../controllers/SessionContext.jsx";
import { getSubjectsList } from "../../models/subjectsService.js";
import { getEstadoUnidades, getCycles } from "../../models/settingsService.js";
import { useAuth } from "../../controllers/AuthContext.jsx";

export default function SubjectSelectPage() {
  const navigate = useNavigate();
  const session = useSession();
  const { user } = useAuth();
  const [cycles, setCycles] = useState([]);
  const [subjects, setSubjects] = useState([]);
  const [cycle, setCycle] = useState(null);
  const [units, setUnits] = useState([]);
  const [selectedSubject, setSelectedSubject] = useState(null);

  useEffect(() => {
    (async () => {
      const c = await getCycles();
      if (c.ok) setCycles(c.data);
      const s = await getSubjectsList();
      if (s.ok) setSubjects(s.data);
      if (user) {
        const u = await getEstadoUnidades(user.id);
        if (u.ok) setUnits(u.data);
      }
    })();
  }, [user]);

  const isUnitEnabled = (subjectId, cyc, unit) => {
    if (!units.length) return true;
    const found = units.find((u) => u.id_materia === subjectId && u.ciclo === cyc && u.unidad === unit);
    return found ? found.habilitada : true;
  };

  const pickSubject = (s) => {
    if (!cycle) { alert("Elegí un ciclo primero"); return; }
    session.update({ activeSubject: { id: s.id, name: s.name }, activeCycle: cycle });
    navigate("/game");
  };

  return (
    <div className="min-h-screen bg-bg p-6">
      <h1 className="text-2xl font-bold mb-4">Elegí ciclo y materia</h1>
      <div className="flex gap-2 mb-4">
        {cycles.map((c) => (
          <button key={c.id} onClick={() => setCycle(c.name)}
            className={`px-4 py-2 rounded ${cycle === c.name ? "bg-primary text-white" : "bg-white"}`}>{c.name}</button>
        ))}
        {cycles.length === 0 && ["Primer Ciclo","Segundo Ciclo"].map((c) => (
          <button key={c} onClick={() => setCycle(c)} className={`px-4 py-2 rounded ${cycle === c ? "bg-primary text-white" : "bg-white"}`}>{c}</button>
        ))}
      </div>
      <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
        {subjects.map((s) => (
          <button key={s.id} onClick={() => pickSubject(s)} className="bg-white p-4 rounded shadow hover:shadow-lg text-left">
            <div className="font-medium">{s.name}</div>
            <div className="text-xs text-gray-500">{s.es_publica ? "Pública" : "Propia"}</div>
          </button>
        ))}
      </div>
      {selectedSubject && <div />}
    </div>
  );
}