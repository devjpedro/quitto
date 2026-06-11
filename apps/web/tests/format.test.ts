import { describe, expect, it } from "vitest";
import {
  formatBRL,
  formatISODateBR,
  parseBRDateToISO,
  parseBRLToCents,
} from "../src/lib/format";

describe("formatBRL", () => {
  it("formats integer cents as Brazilian currency", () => {
    expect(formatBRL(12_000_000)).toBe("R$ 120.000,00");
    expect(formatBRL(0)).toBe("R$ 0,00");
    expect(formatBRL(200_000)).toBe("R$ 2.000,00");
  });
});

describe("parseBRLToCents", () => {
  it("parses a BR currency string into integer cents", () => {
    expect(parseBRLToCents("2.000,00")).toBe(200_000);
    expect(parseBRLToCents("R$ 1.234,56")).toBe(123_456);
    expect(parseBRLToCents("10")).toBe(1000);
  });

  it("returns null for invalid input", () => {
    expect(parseBRLToCents("abc")).toBeNull();
    expect(parseBRLToCents("")).toBeNull();
  });
});

describe("formatISODateBR", () => {
  it("formats an ISO date as DD/MM/YYYY without timezone drift", () => {
    expect(formatISODateBR("2026-07-10")).toBe("10/07/2026");
    expect(formatISODateBR("2026-02-28")).toBe("28/02/2026");
  });
});

describe("parseBRDateToISO", () => {
  it("parseBRDateToISO converte dd/mm/aaaa válida em ISO", () => {
    expect(parseBRDateToISO("31/12/2026")).toBe("2026-12-31");
  });
  it("parseBRDateToISO rejeita data impossível", () => {
    expect(parseBRDateToISO("31/02/2026")).toBeNull();
  });
  it("parseBRDateToISO rejeita formato incompleto", () => {
    expect(parseBRDateToISO("1/2/26")).toBeNull();
  });
});
