import { supabase, _ok, _fail } from "./supabaseClient.js";

export async function getPatientsList() {
  const { data, error } = await supabase.from("pacientes").select("*").order("nombre");
  if (error) return _fail(error);
  return _ok((data || []).map((p) => ({
    id: p.id_paciente, name: p.nombre, avatar_url: p.avatar_url,
    created_at: p.fecha_creacion,
  })));
}

export async function createPatient(name) {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) return _fail({ message: "No hay sesión activa." });
  const { data, error } = await supabase.from("pacientes")
    .insert([{ nombre: name, creado_por: session.user.id }])
    .select().single();
  if (error) return _fail(error);
  return _ok({ id: data.id_paciente, name: data.nombre, avatar_url: data.avatar_url, created_at: data.fecha_creacion });
}

export async function updatePatient(patientId, patch) {
  const { error } = await supabase.from("pacientes").update(patch).eq("id_paciente", patientId);
  return error ? _fail(error) : _ok();
}

export async function updatePatientAvatar(patientId, avatarUrl) {
  return updatePatient(patientId, { avatar_url: avatarUrl });
}

export async function deletePatient(patientId) {
  const { error } = await supabase.from("pacientes").delete().eq("id_paciente", patientId);
  return error ? _fail(error) : _ok();
}