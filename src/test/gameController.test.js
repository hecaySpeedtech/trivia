import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useGameController } from "../controllers/useGameController.js";

vi.mock("../models/questionsService.js", () => ({
  getQuestionsForGame: vi.fn(async (sid, _cycle, max, _units) => {
    if (sid === 999) return { ok: true, data: [] };
    const all = [
      { id: 1, text: "q1", answers: [{ id: 1, text: "a", isCorrect: true }, { id: 2, text: "b", isCorrect: false }] },
      { id: 2, text: "q2", answers: [{ id: 3, text: "c", isCorrect: false }, { id: 4, text: "d", isCorrect: true }] },
    ];
    return { ok: true, data: all.slice(0, Math.min(all.length, max)) };
  }),
}));

describe("useGameController", () => {
  it("clampa max_preguntas fuera de rango", async () => {
    const { result } = renderHook(() => useGameController());
    await act(async () => { await result.current.load(1, "Primer Ciclo", 9999, []); });
    expect(result.current.maxPreguntas).toBe(20);
    expect(result.current.questions.length).toBe(2);
  });
  it("maneja 0 preguntas sin crashear", async () => {
    const { result } = renderHook(() => useGameController());
    await act(async () => { await result.current.load(999, "Primer Ciclo", 5, []); });
    expect(result.current.questions).toEqual([]);
    expect(result.current.current).toBeUndefined();
    expect(result.current.isFinished).toBe(false);
  });
  it("evita doble conteo de respuesta", async () => {
    const { result } = renderHook(() => useGameController());
    await act(async () => { await result.current.load(1, "Primer Ciclo", 5, []); });
    const q = result.current.current;
    const correctAns = q.answers.find((a) => a.isCorrect);
    act(() => { result.current.answer(correctAns, 1); });
    act(() => { result.current.answer(correctAns, 1); });
    expect(result.current.score.correct).toBe(1);
  });
  it("restore valida estructura corrupta", () => {
    const { result } = renderHook(() => useGameController());
    act(() => { result.current.restore({ questions: "bad", index: 999, score: null }); });
    expect(result.current.questions).toEqual([]);
    expect(result.current.index).toBe(0);
  });
});