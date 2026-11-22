import { useState, useCallback, useRef } from "react";
import { getQuestionsForGame } from "../models/questionsService.js";
import { saveGameAttempt } from "../models/gameService.js";
import { fisherYates } from "../utils/shuffle.js";
import { supabase } from "../models/supabaseClient.js";

async function checkAndAwardAchievement(patientId, name) {
  try {
    const { data: logro } = await supabase.from("logros").select("id_logro").eq("nombre", name).maybeSingle();
    if (!logro) return false;
    const { data: existing } = await supabase.from("paciente_logros").select("id_paciente_logro").eq("id_paciente", patientId).eq("id_logro", logro.id_logro);
    if (existing && existing.length) return false;
    const { error } = await supabase.from("paciente_logros").insert([{ id_paciente: patientId, id_logro: logro.id_logro }]);
    return !error;
  } catch {
    return false;
  }
}

function clampMax(v) {
  const n = Number(v);
  if (!Number.isFinite(n)) return 5;
  return Math.min(20, Math.max(3, Math.round(n)));
}

export function useGameController() {
  const [questions, setQuestions] = useState([]);
  const [index, setIndex] = useState(0);
  const [score, setScore] = useState({ correct: 0, incorrect: 0 });
  const [maxPreguntas, setMaxPreguntasState] = useState(5);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [paused, setPaused] = useState(false);
  const [timeLeft, setTimeLeft] = useState(null);
  const timerRef = useRef(null);
  const detailsRef = useRef([]);
  const answeredIndexRef = useRef(null);

  const setMaxPreguntas = useCallback((v) => setMaxPreguntasState(clampMax(v)), []);

  const load = useCallback(async (subjectId, cycle, max, enabledUnits) => {
    setLoading(true); setError(null);
    const safeMax = clampMax(max);
    setMaxPreguntasState(safeMax);
    const r = await getQuestionsForGame(subjectId, cycle, safeMax, enabledUnits);
    if (!r.ok) { setError(r.error?.message || "Error"); setLoading(false); return; }
    const list = Array.isArray(r.data) ? r.data : [];
    const shuffledQs = fisherYates(list).map((q) => ({ ...q, answers: fisherYates(Array.isArray(q.answers) ? q.answers : []) }));
    setQuestions(shuffledQs);
    setIndex(0);
    setScore({ correct: 0, incorrect: 0 });
    detailsRef.current = [];
    answeredIndexRef.current = null;
    setLoading(false);
  }, []);

  const restore = useCallback((saved) => {
    if (!saved || typeof saved !== "object") return;
    setMaxPreguntasState(clampMax(saved.maxPreguntas));
    const qs = Array.isArray(saved.questions) ? saved.questions : [];
    setQuestions(qs);
    const idx = Number.isFinite(saved.index) ? Math.max(0, Math.min(qs.length, saved.index)) : 0;
    setIndex(idx);
    const sc = saved.score && typeof saved.score === "object" ? saved.score : { correct: 0, incorrect: 0 };
    setScore({ correct: Number(sc.correct) || 0, incorrect: Number(sc.incorrect) || 0 });
    detailsRef.current = Array.isArray(saved.details) ? saved.details : [];
    answeredIndexRef.current = null;
    setLoading(false);
    setError(null);
  }, []);

  const answer = useCallback((chosen, timeSeconds) => {
    const q = questions[index];
    if (!q) return;
    if (answeredIndexRef.current === index) return; // evita doble conteo
    answeredIndexRef.current = index;
    const isCorrect = !!chosen?.isCorrect;
    if (isCorrect) setScore((s) => ({ ...s, correct: s.correct + 1 }));
    else setScore((s) => ({ ...s, incorrect: s.incorrect + 1 }));
    detailsRef.current.push({ idPregunta: q.id, idRespuesta: chosen?.id || null, isCorrect, timeSeconds });
  }, [questions, index]);

  const next = useCallback(() => {
    setIndex((i) => i + 1);
    answeredIndexRef.current = null;
  }, []);

  const isFinished = questions.length > 0 && index >= questions.length;

  const save = useCallback(async (patientId, subjectName, cycle) => {
    const r = await saveGameAttempt(patientId, subjectName, cycle, score.correct, score.incorrect, detailsRef.current);
    try {
      await checkAndAwardAchievement(patientId, "Primeros Pasos");
      if (score.correct === questions.length && questions.length > 0) await checkAndAwardAchievement(patientId, "Puntaje Perfecto");
    } catch {}
    return r;
  }, [score, questions]);

  const pause = () => setPaused(true);
  const resume = () => setPaused(false);

  return {
    questions, index, score, loading, error, paused, timeLeft,
    load, answer, next, isFinished, save, pause, resume, restore,
    setMaxPreguntas, maxPreguntas: maxPreguntas, current: questions[index], detailsRef,
  };
}