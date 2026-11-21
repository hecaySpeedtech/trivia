const BUFFER_KEY = "trivia_logs";
const MAX = 200;

function load() {
  try { return JSON.parse(localStorage.getItem(BUFFER_KEY) || "[]"); } catch { return []; }
}
function save(b) { localStorage.setItem(BUFFER_KEY, JSON.stringify(b.slice(-MAX))); }

export const logger = {
  log(level, message, meta) {
    const entry = { ts: new Date().toISOString(), level, message, meta: meta || null };
    const b = load();
    b.push(entry);
    save(b);
    if (level === "error") console.error(message, meta);
  },
  info(m, meta) { this.log("info", m, meta); },
  warn(m, meta) { this.log("warn", m, meta); },
  error(m, meta) { this.log("error", m, meta); },
  getLogs() { return load(); },
  clear() { localStorage.removeItem(BUFFER_KEY); },
};

// Captura de errores globales
if (typeof window !== "undefined") {
  window.addEventListener("error", (e) => logger.error(e.message, { stack: e.error?.stack }));
  window.addEventListener("unhandledrejection", (e) => logger.error(String(e.reason)));
}