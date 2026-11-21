import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useSession } from "../../controllers/SessionContext.jsx";
import StudentLayout from "../components/StudentLayout.jsx";
import { useGameController } from "../../controllers/useGameController.js";
import { getSettings } from "../../models/settingsService.js";
import { useAuth } from "../../controllers/AuthContext.jsx";

export default function GamePage() {
  const navigate = useNavigate();
  const session = useSession();
  const { user } = useAuth();
  const gc = useGameController();
  const [answered, setAnswered] = useState(null); // chosen answer
  const [showContinue, setShowContinue] = useState(false);

  useEffect(() => {
    const patient = session.activePatient;
    const subject = session.activeSubject;
    const cycle = session.activeCycle;
    if (!patient || !subject || !cycle) { navigate("/subjects"); return; }
    (async () => {
      let max = 10;
      if (user) { const s = await getSettings(user.id); if (s.ok && s.data) max = s.data.max_preguntas || max; }
      gc.setMaxPreguntas(max);
      await gc.load(subject.id, cycle, max);
    })();
  }, []);

  const q = gc.current;
  const handleAnswer = (ans) => {
    if (answered) return;
    setAnswered(ans);
    gc.answer(ans, 0);
    setShowContinue(true);
  };

  const cont = () => {
    setAnswered(null); setShowContinue(false);
    if (gc.index + 1 >= gc.questions.length) {
      session.update({ lastScore: gc.score });
      gc.save(session.activePatient.id, session.activeSubject.name, session.activeCycle).then(() => navigate("/results"));
    } else {
      gc.next();
    }
  };

  if (gc.loading) return <StudentLayout><div>Cargando preguntas...</div></StudentLayout>;
  if (gc.error) return <StudentLayout><div className="text-accent">{gc.error}</div></StudentLayout>;
  if (!q) return <StudentLayout><div>No hay preguntas. <button onClick={() => navigate("/subjects")} className="text-primary underline">Volver</button></div></StudentLayout>;

  return (
    <StudentLayout>
      <div className="mb-2 text-sm text-gray-500">Pregunta {gc.index + 1} / {gc.questions.length}</div>
      <h2 className="text-xl font-bold mb-4">{q.text}</h2>
      <div className="grid gap-2">
        {q.answers.map((a, i) => {
          let cls = "bg-white border rounded p-3 text-left";
          if (answered) {
            if (a.isCorrect) cls = "bg-green-100 border-green-500 rounded p-3 text-left";
            else if (answered.id === a.id) cls = "bg-red-100 border-red-500 rounded p-3 text-left";
          }
          return (
            <button key={a.id || i} disabled={!!answered} onClick={() => handleAnswer(a)} className={cls}>{a.text}</button>
          );
        })}
      </div>
      {showContinue && (
        <button onClick={cont} className="mt-4 bg-primary text-white px-4 py-2 rounded">Continuar</button>
      )}
    </StudentLayout>
  );
}