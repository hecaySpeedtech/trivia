import { supabase, _ok, _fail } from "./supabaseClient.js";

export async function saveGameAttempt(patientId, subjectName, cycle, correct, incorrect, details) {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) return _fail({ message: "No hay sesión activa." });
  const { data, error } = await supabase.from("intentos").insert([{
    id_paciente: patientId, nombre_materia: subjectName, ciclo: cycle,
    respuestas_correctas: correct, respuestas_incorrectas: incorrect,
    puntaje_total: correct, creado_por: session.user.id,
  }]).select().single();
  if (error) return _fail(error);
  if (details && details.length && data) {
    const rows = details.map((d) => ({
      id_intento: data.id_intento, id_pregunta: d.idPregunta,
      id_respuesta_elegida: d.idRespuesta, es_correcta: d.isCorrect,
      tiempo_respuesta_segundos: d.timeSeconds || null,
    }));
    await supabase.from("intento_detalles").insert(rows);
  }
  return _ok(data);
}

export async function getTeacherMetrics() {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) return _fail({ message: "No hay sesión activa." });
  const { data, error } = await supabase.from("intentos")
    .select("respuestas_correctas, respuestas_incorrectas").eq("creado_por", session.user.id);
  if (error) return _fail(error);
  let totalCorrect = 0, totalIncorrect = 0;
  (data || []).forEach((r) => { totalCorrect += r.respuestas_correctas || 0; totalIncorrect += r.respuestas_incorrectas || 0; });
  return _ok({ totalCorrect, totalIncorrect, totalAttempts: (data || []).length });
}

export async function getPatientHistory(patientId) {
  const { data, error } = await supabase.from("intentos").select("*").eq("id_paciente", patientId).order("fecha_creacion", { ascending: false });
  if (error) return _fail(error);
  return _ok(data || []);
}

export async function deleteAttempt(attemptId) {
  const { error } = await supabase.from("intentos").delete().eq("id_intento", attemptId);
  return error ? _fail(error) : _ok();
}