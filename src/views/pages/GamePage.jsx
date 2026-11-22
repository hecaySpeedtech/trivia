import { useEffect, useState, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { useSession } from "../../controllers/SessionContext.jsx";
import StudentLayout from "../components/StudentLayout.jsx";
import { useGameController } from "../../controllers/useGameController.js";
import { getSettings, getEstadoUnidades } from "../../models/settingsService.js";
import { useAuth } from "../../controllers/AuthContext.jsx";
import { useOffline } from "../../controllers/OfflineContext.jsx";
import { offlineSync } from "../../models/offlineSyncService.js";
import { CheckCircle, XCircle } from "lucide-react";
import { feedbackFor } from "../../utils/feedbackMessages.js";

export default function GamePage() {
  const navigate = useNavigate();
  const session = useSession();
  const { user } = useAuth();
  const offline = useOffline();
  const gc = useGameController();
  const [answered, setAnswered] = useState(null);
  const [showContinue, setShowContinue] = useState(false);
  const [startTs, setStartTs] = useState(null);
  const questionStart = useRef(Date.now());

  useEffect(() => {
    const patient = session.activePatient;
    const subject = session.activeSubject;
    const cycle = session.activeCycle;
    if (!patient || !subject || !cycle) { navigate("/subjects"); return; }

    (async () => {

      const saved = session.activeGame;
      if (saved && saved.subject?.id === subject.id && saved.cycle === cycle) {
        gc.restore(saved);
        setStartTs(Date.now());
        questionStart.current = Date.now();
        return;
      }

      let max = 5;
      let enabledUnits = [];
      if (user) {
        const s = await getSettings(user.id);
        if (s.ok && s.data && s.data.max_preguntas) max = s.data.max_preguntas;
        const u = await getEstadoUnidades(user.id);
        if (u.ok) {
          enabledUnits = (u.data || [])
            .filter((x) => x.id_materia === subject.id && x.ciclo === cycle && x.habilitada)
            .map((x) => x.unidad);
        }
      }
      gc.setMaxPreguntas(max);
      await gc.load(subject.id, cycle, max, enabledUnits);
      session.update({
        activeGame: {
          subject, cycle, maxPreguntas: max, patient,
          questions: [], index: 0, score: { correct: 0, incorrect: 0 }, details: [],
        },
      });
      setStartTs(Date.now());
      questionStart.current = Date.now();
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);


  useEffect(() => {
    if (!gc.questions || !gc.questions.length) return;
    const subject = session.activeSubject;
    const cycle = session.activeCycle;
    const patient = session.activePatient;
    session.update({
      activeGame: {
        subject, cycle, maxPreguntas: gc.maxPreguntas, patient,
        questions: gc.questions, index: gc.index, score: gc.score,
        details: gc.detailsRef?.current || [],
      },
    });
  }, [gc.index, gc.score, gc.questions]);

  const q = gc.current;

  const handleAnswer = (ans) => {
    if (answered) return;
    const secs = Math.round((Date.now() - questionStart.current) / 1000);
    setAnswered(ans);
    gc.answer(ans, secs);
    setShowContinue(true);
  };

  const cont = () => {
    setAnswered(null); setShowContinue(false);
    questionStart.current = Date.now();
    if (gc.index + 1 >= gc.questions.length) {
      const finalScore = gc.score;

      const doSave = async () => {
        const payload = {
          patientId: session.activePatient.id,
          subjectName: session.activeSubject.name,
          cycle: session.activeCycle,
          correct: finalScore.correct,
          incorrect: finalScore.incorrect,
          details: gc.detailsRef?.current || [],
          total: gc.questions.length,
        };
        if (!navigator.onLine) {
          offlineSyncEnqueue(payload);
          session.update({ lastScore: finalScore, activeGame: null });
          navigate("/results");
          return;
        }
        try {
          await gc.save(session.activePatient.id, session.activeSubject.name, session.activeCycle);
          session.update({ lastScore: finalScore, activeGame: null });
          navigate("/results");
        } catch {
          offlineSyncEnqueue(payload);
          session.update({ lastScore: finalScore, activeGame: null });
          navigate("/results");
        }
      };
      doSave();
    } else {
      gc.next();
    }
  };

  const pause = () => {
    session.update({ activeGame: {
      subject: session.activeSubject, cycle: session.activeCycle, maxPreguntas: gc.maxPreguntas,
      patient: session.activePatient, questions: gc.questions, index: gc.index, score: gc.score,
      details: gc.detailsRef?.current || [],
    }});
    navigate("/student-hub");
  };

  if (gc.loading) return <StudentLayout><div>Cargando preguntas...</div></StudentLayout>;
  if (gc.error) return <StudentLayout><div className="text-accent">{gc.error}</div></StudentLayout>;
  if (!q) return <StudentLayout><div>No hay preguntas. <button onClick={() => navigate("/subjects")} className="text-primary underline">Volver</button></div></StudentLayout>;

  const feedbackText = answered ? (answered.isCorrect ? "¡Correcto!" : "Incorrecto, seguí intentando") : "";

  return (
    <StudentLayout>
      <div className="flex justify-between items-center mb-2">
        <div className="text-sm text-gray-500">Pregunta {gc.index + 1} / {gc.questions.length}</div>
        <button onClick={pause} className="text-xs bg-gray-200 px-2 py-1 rounded">Pausar y volver</button>
      </div>
      <h2 className="text-xl font-bold mb-4">{q.text}</h2>
      {q.mediaUrl && (
        <div className="mb-4">
          {q.mediaType === "image" && <img src={q.mediaUrl} alt="" className="max-w-full rounded" />}
          {q.mediaType === "audio" && <audio controls src={q.mediaUrl} className="w-full" />}
          {q.mediaType === "video" && <video controls src={q.mediaUrl} className="max-w-full rounded" />}
        </div>
      )}
      <div className="grid gap-2">
        {q.answers.map((a, i) => {
          let cls = "bg-white border rounded p-3 text-left";
          if (answered) {
            if (a.isCorrect) cls = "bg-green-100 border-green-500 rounded p-3 text-left";
            else if (answered.id === a.id) cls = "bg-red-100 border-red-500 rounded p-3 text-left";
          }
          return (
            <button key={a.id || i} disabled={!!answered} onClick={() => handleAnswer(a)} className={cls}>
              {a.text}
            </button>
          );
        })}
      </div>
      {answered && (
        <div className={`mt-4 flex items-center gap-2 ${answered.isCorrect ? "text-green-700" : "text-red-700"}`}>
          {answered.isCorrect ? <CheckCircle /> : <XCircle />}
          <span className="font-medium">{feedbackText}</span>
        </div>
      )}
      {showContinue && (
        <button onClick={cont} className="mt-4 bg-primary text-white px-4 py-2 rounded">Continuar</button>
      )}
      {answered && (
        <p className="mt-2 text-sm text-gray-600 italic">{feedbackFor(gc.score.correct, gc.index + 1)}</p>
      )}
    </StudentLayout>
  );
}

function offlineSyncEnqueue(payload) {
  try {
    offlineSync.enqueue({ type: "attempt", payload: { ...payload, details: payload.details } });
  } catch {}
}