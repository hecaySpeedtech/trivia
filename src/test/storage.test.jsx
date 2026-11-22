import { describe, it, expect, beforeEach, vi } from "vitest";
import { render } from "@testing-library/react";
import React from "react";
import { SessionProvider, useSession } from "../controllers/SessionContext.jsx";
import { logger } from "../models/loggerService.js";
import { offlineSync } from "../models/offlineSyncService.js";

function Probe() {
  const s = useSession();
  return <div data-testid="x">{JSON.stringify(s)}</div>;
}

describe("SessionContext localStorage corrupto", () => {
  it("no crashea con JSON malformado", () => {
    localStorage.setItem("trivia_session", "{corrupto");
    const { container } = render(<SessionProvider><Probe /></SessionProvider>);
    expect(container.textContent).toContain("{}");
  });
  it("limpia activeGame incompleto", () => {
    localStorage.setItem("trivia_session", JSON.stringify({ activeGame: { questions: [] }, activePatient: null }));
    const { container } = render(<SessionProvider><Probe /></SessionProvider>);
    // activeGame debe ser null por validacion
    expect(container.textContent).not.toContain('"activeGame":{"questions":[]');
  });
});

describe("loggerService", () => {
  it("no crashea con buffer corrupto", () => {
    localStorage.setItem("trivia_logs", "{bad");
    expect(() => logger.info("hola")).not.toThrow();
    expect(Array.isArray(logger.getLogs())).toBe(true);
  });
});

describe("offlineSyncService", () => {
  it("cuenta y encola", () => {
    offlineSync.clear();
    offlineSync.enqueue({ type: "attempt", payload: { a: 1 } });
    expect(offlineSync.count()).toBe(1);
  });
  it("syncNow evita duplicados paralelos", async () => {
    offlineSync.clear();
    offlineSync.enqueue({ type: "attempt", payload: { a: 1 } });
    let calls = 0;
    const handlers = { attempt: async () => { calls++; await new Promise((r) => setTimeout(r, 50)); } };
    const [r1, r2] = await Promise.all([offlineSync.syncNow(handlers), offlineSync.syncNow(handlers)]);
    expect(calls).toBe(1);
  });
  it("maneja QuotaExceeded al encolar", () => {
    const spy = vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => { throw new DOMException("quota", "QuotaExceededError"); });
    let thrown = false;
    try { offlineSync.enqueue({ type: "x", payload: {} }); } catch (e) { thrown = true; }
    spy.mockRestore();
    expect(thrown).toBe(true);
  });
  it("no crashea con cola corrupta", () => {
    localStorage.setItem("trivia_offline_queue", "{bad");
    expect(offlineSync.count()).toBe(0);
  });
});