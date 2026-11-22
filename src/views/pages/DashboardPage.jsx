import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../../controllers/AuthContext.jsx";
import { useOffline } from "../../controllers/OfflineContext.jsx";
import TeacherLayout from "../components/TeacherLayout.jsx";
import DoughnutChart from "../components/DoughnutChart.jsx";
import { getTeacherMetrics, getAttemptsForExport } from "../../models/gameService.js";
import { getPatientsList } from "../../models/patientsService.js";
import { toCSV, downloadCSV } from "../../utils/csvExport.js";

export default function DashboardPage() {
  const { isSuperAdmin } = useAuth();
  const offline = useOffline();
  const navigate = useNavigate();
  const [metrics, setMetrics] = useState(null);
  const [patients, setPatients] = useState([]);
  const [attempts, setAttempts] = useState([]);
  const [filterPatient, setFilterPatient] = useState("");
  const [filterSubject, setFilterSubject] = useState("");
  const [filterCycle, setFilterCycle] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const [m, p, a] = await Promise.all([getTeacherMetrics(), getPatientsList(), getAttemptsForExport()]);
      if (m.ok) setMetrics(m.data);
      if (p.ok) setPatients(p.data);
      if (a.ok) setAttempts(a.data);
      setLoading(false);
    })();
  }, []);

  const subjects = [...new Set(attempts.map((a) => a.subject))];
  const cycles = ["Primer Ciclo", "Segundo Ciclo"];

  const filteredAttempts = attempts.filter((a) => {
    if (filterPatient && a.patientId !== filterPatient) return false;
    if (filterSubject && a.subject !== filterSubject) return false;
    if (filterCycle && a.cycle !== filterCycle) return false;
    return true;
  });

  const exportCSV = () => {
    const rows = filteredAttempts.map((a) => ({
      alumno: a.patientName, materia: a.subject, ciclo: a.cycle,
      correctas: a.correct, incorrectas: a.incorrect, fecha: a.date,
    }));
    const csv = toCSV(rows, ["alumno","materia","ciclo","correctas","incorrectas","fecha"]);
    downloadCSV("reporte.csv", csv);
  };

  const sync = async () => { await offline.syncNow(); };

  if (loading) return <TeacherLayout><div>Cargando...</div></TeacherLayout>;

  return (
    <TeacherLayout>
      <h1 className="text-2xl font-bold mb-4">Dashboard</h1>
      <div className="grid grid-cols-3 gap-4 mb-6">
        <div className="bg-white p-4 rounded shadow"><div className="text-gray-500 text-sm">Alumnos</div><div className="text-2xl font-bold">{patients.length}</div></div>
        <div className="bg-white p-4 rounded shadow"><div className="text-gray-500 text-sm">Partidas</div><div className="text-2xl font-bold">{metrics?.totalAttempts || 0}</div></div>
        <div className="bg-white p-4 rounded shadow"><div className="text-gray-500 text-sm">Correctas</div><div className="text-2xl font-bold">{metrics?.totalCorrect || 0}</div></div>
      </div>
      <div className="bg-white p-4 rounded shadow mb-4" style={{ maxWidth: 300 }}>
        <DoughnutChart data={[metrics?.totalCorrect || 0, metrics?.totalIncorrect || 0]} labels={["Correctas","Incorrectas"]} />
      </div>
      <div className="bg-white p-4 rounded shadow mb-4">
        <h2 className="font-bold mb-2">Exportar CSV filtrado</h2>
        <div className="flex flex-wrap gap-2 mb-2">
          <select value={filterPatient} onChange={(e) => setFilterPatient(e.target.value)} className="border rounded px-2 py-1">
            <option value="">Todos los alumnos</option>
            {patients.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
          <select value={filterSubject} onChange={(e) => setFilterSubject(e.target.value)} className="border rounded px-2 py-1">
            <option value="">Todas las materias</option>
            {subjects.map((s) => <option key={s} value={s}>{s}</option>)}
          </select>
          <select value={filterCycle} onChange={(e) => setFilterCycle(e.target.value)} className="border rounded px-2 py-1">
            <option value="">Todos los ciclos</option>
            {cycles.map((c) => <option key={c} value={c}>{c}</option>)}
          </select>
          <button onClick={exportCSV} className="bg-secondary text-white px-3 py-1 rounded">Exportar CSV</button>
        </div>
      </div>
      <div className="flex gap-2 flex-wrap">
        <button onClick={() => navigate("/profiles")} className="bg-primary text-white px-4 py-2 rounded">Modo Alumno</button>
        <button onClick={sync} className="bg-gray-600 text-white px-4 py-2 rounded">Sincronizar pendientes ({offline.pending})</button>
        {isSuperAdmin && <button onClick={() => navigate("/teacher-manager")} className="bg-gray-700 text-white px-4 py-2 rounded">Gestionar Docentes</button>}
      </div>
    </TeacherLayout>
  );
}