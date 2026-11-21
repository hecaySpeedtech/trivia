import { createContext, useContext, useState, useEffect } from "react";
import { offlineSync } from "../models/offlineSyncService.js";

const OfflineContext = createContext(null);

export function OfflineProvider({ children }) {
  const [online, setOnline] = useState(navigator.onLine);
  const [pending, setPending] = useState(offlineSync.count());

  useEffect(() => {
    const on = () => setOnline(true);
    const off = () => setOnline(false);
    window.addEventListener("online", on);
    window.addEventListener("offline", off);
    return () => { window.removeEventListener("online", on); window.removeEventListener("offline", off); };
  }, []);

  useEffect(() => {
    const id = setInterval(() => setPending(offlineSync.count()), 2000);
    return () => clearInterval(id);
  }, []);

  const syncNow = async (handlers) => {
    const r = await offlineSync.syncNow(handlers);
    setPending(offlineSync.count());
    return r;
  };

  return (
    <OfflineContext.Provider value={{ online, pending, syncNow }}>
      {children}
    </OfflineContext.Provider>
  );
}

export function useOffline() { return useContext(OfflineContext); }