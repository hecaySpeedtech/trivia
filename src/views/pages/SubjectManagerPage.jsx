import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import TeacherLayout from "../components/TeacherLayout.jsx";
import { getSubjectsList, createSubject, deleteSubject } from "../../models/subjectsService.js";
import Modal from "../components/Modal.jsx";

export default function SubjectManagerPage() {
  const navigate = useNavigate();
  const [subjects, setSubjects] = useState([]);
  const [name, setName] = useState("");
  const [loading, setLoading] = useState(false);
  const [modal, setModal] = useState({ open: false, title: "", message: "", onConfirm: null });

  const load = async () => { const r = await getSubjectsList(); if (r.ok) setSubjects(r.data); };
  useEffect(() => { load(); }, []);

  const add = async (e) => {
    e.preventDefault();
    if (!name.trim()) return;
    setLoading(true);
    const r = await createSubject(name.trim());
    setLoading(false);
    if (r.ok) { setName(""); load(); }
  };

  const del = (id) => {
    setModal({ open: true, title: "Eliminar materia", message: "Se eliminarán también sus preguntas. ¿Continuar?", onConfirm: async () => {
      await deleteSubject(id); setModal({ open: false }); load();
    }});
  };

  return (
    <TeacherLayout>
      <h1 className="text-2xl font-bold mb-4">Materias</h1>
      <form onSubmit={add} className="flex gap-2 mb-4">
        <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Nombre de la materia" className="border rounded px-3 py-2 flex-1" />
        <button disabled={loading} className="bg-primary text-white px-4 py-2 rounded">{loading ? "..." : "Agregar"}</button>
      </form>
      <div className="space-y-2">
        {subjects.map((s) => (
          <div key={s.id} className="bg-white p-3 rounded shadow flex justify-between items-center">
            <div>{s.name} <span className="text-xs text-gray-500">{s.es_publica ? "(pública)" : "(propia)"}</span></div>
            <button onClick={() => del(s.id)} className="text-accent text-sm">Eliminar</button>
          </div>
        ))}
      </div>
      <Modal open={modal.open} title={modal.title} message={modal.message} onConfirm={modal.onConfirm} onCancel={() => setModal({ open: false })} />
    </TeacherLayout>
  );
}