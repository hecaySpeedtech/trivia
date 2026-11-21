import { useState, useCallback, useRef } from "react";
import { getQuestionsForGame } from "../models/questionsService.js";
import { saveGameAttempt } from "../models/gameService.js";
import { fisherYates } from "../utils/shuffle.js";

// achievements helper inline
import { supabase } from "../models/supabaseClient.js";

async function checkAndAwardAchievement(patientId, name) {
  const { data: logro } = await supabase.from("logros").select("id_logro").eq("nombre", name).maybeSingle();
  if (!logro) return false;
  const { data: existing } = await supabase.from("paciente_logros").select("id_paciente_logro").eq("id_paciente", patientId).eq("id_logro", logro.id_logro);
  if (existing && existing.length) return false;
  const { error } = await supabase.from("paciente_logros").insert([{ id_paciente: patientId, id_logro: logro.id_logro }]);
  return !error;
}

export function useGameController() {
  const [questions, setQuestions] = useState([]);
  const [index, setIndex] = useState(0);
  const [score, setScore] = useState({ correct: 0, incorrect: 0 });
  const [maxPreguntas, setMaxPreguntas] = useState(10);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [paused, setPaused] = useState(false);
  const [timeLeft, setTimeLeft] = useState(null);
  const timerRef = useRef(null);
  const detailsRef = useRef([]);

  const load = useCallback(async (subjectId, cycle, max) => {
    setLoading(true); setError(null);
    const r = await getQuestionsForGame(subjectId, cycle, max || maxPreguntas);
    if (!r.ok) { setError(r.error?.message || "Error"); setLoading(false); return; }
    const shuffledQs = fisherYates(r.data).map((q) => ({ ...q, answers: fisherYates(q.answers) }));
    setQuestions(shuffledQs);
    setIndex(0);
    setScore({ correct: 0, incorrect: 0 });
    detailsRef.current = [];
    setLoading(false);
  }, [maxPreguntas]);

  const answer = useCallback((chosen, timeSeconds) => {
    const q = questions[index];
    if (!q) return;
    const isCorrect = !!chosen?.isCorrect;
    if (isCorrect) setScore((s) => ({ ...s, correct: s.correct + 1 }));
    else setScore((s) => ({ ...s, incorrect: s.incorrect + 1 }));
    detailsRef.current.push({ idPregunta: q.id, idRespuesta: chosen?.id || null, isCorrect, timeSeconds });
  }, [questions, index]);

  const next = useCallback(() => {
    setIndex((i) => i + 1);
  }, []);

  const isFinished = questions.length > 0 && index >= questions.length;

  const save = useCallback(async (patientId, subjectName, cycle) => {
    const r = await saveGameAttempt(patientId, subjectName, cycle, score.correct, score.incorrect, detailsRef.current);
    // achievements
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
    load, answer, next, isFinished, save, pause, resume,
    setMaxPreguntas, maxPreguntas, current: questions[index],
  };
}