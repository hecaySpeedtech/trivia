import { supabase, _ok, _fail } from "./supabaseClient.js";

export async function getSettings(docenteId) {
  const { data, error } = await supabase.from("ajustes").select("*").eq("id_docente", docenteId).maybeSingle();
  if (error) return _fail(error);
  return _ok(data);
}

export async function saveSettings(docenteId, maxPreguntas) {
  const { error } = await supabase.from("ajustes").upsert({ id_docente: docenteId, max_preguntas: maxPreguntas }, { onConflict: "id_docente" });
  return error ? _fail(error) : _ok();
}

export async function getEstadoUnidades(docenteId) {
  const { data, error } = await supabase.from("estado_unidades").select("*").eq("id_docente", docenteId);
  if (error) return _fail(error);
  return _ok(data || []);
}

export async function toggleUnidad(idEstado, habilitada) {
  const { error } = await supabase.from("estado_unidades").update({ habilitada }).eq("id_estado", idEstado);
  return error ? _fail(error) : _ok();
}

export async function getCycles() {
  const { data, error } = await supabase.from("cycles").select("*");
  if (error) return _fail(error);
  return _ok(data || []);
}