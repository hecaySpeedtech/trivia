import { supabase, _ok, _fail } from "./supabaseClient.js";

export async function getSubjectsList() {
  const { data, error } = await supabase.from("materias").select("*").order("fecha_creacion");
  if (error) return _fail(error);
  return _ok((data || []).map((m) => ({ id: m.id_materia, name: m.nombre, es_publica: m.es_publica, creado_por: m.creado_por })));
}

export async function createSubject(name, isPublic = false) {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) return _fail({ message: "No hay sesión activa." });
  const { data, error } = await supabase.from("materias")
    .insert([{ nombre: name, es_publica: isPublic, creado_por: session.user.id }])
    .select().single();
  if (error) return _fail(error);
  return _ok({ id: data.id_materia, name: data.nombre });
}

export async function updateSubject(subjectId, patch) {
  const { error } = await supabase.from("materias").update(patch).eq("id_materia", subjectId);
  return error ? _fail(error) : _ok();
}

export async function deleteSubject(subjectId) {
  const { error } = await supabase.from("materias").delete().eq("id_materia", subjectId);
  return error ? _fail(error) : _ok();
}