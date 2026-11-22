import { createContext, useContext, useState, useEffect, useCallback } from "react";
import { offlineSync } from "../models/offlineSyncService.js";
import { saveGameAttempt } from "../models/gameService.js";
import { saveDrawingUrl } from "../models/drawingsService.js";
import { supabase } from "../models/supabaseClient.js";

async function award(patientId, name) {
  try {
    const { data: logro } = await supabase.from("logros").select("id_logro").eq("nombre", name).maybeSingle();
    if (!logro) return;
    const { data: ex } = await supabase.from("paciente_logros").select("id_paciente_logro").eq("id_paciente", patientId).eq("id_logro", logro.id_logro);
    if (!ex || !ex.length) await supabase.from("paciente_logros").insert([{ id_paciente: patientId, id_logro: logro.id_logro }]);
  } catch {}
}

const handlers = {
  async attempt(payload) {
    const r = await saveGameAttempt(payload.patientId, payload.subjectName, payload.cycle, payload.correct, payload.incorrect, payload.details);
    if (r.ok) {
      await award(payload.patientId, "Primeros Pasos");
      if (payload.correct === payload.total && payload.total > 0) await award(payload.patientId, "Puntaje Perfecto");
    }
    return r;
  },
  async drawing(payload) {
    const r = await saveDrawingUrl(payload.patientId, payload.imageUrl);
    if (r.ok) await award(payload.patientId, "Pequeño Artista");
    return r;
  },
};

const OfflineContext = createContext(null);

export function OfflineProvider({ children }) {
  const [online, setOnline] = useState(navigator.onLine);
  const [pending, setPending] = useState(offlineSync.count());

  const refreshPending = useCallback(() => setPending(offlineSync.count()), []);

  const syncNow = useCallback(async () => {
    const r = await offlineSync.syncNow(handlers);
    refreshPending();
    return r;
  }, [refreshPending]);

  useEffect(() => {
    const on = async () => { setOnline(true); await syncNow(); };
    const off = () => setOnline(false);
    window.addEventListener("online", on);
    window.addEventListener("offline", off);
    return () => { window.removeEventListener("online", on); window.removeEventListener("offline", off); };
  }, [syncNow]);

  useEffect(() => {
    const id = setInterval(refreshPending, 2000);
    return () => clearInterval(id);
  }, [refreshPending]);

  return (
    <OfflineContext.Provider value={{ online, pending, syncNow }}>
      {children}
    </OfflineContext.Provider>
  );
}

export function useOffline() { return useContext(OfflineContext); }