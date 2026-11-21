import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import TeacherLayout from "../components/TeacherLayout.jsx";
import { getAllQuestions, deleteQuestion } from "../../models/questionsService.js";
import Modal from "../components/Modal.jsx";

export default function QuestionManagerPage() {
  const navigate = useNavigate();
  const [questions, setQuestions] = useState([]);
  const [filterSubject, setFilterSubject] = useState("");
  const [filterCycle, setFilterCycle] = useState("");
  const [search, setSearch] = useState("");
  const [modal, setModal] = useState({ open: false, title: "", message: "", onConfirm: null });

  const load = async () => { const r = await getAllQuestions(); if (r.ok) setQuestions(r.data); };
  useEffect(() => { load(); }, []);

  const filtered = questions.filter((q) => {
    if (filterSubject && q.subjectName !== filterSubject) return false;
    if (filterCycle && q.cycle !== filterCycle) return false;
    if (search && !q.text.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });

  const del = (id) => {
    setModal({ open: true, title: "Eliminar pregunta", message: "¿Eliminar esta pregunta y sus respuestas?", onConfirm: async () => {
      await deleteQuestion(id); setModal({ open: false }); load();
    }});
  };

  const subjects = [...new Set(questions.map((q) => q.subjectName))];

  return (
    <TeacherLayout>
      <h1 className="text-2xl font-bold mb-4">Preguntas</h1>
      <div className="flex flex-wrap gap-2 mb-4">
        <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Buscar..." className="border rounded px-3 py-2" />
        <select value={filterSubject} onChange={(e) => setFilterSubject(e.target.value)} className="border rounded px-3 py-2">
          <option value="">Todas las materias</option>
          {subjects.map((s) => <option key={s} value={s}>{s}</option>)}
        </select>
        <select value={filterCycle} onChange={(e) => setFilterCycle(e.target.value)} className="border rounded px-3 py-2">
          <option value="">Todos los ciclos</option>
          <option value="Primer Ciclo">Primer Ciclo</option>
          <option value="Segundo Ciclo">Segundo Ciclo</option>
        </select>
        <button onClick={() => navigate("/question-form")} className="bg-primary text-white px-4 py-2 rounded">Nueva Pregunta</button>
      </div>
      <div className="space-y-2">
        {filtered.map((q) => (
          <div key={q.id} className="bg-white p-3 rounded shadow">
            <div className="font-medium">{q.text}</div>
            <div className="text-xs text-gray-500">{q.subjectName} — {q.cycle} {q.unit ? `— ${q.unit}` : ""}</div>
            <div className="mt-1 flex gap-2">
              <button onClick={() => navigate(`/question-form/${q.id}`)} className="text-sm text-primary">Editar</button>
              <button onClick={() => del(q.id)} className="text-sm text-accent">Eliminar</button>
            </div>
          </div>
        ))}
        {filtered.length === 0 && <div className="text-gray-500">Sin preguntas</div>}
      </div>
      <Modal open={modal.open} title={modal.title} message={modal.message} onConfirm={modal.onConfirm} onCancel={() => setModal({ open: false })} />
    </TeacherLayout>
  );
}