const KEY = "trivia_offline_queue";

function load() {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed;
  } catch {
    try { localStorage.removeItem(KEY); } catch {}
    return [];
  }
}

function save(q) {
  try {
    localStorage.setItem(KEY, JSON.stringify(q));
    return true;
  } catch (e) {
    return false;
  }
}

let syncing = false;

export const offlineSync = {
  enqueue(item) {
    const q = load();
    q.push({ ...item, ts: Date.now() });
    const ok = save(q);
    if (!ok) throw new Error("QuotaExceeded");
  },
  pending() { return load(); },
  count() { return load().length; },
  async syncNow(handlers) {
    if (syncing) return { ok: true, synced: 0, remaining: load().length, skipped: true };
    syncing = true;
    try {
      const q = load();
      if (!q.length) return { ok: true, synced: 0 };
      const remaining = [];
      let synced = 0;
      for (const item of q) {
        try {
          if (handlers && handlers[item.type]) {
            await handlers[item.type](item.payload);
            synced++;
          } else {
            remaining.push(item);
          }
        } catch {
          remaining.push(item);
        }
      }
      save(remaining);
      return { ok: true, synced, remaining: remaining.length };
    } finally {
      syncing = false;
    }
  },
  clear() { try { localStorage.removeItem(KEY); } catch {} },
};