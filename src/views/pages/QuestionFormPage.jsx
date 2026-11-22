import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import TeacherLayout from "../components/TeacherLayout.jsx";
import { getSubjectsList } from "../../models/subjectsService.js";
import { getAllQuestions, createQuestionWithAnswers, updateQuestionWithAnswers } from "../../models/questionsService.js";
import { uploadImageToCloudinary } from "../../models/cloudinaryService.js";
import Modal from "../components/Modal.jsx";

export default function QuestionFormPage() {
  const navigate = useNavigate();
  const { id } = useParams();
  const editing = !!id;
  const [subjects, setSubjects] = useState([]);
  const [subjectId, setSubjectId] = useState("");
  const [cycle, setCycle] = useState("Primer Ciclo");
  const [text, setText] = useState("");
  const [unit, setUnit] = useState("");
  const [answers, setAnswers] = useState(["", "", "", ""]);
  const [correctIndex, setCorrectIndex] = useState(0);
  const [mediaUrl, setMediaUrl] = useState("");
  const [mediaType, setMediaType] = useState("none");
  const [loading, setLoading] = useState(false);
  const [modal, setModal] = useState({ open: false, title: "", message: "", onConfirm: null });

  useEffect(() => {
    (async () => {
      const s = await getSubjectsList();
      if (s.ok) setSubjects(s.data);
      if (editing) {
        const r = await getAllQuestions();
        if (r.ok) {
          const q = r.data.find((x) => x.id === id);
          if (q) {
            setText(q.text); setCycle(q.cycle); setUnit(q.unit || "");
            setMediaUrl(q.mediaUrl || ""); setMediaType(q.mediaType || "none");
            const subj = s.data?.find((x) => x.name === q.subjectName);
            if (subj) setSubjectId(subj.id);
            const corr = q.answers.findIndex((a) => a.isCorrect);
            setCorrectIndex(corr >= 0 ? corr : 0);
            const ans = q.answers.map((a) => a.text);
            while (ans.length < 4) ans.push("");
            setAnswers(ans.slice(0, 4));
          }
        }
      }
    })();
  }, [id]);

  const onMediaFile = async (file) => {
    const reader = new FileReader();
    reader.onload = async () => {
      const up = await uploadImageToCloudinary(reader.result);
      if (up.ok) { setMediaUrl(up.url); setMediaType("image"); }
    };
    reader.readAsDataURL(file);
  };

  const submit = async (e) => {
    e.preventDefault();
    if (!subjectId || !text.trim()) return;
    setLoading(true);
    const ans = answers.map((t, i) => ({ text: t, isCorrect: i === correctIndex }));
    let r;
    if (editing) {
      r = await updateQuestionWithAnswers(id, subjectId, text.trim(), cycle, ans, unit, mediaUrl, mediaType);
    } else {
      r = await createQuestionWithAnswers(subjectId, text.trim(), cycle, ans, unit, mediaUrl, mediaType);
    }
    setLoading(false);
    if (r.ok) {
      setModal({ open: true, title: "OK", message: "Pregunta guardada", onConfirm: () => { setModal({ open: false }); navigate("/questions"); } });
    } else {
      setModal({ open: true, title: "Error", message: r.error?.message || "Error", onConfirm: () => setModal({ open: false }) });
    }
  };

  return (
    <TeacherLayout>
      <h1 className="text-2xl font-bold mb-4">{editing ? "Editar" : "Nueva"} Pregunta</h1>
      <form onSubmit={submit} className="bg-white p-4 rounded shadow space-y-3 max-w-2xl">
        <select value={subjectId} onChange={(e) => setSubjectId(e.target.value)} className="w-full border rounded px-3 py-2">
          <option value="">Materia</option>
          {subjects.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
        </select>
        <select value={cycle} onChange={(e) => setCycle(e.target.value)} className="w-full border rounded px-3 py-2">
          <option value="Primer Ciclo">Primer Ciclo</option>
          <option value="Segundo Ciclo">Segundo Ciclo</option>
        </select>
        <input value={unit} onChange={(e) => setUnit(e.target.value)} placeholder="Unidad (opcional)" className="w-full border rounded px-3 py-2" />
        <textarea value={text} onChange={(e) => setText(e.target.value)} placeholder="Texto de la pregunta" className="w-full border rounded px-3 py-2" rows={3} />
        {answers.map((a, i) => (
          <div key={i} className="flex gap-2 items-center">
            <input type="radio" name="correct" checked={correctIndex === i} onChange={() => setCorrectIndex(i)} />
            <input value={a} onChange={(e) => { const c = [...answers]; c[i] = e.target.value; setAnswers(c); }} placeholder={`Respuesta ${i + 1}`} className="flex-1 border rounded px-3 py-2" />
          </div>
        ))}
        <div className="space-y-2">
          <label className="block text-sm font-medium">Multimedia (opcional)</label>
          <select value={mediaType} onChange={(e) => setMediaType(e.target.value)} className="border rounded px-3 py-2">
            <option value="none">Ninguna</option>
            <option value="image">Imagen</option>
            <option value="audio">Audio</option>
            <option value="video">Video</option>
          </select>
          <input value={mediaUrl} onChange={(e) => setMediaUrl(e.target.value)} placeholder="URL de media" className="w-full border rounded px-3 py-2" />
          <label className="text-xs bg-gray-200 px-2 py-1 rounded cursor-pointer inline-block">
            Subir imagen <input type="file" accept="image/*" hidden onChange={(e) => e.target.files[0] && onMediaFile(e.target.files[0])} />
          </label>
        </div>
        <button disabled={loading} className="bg-primary text-white px-4 py-2 rounded">{loading ? "Guardando..." : "Guardar"}</button>
      </form>
      <Modal open={modal.open} title={modal.title} message={modal.message} onConfirm={modal.onConfirm} />
    </TeacherLayout>
  );
}