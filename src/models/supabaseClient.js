import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY;

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  db: { schema: "app" },
});

// Factory de cliente efimero (para registrar docente sin desloguear al admin)
export function createEphemeralClient() {
  return createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    db: { schema: "app" },
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

export const _ok = (data = null) => ({ ok: true, data });
export const _fail = (error = {}) => ({ ok: false, error });