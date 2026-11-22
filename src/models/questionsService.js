import { supabase, _ok, _fail } from "./supabaseClient.js";

export async function getAllQuestions() {
  const { data, error } = await supabase.from("preguntas")
    .select("id_pregunta, texto_pregunta, ciclo, unidad, media_url, media_type, materias(nombre), respuestas(id_respuesta, texto_respuesta, es_correcta)")
    .order("fecha_creacion", { ascending: false });
  if (error) return _fail(error);
  return _ok((data || []).map((q) => ({
    id: q.id_pregunta, text: q.texto_pregunta, cycle: q.ciclo, unit: q.unidad,
    mediaUrl: q.media_url, mediaType: q.media_type,
    subjectName: q.materias ? q.materias.nombre : "Sin Materia",
    answers: (q.respuestas || []).map((r) => ({ id: r.id_respuesta, text: r.texto_respuesta, isCorrect: r.es_correcta })),
  })));
}

export async function getQuestionsForGame(subjectId, cycle, maxQuestions, enabledUnits) {
  let query = supabase.from("preguntas")
    .select("id_pregunta, texto_pregunta, ciclo, unidad, media_url, media_type, respuestas(id_respuesta, texto_respuesta, es_correcta)")
    .eq("id_materia", subjectId).eq("ciclo", cycle);
  const { data, error } = await query;
  if (error) return _fail(error);
  let valid = (data || []).filter((q) => q.respuestas && q.respuestas.length >= 2);
  if (enabledUnits && enabledUnits.length) {
    valid = valid.filter((q) => !q.unidad || enabledUnits.includes(q.unidad));
  }
  valid = valid.map((q) => ({
    id: q.id_pregunta, text: q.texto_pregunta, unit: q.unidad,
    mediaUrl: q.media_url, mediaType: q.media_type,
    answers: q.respuestas.map((r) => ({ id: r.id_respuesta, text: r.texto_respuesta, isCorrect: r.es_correcta })),
  }));
  if (maxQuestions && maxQuestions > 0) valid = valid.slice(0, maxQuestions);
  return _ok(valid);
}

export async function createQuestionWithAnswers(subjectId, questionText, cycle, answers, unit, mediaUrl, mediaType) {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) return _fail({ message: "No hay sesión activa." });
  const { data: qData, error: qError } = await supabase.from("preguntas").insert([{
    id_materia: subjectId, texto_pregunta: questionText, ciclo: cycle,
    creado_por: session.user.id, unidad: unit || null,
    media_url: mediaUrl || null, media_type: mediaType || "none",
  }]).select().single();
  if (qError) return _fail(qError);
  const answersToInsert = answers.map((ans) => ({
    id_pregunta: qData.id_pregunta, texto_respuesta: ans.text, es_correcta: ans.isCorrect,
  }));
  const { error: aError } = await supabase.from("respuestas").insert(answersToInsert);
  if (aError) {
    await supabase.from("preguntas").delete().eq("id_pregunta", qData.id_pregunta);
    return _fail(aError);
  }
  return _ok(qData);
}

export async function updateQuestion(questionId, patch) {
  const { error } = await supabase.from("preguntas").update(patch).eq("id_pregunta", questionId);
  return error ? _fail(error) : _ok();
}

export async function updateQuestionWithAnswers(questionId, subjectId, questionText, cycle, answers, unit, mediaUrl, mediaType) {
  const { error: qError } = await supabase.from("preguntas").update({
    id_materia: subjectId, texto_pregunta: questionText, ciclo: cycle,
    unidad: unit || null, media_url: mediaUrl || null, media_type: mediaType || "none",
  }).eq("id_pregunta", questionId);
  if (qError) return _fail(qError);
  await supabase.from("respuestas").delete().eq("id_pregunta", questionId);
  const answersToInsert = answers.map((ans) => ({
    id_pregunta: questionId, texto_respuesta: ans.text, es_correcta: ans.isCorrect,
  }));
  const { error: aError } = await supabase.from("respuestas").insert(answersToInsert);
  if (aError) return _fail(aError);
  return _ok({ id: questionId });
}

export async function deleteQuestion(questionId) {
  const { error } = await supabase.from("preguntas").delete().eq("id_pregunta", questionId);
  return error ? _fail(error) : _ok();
}

export async function deleteAnswersByQuestion(questionId) {
  const { error } = await supabase.from("respuestas").delete().eq("id_pregunta", questionId);
  return error ? _fail(error) : _ok();
}