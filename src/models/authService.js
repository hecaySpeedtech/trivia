import { supabase, createEphemeralClient, _ok, _fail } from "./supabaseClient.js";

export async function getSession() {
  const { data: { session }, error } = await supabase.auth.getSession();
  if (error) return null;
  return session;
}

export async function login(email, password) {
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) return _fail(error);
  return _ok(data.user);
}

export async function logout() {
  const { error } = await supabase.auth.signOut();
  return error ? _fail(error) : _ok();
}

export async function getProfile(userId) {
  const { data, error } = await supabase
    .from("docentes")
    .select("id_docente, email, nombre, rol")
    .eq("id_docente", userId)
    .maybeSingle();
  if (error) return _fail(error);
  return _ok(data);
}

export async function registerTeacher(email, password) {
  const client = createEphemeralClient();
  const { data, error } = await client.auth.signUp({ email, password });
  if (error) return _fail(error);
  return _ok(data);
}

export async function verifyPassword(email, password) {
  const client = createEphemeralClient();
  const { error } = await client.auth.signInWithPassword({ email, password });
  return !error;
}