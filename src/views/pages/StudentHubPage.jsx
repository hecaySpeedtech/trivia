import { useNavigate } from "react-router-dom";
import { useSession } from "../../controllers/SessionContext.jsx";
import ReAuthModal from "../components/ReAuthModal.jsx";
import { useState } from "react";

export default function StudentHubPage() {
  const navigate = useNavigate();
  const session = useSession();
  const [reauth, setReauth] = useState(false);
  const patient = session.activePatient;
  const activeGame = session.activeGame;

  if (!patient) {
    return <div className="p-8 text-center">No hay perfil seleccionado. <button className="text-primary underline" onClick={() => navigate("/profiles")}>Volver</button></div>;
  }

  return (
    <div className="min-h-screen bg-bg flex flex-col items-center justify-center p-6">
      <h1 className="text-2xl font-bold mb-2">Hola, {patient.name}!</h1>
      <p className="text-gray-600 mb-6">¿Qué querés hacer?</p>
      <div className="flex gap-4 flex-wrap justify-center">
        {activeGame && <button onClick={() => navigate("/game")} className="bg-green-600 text-white px-6 py-4 rounded-xl text-lg shadow">Continuar partida</button>}
        <button onClick={() => navigate("/subjects")} className="bg-primary text-white px-6 py-4 rounded-xl text-lg shadow">Jugar</button>
        <button onClick={() => navigate("/recreation")} className="bg-secondary text-white px-6 py-4 rounded-xl text-lg shadow">Dibujar</button>
      </div>
      <div className="mt-8 flex gap-4">
        <button onClick={() => { session.update({ activePatient: null }); navigate("/profiles"); }} className="text-gray-500 underline text-sm">Cambiar perfil</button>
        <button onClick={() => setReauth(true)} className="text-gray-500 underline text-sm">Salir (docente)</button>
      </div>
      <ReAuthModal open={reauth} onSuccess={() => { setReauth(false); navigate("/dashboard"); }} onCancel={() => setReauth(false)} />
    </div>
  );
}