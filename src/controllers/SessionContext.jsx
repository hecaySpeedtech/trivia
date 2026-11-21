import { createContext, useContext, useState } from "react";

const KEY = "trivia_session";
const SessionContext = createContext(null);

function load() { try { return JSON.parse(localStorage.getItem(KEY) || "{}"); } catch { return {}; } }
function save(s) { localStorage.setItem(KEY, JSON.stringify(s)); }

export function SessionProvider({ children }) {
  const [state, setState] = useState(() => load());

  const update = (patch) => {
    setState((prev) => { const next = { ...prev, ...patch }; save(next); return next; });
  };

  const clear = () => { localStorage.removeItem(KEY); setState({}); };

  return (
    <SessionContext.Provider value={{ ...state, update, clear }}>
      {children}
    </SessionContext.Provider>
  );
}

export function useSession() { return useContext(SessionContext); }