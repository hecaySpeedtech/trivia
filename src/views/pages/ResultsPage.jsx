import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useSession } from "../../controllers/SessionContext.jsx";
import StudentLayout from "../components/StudentLayout.jsx";
import { feedbackFor } from "../../utils/feedbackMessages.js";
import confetti from "canvas-confetti";

export default function ResultsPage() {
  const navigate = useNavigate();
  const session = useSession();
  const subject = session.activeSubject;
  const cycle = session.activeCycle;
  useEffect(() => {
    if (!session.lastScore) navigate("/student-hub", { replace: true });
  }, [session.lastScore, navigate]);
  // score is passed via session? We'll read from a saved field; fallback 0
  const [score] = useState(session.lastScore || { correct: 0, incorrect: 0 });
  const total = score.correct + score.incorrect;
  const pct = total ? Math.round((score.correct / total) * 100) : 0;

  useEffect(() => {
    if (pct === 100) {
      confetti({ particleCount: 120, spread: 70, origin: { y: 0.6 } });
    }
  }, [pct]);

  return (
    <StudentLayout>
      <div className="text-center">
        <h1 className="text-2xl font-bold mb-2">Resultados</h1>
        <p className="text-gray-600 mb-4">{subject?.name} — {cycle}</p>
        <div className="text-5xl font-bold text-primary mb-2">{pct}%</div>
        <p className="mb-4">{score.correct} correctas / {score.incorrect} incorrectas</p>
        <p className="italic text-gray-700 mb-6">{feedbackFor(score.correct, total)}</p>
        <div className="flex gap-3 justify-center">
          <button onClick={() => navigate("/subjects")} className="bg-primary text-white px-4 py-2 rounded">Jugar otra materia</button>
          <button onClick={() => navigate("/recreation")} className="bg-secondary text-white px-4 py-2 rounded">Ir a Dibujar</button>
        </div>
      </div>
    </StudentLayout>
  );
}