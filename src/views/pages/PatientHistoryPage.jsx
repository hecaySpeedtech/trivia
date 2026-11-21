import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useSession } from "../../controllers/SessionContext.jsx";
import TeacherLayout from "../components/TeacherLayout.jsx";
import { getPatientHistory, deleteAttempt } from "../../models/gameService.js";
import { getPatientDrawings, deleteDrawing } from "../../models/drawingsService.js";

import { toCSV, downloadCSV } from "../../utils/csvExport.js";
import Modal from "../components/Modal.jsx";

// inline achievements service
import { supabase } from "../../models/supabaseClient.js";
async function getPatientAchievementsFn(patientId) {
  const { data, error } = await supabase.from("paciente_logros").select("fecha_obtencion, logros(nombre, descripcion, imagen_url)").eq("id_paciente", patientId).order("fecha_obtencion", { ascending: false });
  if (error) return { ok: false, error };
  return { ok: true, data: data || [] };
}

export default function PatientHistoryPage() {
  const navigate = useNavigate();
  const session = useSession();
  const patient = session.activePatient;
  const [attempts, setAttempts] = useState([]);
  const [drawings, setDrawings] = useState([]);
  const [achievements, setAchievements] = useState([]);
  const [modal, setModal] = useState({ open: false, title: "", message: "", onConfirm: null });

  const load = async () => {
    if (!patient) return;
    const [a, d, ach] = await Promise.all([getPatientHistory(patient.id), getPatientDrawings(patient.id), getPatientAchievementsFn(patient.id)]);
    if (a.ok) setAttempts(a.data);
    if (d.ok) setDrawings(d.data);
    if (ach.ok) setAchievements(ach.data);
  };
  useEffect(() => { load(); }, [patient]);

  const exportCSV = () => {
    const rows = attempts.map((a) => ({ materia: a.nombre_materia, ciclo: a.ciclo, correctas: a.respuestas_correctas, incorrectas: a.respuestas_incorrectas, fecha: a.fecha_creacion }));
    const csv = toCSV(rows, ["materia","ciclo","correctas","incorrectas","fecha"]);
    downloadCSV(`historial_${patient?.name || "alumno"}.csv`, csv);
  };

  if (!patient) return <TeacherLayout><div>Sin alumno seleccionado.</div></TeacherLayout>;

  return (
    <TeacherLayout>
      <h1 className="text-2xl font-bold mb-4">Historial — {patient.name}</h1>
      <h2 className="font-bold mt-4 mb-2">Logros</h2>
      <div className="flex flex-wrap gap-2 mb-4">
        {achievements.map((a, i) => <span key={i} className="bg-secondary text-white px-3 py-1 rounded">{a.logros?.imagen_url} {a.logros?.nombre}</span>)}
        {achievements.length === 0 && <span className="text-gray-500">Sin logros aún</span>}
      </div>
      <div className="flex justify-between items-center mb-2">
        <h2 className="font-bold">Partidas</h2>
        <button onClick={exportCSV} className="text-sm bg-primary text-white px-3 py-1 rounded">Exportar CSV</button>
      </div>
      <div className="space-y-2 mb-4">
        {attempts.map((a) => (
          <div key={a.id_intento} className="bg-white p-3 rounded shadow flex justify-between items-center">
            <div>
              <div className="font-medium">{a.nombre_materia} — {a.ciclo}</div>
              <div className="text-sm text-gray-500">{a.respuestas_correctas} correctas / {a.respuestas_incorrectas} incorrectas — {new Date(a.fecha_creacion).toLocaleString()}</div>
            </div>
            <button onClick={() => setModal({ open: true, title: "Eliminar intento", message: "¿Eliminar esta partida?", onConfirm: async () => { await deleteAttempt(a.id_intento); setModal({ open: false }); load(); } })} className="text-accent text-sm">Eliminar</button>
          </div>
        ))}
        {attempts.length === 0 && <div className="text-gray-500">Sin partidas</div>}
      </div>
      <h2 className="font-bold mb-2">Dibujos</h2>
      <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
        {drawings.map((d) => (
          <div key={d.id_dibujo} className="bg-white p-2 rounded shadow">
            <img src={d.imagen_url} alt="" className="w-full h-32 object-cover rounded" />
            <button onClick={() => setModal({ open: true, title: "Eliminar dibujo", message: "¿Eliminar este dibujo?", onConfirm: async () => { await deleteDrawing(d.id_dibujo); setModal({ open: false }); load(); } })} className="text-accent text-xs mt-1">Eliminar</button>
          </div>
        ))}
      </div>
      <Modal open={modal.open} title={modal.title} message={modal.message} onConfirm={modal.onConfirm} onCancel={() => setModal({ open: false })} />
    </TeacherLayout>
  );
}