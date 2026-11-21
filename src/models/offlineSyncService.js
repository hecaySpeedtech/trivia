const KEY = "trivia_offline_queue";

function load() { try { return JSON.parse(localStorage.getItem(KEY) || "[]"); } catch { return []; } }
function save(q) { localStorage.setItem(KEY, JSON.stringify(q)); }

export const offlineSync = {
  enqueue(item) { const q = load(); q.push({ ...item, ts: Date.now() }); save(q); },
  pending() { return load(); },
  count() { return load().length; },
  async syncNow(handlers) {
    const q = load();
    if (!q.length) return { ok: true, synced: 0 };
    const remaining = [];
    let synced = 0;
    for (const item of q) {
      try {
        if (handlers[item.type]) { await handlers[item.type](item.payload); synced++; }
        else remaining.push(item);
      } catch { remaining.push(item); }
    }
    save(remaining);
    return { ok: true, synced, remaining: remaining.length };
  },
  clear() { localStorage.removeItem(KEY); },
};