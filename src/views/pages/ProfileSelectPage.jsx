import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useSession } from "../../controllers/SessionContext.jsx";
import { getPatientsList } from "../../models/patientsService.js";
import ReAuthModal from "../components/ReAuthModal.jsx";

export default function ProfileSelectPage() {
  const navigate = useNavigate();
  const session = useSession();
  const [patients, setPatients] = useState([]);
  const [reauth, setReauth] = useState(false);

  useEffect(() => { (async () => { const r = await getPatientsList(); if (r.ok) setPatients(r.data); })(); }, []);

  const pick = (p) => {
    session.update({ activePatient: { id: p.id, name: p.name, avatarUrl: p.avatar_url } });
    navigate("/student-hub");
  };

  return (
    <div className="min-h-screen bg-bg p-6">
      <h1 className="text-2xl font-bold text-center mb-6">¿Quién eres?</h1>
      <div className="grid grid-cols-2 md:grid-cols-3 gap-4 max-w-4xl mx-auto">
        {patients.map((p) => (
          <button key={p.id} onClick={() => pick(p)} className="bg-white p-4 rounded-xl shadow hover:shadow-lg text-center">
            <img src={p.avatar_url || `https://api.dicebear.com/7.x/bottts/svg?seed=${p.id}`} alt="" className="w-20 h-20 mx-auto rounded-full mb-2" />
            <div className="font-medium">{p.name}</div>
          </button>
        ))}
      </div>
      <div className="text-center mt-6">
        <button onClick={() => setReauth(true)} className="text-primary underline">Panel de Control (docente)</button>
      </div>
      <ReAuthModal open={reauth} onSuccess={() => { setReauth(false); navigate("/dashboard"); }} onCancel={() => setReauth(false)} />
    </div>
  );
}