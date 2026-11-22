import { describe, it, expect } from "vitest";
import { fisherYates } from "../utils/shuffle.js";
import { toCSV } from "../utils/csvExport.js";
import { feedbackFor } from "../utils/feedbackMessages.js";

describe("fisherYates", () => {
  it("mantiene longitud y elementos", () => {
    const arr = [1, 2, 3, 4, 5];
    const out = fisherYates(arr);
    expect(out).toHaveLength(arr.length);
    expect([...out].sort()).toEqual([...arr].sort());
    expect(arr).toEqual([1, 2, 3, 4, 5]); // no muta
  });
  it("maneja array vacio", () => {
    expect(fisherYates([])).toEqual([]);
  });
});

describe("toCSV", () => {
  it("escapa comas y comillas", () => {
    const csv = toCSV([{ nombre: 'Juan, "Jr"' }], ["nombre"]);
    expect(csv).toContain('"Juan, ""Jr"""');
  });
  it("neutraliza formulas", () => {
    const csv = toCSV([{ nombre: "=SUM(A1:A2)" }, { nombre: "+cmd" }, { nombre: "-x" }, { nombre: "@x" }], ["nombre"]);
    expect(csv).toContain("'=SUM(A1:A2)");
    expect(csv).toContain("'+cmd");
    expect(csv).toContain("'-x");
    expect(csv).toContain("'@x");
  });
  it("neutraliza tab y CR", () => {
    const csv = toCSV([{ nombre: "\tfoo" }, { nombre: "\rbar" }], ["nombre"]);
    expect(csv).toContain("'\tfoo");
    expect(csv).toContain("'\rbar");
  });
  it("maneja saltos de linea", () => {
    const csv = toCSV([{ t: "a\nb" }], ["t"]);
    expect(csv).toContain('"a\nb"');
  });
});

describe("feedbackFor", () => {
  it("100%", () => expect(feedbackFor(5, 5)).toContain("Excelente"));
  it("0 total no crashea", () => expect(typeof feedbackFor(0, 0)).toBe("string"));
  it("bajo", () => expect(feedbackFor(1, 5)).toBeTruthy());
});