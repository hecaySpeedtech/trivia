import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useSession } from "../../controllers/SessionContext.jsx";
import TeacherLayout from "../components/TeacherLayout.jsx";
import { getPatientsList, createPatient, updatePatient, updatePatientAvatar, deletePatient } from "../../models/patientsService.js";
import { uploadImageToCloudinary } from "../../models/cloudinaryService.js";
import Modal from "../components/Modal.jsx";

export default function PatientsPage() {
  const navigate = useNavigate();
  const session = useSession();
  const [patients, setPatients] = useState([]);
  const [name, setName] = useState("");
  const [loading, setLoading] = useState(false);
  const [modal, setModal] = useState({ open: false, title: "", message: "", onConfirm: null });
  const [editingId, setEditingId] = useState(null);
  const [editingName, setEditingName] = useState("");

  const load = async () => {
    const r = await getPatientsList();
    if (r.ok) setPatients(r.data);
  };
  useEffect(() => { load(); }, []);

  const add = async (e) => {
    e.preventDefault();
    if (!name.trim()) return;
    setLoading(true);
    const r = await createPatient(name.trim());
    setLoading(false);
    if (r.ok) { setName(""); load(); }
  };

  const [savingEdit, setSavingEdit] = useState(false);
  const saveEdit = async (id) => {
    if (!editingName.trim() || savingEdit) return;
    setSavingEdit(true);
    await updatePatient(id, { nombre: editingName.trim() });
    setSavingEdit(false);
    setEditingId(null);
    setEditingName("");
    load();
  };

  const onAvatar = async (patientId, file) => {
    if (!file) return;
    const allowed = ["image/jpeg", "image/png", "image/webp"];
    if (!allowed.includes(file.type)) {
      alert("Solo se permiten imágenes JPG, PNG o WEBP.");
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      alert("La imagen no puede superar los 5 MB.");
      return;
    }
    const reader = new FileReader();
    reader.onload = async () => {
      const up = await uploadImageToCloudinary(reader.result);
      if (up.ok) { await updatePatientAvatar(patientId, up.url); load(); }
      else alert(up.error || "No se pudo subir la imagen");
    };
    reader.readAsDataURL(file);
  };

  const del = (patientId) => {
    setModal({ open: true, title: "Eliminar alumno", message: "¿Eliminar este alumno y su historial?", onConfirm: async () => {
      await deletePatient(patientId); setModal({ open: false }); load();
    }});
  };

  return (
    <TeacherLayout>
      <h1 className="text-2xl font-bold mb-4">Alumnos</h1>
      <form onSubmit={add} className="flex gap-2 mb-4">
        <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Nombre del alumno" maxLength={100} className="border rounded px-3 py-2 flex-1" />
        <button disabled={loading} className="bg-primary text-white px-4 py-2 rounded">{loading ? "..." : "Agregar"}</button>
      </form>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {patients.map((p) => (
          <div key={p.id} className="bg-white p-3 rounded shadow flex items-center gap-3">
            <img src={p.avatar_url || `https://api.dicebear.com/7.x/bottts/svg?seed=${p.id}`} alt="" className="w-12 h-12 rounded-full" />
            <div className="flex-1">
              {editingId === p.id ? (
                <div className="flex gap-2 mb-1">
                  <input value={editingName} onChange={(e) => setEditingName(e.target.value)} className="border rounded px-2 py-1 flex-1" />
                  <button onClick={() => saveEdit(p.id)} disabled={savingEdit} className="text-xs bg-primary text-white px-2 py-1 rounded">{savingEdit ? "..." : "OK"}</button>
                  <button onClick={() => { setEditingId(null); setEditingName(""); }} className="text-xs bg-gray-200 px-2 py-1 rounded">X</button>
                </div>
              ) : (
                <div className="font-medium">{p.name}</div>
              )}
              <div className="flex gap-2 mt-1 flex-wrap">
                <button onClick={() => { session.update({ activePatient: { id: p.id, name: p.name, avatarUrl: p.avatar_url } }); navigate("/subjects"); }} className="text-xs bg-primary text-white px-2 py-1 rounded">Jugar</button>
                <button onClick={() => { session.update({ activePatient: { id: p.id, name: p.name, avatarUrl: p.avatar_url } }); navigate("/history"); }} className="text-xs bg-gray-600 text-white px-2 py-1 rounded">Historial</button>
                <button onClick={() => { session.update({ activePatient: { id: p.id, name: p.name, avatarUrl: p.avatar_url } }); navigate("/recreation"); }} className="text-xs bg-secondary text-white px-2 py-1 rounded">Dibujar</button>
                <label className="text-xs bg-gray-200 px-2 py-1 rounded cursor-pointer">
                  Foto <input type="file" accept="image/*" hidden onChange={(e) => e.target.files[0] && onAvatar(p.id, e.target.files[0])} />
                </label>
                <button onClick={() => { setEditingId(p.id); setEditingName(p.name); }} className="text-xs text-blue-600">Editar</button>
                <button onClick={() => del(p.id)} className="text-xs text-accent">Eliminar</button>
              </div>
            </div>
          </div>
        ))}
      </div>
      <Modal open={modal.open} title={modal.title} message={modal.message} onConfirm={modal.onConfirm} onCancel={() => setModal({ open: false })} />
    </TeacherLayout>
  );
}