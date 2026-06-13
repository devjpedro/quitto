import { describe, expect, it } from "vitest";
import {
  dateToISO,
  formatBRL,
  formatISODateBR,
  formatRelativeTimeBR,
  parseBRDateToISO,
  parseBRLToCents,
  parseISOToLocalDate,
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

describe("dateToISO", () => {
  it("formats a Date using local components (no UTC day-shift)", () => {
    // Build the date from local components; dateToISO must echo them back
    // regardless of the runner's timezone.
    expect(dateToISO(new Date(2026, 6, 10))).toBe("2026-07-10");
    expect(dateToISO(new Date(2026, 0, 1))).toBe("2026-01-01");
    expect(dateToISO(new Date(2026, 11, 31))).toBe("2026-12-31");
  });

  it("round-trips with parseISOToLocalDate without drift", () => {
    expect(dateToISO(parseISOToLocalDate("2026-08-10") as Date)).toBe(
      "2026-08-10"
    );
  });
});

describe("parseISOToLocalDate", () => {
  it("parses ISO into a local Date with matching components", () => {
    const d = parseISOToLocalDate("2026-07-10");
    expect(d?.getFullYear()).toBe(2026);
    expect(d?.getMonth()).toBe(6);
    expect(d?.getDate()).toBe(10);
  });

  it("returns undefined for malformed input", () => {
    expect(parseISOToLocalDate("10/07/2026")).toBeUndefined();
    expect(parseISOToLocalDate("")).toBeUndefined();
  });

  it("returns undefined for overflow day (JS auto-roll guard)", () => {
    expect(parseISOToLocalDate("2026-02-30")).toBeUndefined();
  });

  it("returns undefined for overflow month (13+)", () => {
    expect(parseISOToLocalDate("2026-13-01")).toBeUndefined();
  });

  it("accepts a valid leap day", () => {
    expect(parseISOToLocalDate("2024-02-29")).toBeInstanceOf(Date);
  });
});

describe("formatRelativeTimeBR", () => {
  const now = new Date("2026-06-13T12:00:00Z");

  it("formats minutes ago", () => {
    const iso = new Date("2026-06-13T11:30:00Z").toISOString();
    expect(formatRelativeTimeBR(iso, now)).toBe("há 30 minutos");
  });

  it("formats days ago", () => {
    const iso = new Date("2026-06-11T12:00:00Z").toISOString();
    expect(formatRelativeTimeBR(iso, now)).toBe("há 2 dias");
  });

  it("formats just now as seconds", () => {
    const iso = new Date("2026-06-13T11:59:55Z").toISOString();
    expect(formatRelativeTimeBR(iso, now)).toBe("há 5 segundos");
  });
});
