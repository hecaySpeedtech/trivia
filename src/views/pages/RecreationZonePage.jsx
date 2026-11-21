import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useSession } from "../../controllers/SessionContext.jsx";
import StudentLayout from "../components/StudentLayout.jsx";
import { useCanvasController } from "../../controllers/useCanvasController.js";
import { saveDrawingUrl } from "../../models/drawingsService.js";
import { uploadImageToCloudinary } from "../../models/cloudinaryService.js";
import { supabase } from "../../models/supabaseClient.js";
import Modal from "../components/Modal.jsx";

export default function RecreationZonePage() {
  const navigate = useNavigate();
  const session = useSession();
  const c = useCanvasController();
  const [saving, setSaving] = useState(false);
  const [modal, setModal] = useState({ open: false, title: "", message: "" });

  useEffect(() => {
    const canvas = c.canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    canvas.width = 600; canvas.height = 400;
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
  }, []);

  // wire events
  useEffect(() => {
    const canvas = c.canvasRef.current;
    if (!canvas) return;
    const down = (e) => { e.preventDefault(); c.start(e); };
    const move = (e) => { e.preventDefault(); c.move(e); };
    const up = () => c.end();
    canvas.addEventListener("mousedown", down);
    canvas.addEventListener("mousemove", move);
    canvas.addEventListener("mouseup", up);
    canvas.addEventListener("mouseleave", up);
    canvas.addEventListener("touchstart", down, { passive: false });
    canvas.addEventListener("touchmove", move, { passive: false });
    canvas.addEventListener("touchend", up);
    return () => {
      canvas.removeEventListener("mousedown", down);
      canvas.removeEventListener("mousemove", move);
      canvas.removeEventListener("mouseup", up);
      canvas.removeEventListener("mouseleave", up);
      canvas.removeEventListener("touchstart", down);
      canvas.removeEventListener("touchmove", move);
      canvas.removeEventListener("touchend", up);
    };
  }, [c]);

  const save = async () => {
    setSaving(true);
    const png = c.exportPNG();
    const up = await uploadImageToCloudinary(png);
    if (up.ok && session.activePatient) {
      await saveDrawingUrl(session.activePatient.id, up.url);
      // award achievement
      const { data: logro } = await supabase.from("logros").select("id_logro").eq("nombre", "Pequeño Artista").maybeSingle();
      if (logro) {
        const { data: ex } = await supabase.from("paciente_logros").select("id_paciente_logro").eq("id_paciente", session.activePatient.id).eq("id_logro", logro.id_logro);
        if (!ex || !ex.length) await supabase.from("paciente_logros").insert([{ id_paciente: session.activePatient.id, id_logro: logro.id_logro }]);
      }
      setModal({ open: true, title: "Guardado", message: "Tu dibujo se guardó." });
    } else {
      setModal({ open: true, title: "Error", message: up.error || "No se pudo guardar" });
    }
    setSaving(false);
  };

  const colors = ["#000000","#ef4444","#1e90ff","#f59e0b","#22c55e","#ffffff"];

  return (
    <StudentLayout>
      <h1 className="text-xl font-bold mb-3">Zona de Dibujo</h1>
      <canvas ref={c.canvasRef} style={{ touchAction: "none", border: "1px solid #ccc", background: "#fff" }} className="w-full max-w-[600px]" />
      <div className="flex flex-wrap gap-2 mt-3 items-center">
        {colors.map((col) => (
          <button key={col} onClick={() => c.setColor(col)} style={{ background: col }} className={`w-8 h-8 rounded-full border-2 ${c.color === col ? "border-primary" : "border-gray-300"}`} />
        ))}
        <input type="range" min="1" max="20" value={c.size} onChange={(e) => c.setSize(Number(e.target.value))} />
        <button onClick={c.undo} className="px-3 py-1 bg-gray-200 rounded">Deshacer</button>
        <button onClick={c.clear} className="px-3 py-1 bg-gray-200 rounded">Limpiar</button>
        <button onClick={save} disabled={saving} className="px-3 py-1 bg-primary text-white rounded">{saving ? "Guardando..." : "Guardar"}</button>
      </div>
      <Modal open={modal.open} title={modal.title} message={modal.message} onConfirm={() => { setModal({ open: false }); navigate("/student-hub"); }} />
    </StudentLayout>
  );
}