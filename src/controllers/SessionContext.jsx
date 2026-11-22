import { createContext, useContext, useState } from "react";

const KEY = "trivia_session";
const SessionContext = createContext(null);

function isValidState(s) {
  return !!s && typeof s === "object" && !Array.isArray(s);
}

function load() {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    if (!isValidState(parsed)) return {};
    if (parsed.activeGame) {
      const ag = parsed.activeGame;
      if (!ag || !Array.isArray(ag.questions) || ag.questions.length === 0) parsed.activeGame = null;
      if (ag && typeof ag.index === "number" && ag.questions && ag.index >= ag.questions.length && ag.questions.length > 0) ag.index = 0;
      if (ag && ag.patient === null) parsed.activeGame = null;
    }
    return parsed;
  } catch {
    try { localStorage.removeItem(KEY); } catch {}
    return {};
  }
}

function save(s) {
  try { localStorage.setItem(KEY, JSON.stringify(s)); } catch {}
}

export function SessionProvider({ children }) {
  const [state, setState] = useState(() => load());

  const update = (patch) => {
    setState((prev) => {
      const next = { ...prev, ...(patch || {}) };
      // Validar activeGame si viene
      if (next.activeGame && (!next.activeGame.questions || !Array.isArray(next.activeGame.questions))) {
        next.activeGame = null;
      }
      save(next);
      return next;
    });
  };

  const clear = () => { try { localStorage.removeItem(KEY); } catch {} setState({}); };

  return (
    <SessionContext.Provider value={{ ...state, update, clear }}>
      {children}
    </SessionContext.Provider>
  );
}

export function useSession() { return useContext(SessionContext); }