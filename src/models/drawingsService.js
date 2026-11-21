import { supabase, _ok, _fail } from "./supabaseClient.js";

export async function saveDrawingUrl(patientId, imageUrl) {
  const { data, error } = await supabase.from("dibujos").insert([{ id_paciente: patientId, imagen_url: imageUrl }]).select().single();
  if (error) return _fail(error);
  return _ok(data);
}

export async function getPatientDrawings(patientId) {
  const { data, error } = await supabase.from("dibujos").select("*").eq("id_paciente", patientId).order("fecha_creacion", { ascending: false });
  if (error) return _fail(error);
  return _ok(data || []);
}

export async function deleteDrawing(drawingId) {
  const { error } = await supabase.from("dibujos").delete().eq("id_dibujo", drawingId);
  return error ? _fail(error) : _ok();
}