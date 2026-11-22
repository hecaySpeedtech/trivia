import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import TeacherLayout from "../components/TeacherLayout.jsx";
import { getSubjectsList, createSubject, updateSubject, deleteSubject } from "../../models/subjectsService.js";
import { useAuth } from "../../controllers/AuthContext.jsx";
import Modal from "../components/Modal.jsx";

export default function SubjectManagerPage() {
  const navigate = useNavigate();
  const { user, isSuperAdmin } = useAuth();
  const [subjects, setSubjects] = useState([]);
  const [name, setName] = useState("");
  const [isPublic, setIsPublic] = useState(false);
  const [loading, setLoading] = useState(false);
  const [modal, setModal] = useState({ open: false, title: "", message: "", onConfirm: null });
  const [editingId, setEditingId] = useState(null);
  const [editingName, setEditingName] = useState("");
  const [editingPublic, setEditingPublic] = useState(false);

  const load = async () => { const r = await getSubjectsList(); if (r.ok) setSubjects(r.data); };
  useEffect(() => { load(); }, []);

  const canEdit = (s) => isSuperAdmin || s.creado_por === user?.id;

  const add = async (e) => {
    e.preventDefault();
    if (!name.trim()) return;
    setLoading(true);
    const r = await createSubject(name.trim(), isPublic);
    setLoading(false);
    if (r.ok) { setName(""); setIsPublic(false); load(); }
  };

  const saveEdit = async (id) => {
    if (!editingName.trim()) return;
    await updateSubject(id, { nombre: editingName.trim(), es_publica: editingPublic });
    setEditingId(null);
    load();
  };

  const del = (id) => {
    setModal({ open: true, title: "Eliminar materia", message: "Se eliminarán también sus preguntas. ¿Continuar?", onConfirm: async () => {
      await deleteSubject(id); setModal({ open: false }); load();
    }});
  };

  return (
    <TeacherLayout>
      <h1 className="text-2xl font-bold mb-4">Materias</h1>
      <form onSubmit={add} className="flex gap-2 mb-4 items-center">
        <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Nombre de la materia" className="border rounded px-3 py-2 flex-1" />
        <label className="flex items-center gap-1 text-sm">
          <input type="checkbox" checked={isPublic} onChange={(e) => setIsPublic(e.target.checked)} /> Pública
        </label>
        <button disabled={loading} className="bg-primary text-white px-4 py-2 rounded">{loading ? "..." : "Agregar"}</button>
      </form>
      <div className="space-y-2">
        {subjects.map((s) => (
          <div key={s.id} className="bg-white p-3 rounded shadow flex justify-between items-center">
            {editingId === s.id ? (
              <div className="flex gap-2 items-center flex-1">
                <input value={editingName} onChange={(e) => setEditingName(e.target.value)} className="border rounded px-2 py-1 flex-1" />
                <label className="flex items-center gap-1 text-sm">
                  <input type="checkbox" checked={editingPublic} onChange={(e) => setEditingPublic(e.target.checked)} /> Pública
                </label>
                <button onClick={() => saveEdit(s.id)} className="text-xs bg-primary text-white px-2 py-1 rounded">OK</button>
                <button onClick={() => setEditingId(null)} className="text-xs bg-gray-200 px-2 py-1 rounded">X</button>
              </div>
            ) : (
              <>
                <div>{s.name} <span className="text-xs text-gray-500">{s.es_publica ? "(pública)" : "(propia)"}</span></div>
                <div className="flex gap-2">
                  {canEdit(s) && (
                    <>
                      <button onClick={() => { setEditingId(s.id); setEditingName(s.name); setEditingPublic(s.es_publica); }} className="text-sm text-primary">Editar</button>
                      <button onClick={() => del(s.id)} className="text-sm text-accent">Eliminar</button>
                    </>
                  )}
                </div>
              </>
            )}
          </div>
        ))}
      </div>
      <Modal open={modal.open} title={modal.title} message={modal.message} onConfirm={modal.onConfirm} onCancel={() => setModal({ open: false })} />
    </TeacherLayout>
  );
}