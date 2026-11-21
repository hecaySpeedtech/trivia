import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../../controllers/AuthContext.jsx";
import TeacherLayout from "../components/TeacherLayout.jsx";
import DoughnutChart from "../components/DoughnutChart.jsx";
import { getTeacherMetrics } from "../../models/gameService.js";
import { getPatientsList } from "../../models/patientsService.js";
import { toCSV, downloadCSV } from "../../utils/csvExport.js";

export default function DashboardPage() {
  const { isSuperAdmin } = useAuth();
  const navigate = useNavigate();
  const [metrics, setMetrics] = useState(null);
  const [patients, setPatients] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const [m, p] = await Promise.all([getTeacherMetrics(), getPatientsList()]);
      if (m.ok) setMetrics(m.data);
      if (p.ok) setPatients(p.data);
      setLoading(false);
    })();
  }, []);

  const exportCSV = async () => {
    // simple: export metrics summary
    const csv = toCSV([{ correct: metrics?.totalCorrect, incorrect: metrics?.totalIncorrect, attempts: metrics?.totalAttempts }], ["correct","incorrect","attempts"]);
    downloadCSV("reporte.csv", csv);
  };

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
      <div className="flex gap-2">
        <button onClick={() => navigate("/profiles")} className="bg-primary text-white px-4 py-2 rounded">Modo Alumno</button>
        <button onClick={exportCSV} className="bg-secondary text-white px-4 py-2 rounded">Exportar CSV</button>
        {isSuperAdmin && <button onClick={() => navigate("/teacher-manager")} className="bg-gray-700 text-white px-4 py-2 rounded">Gestionar Docentes</button>}
      </div>
    </TeacherLayout>
  );
}