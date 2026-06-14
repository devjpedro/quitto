import { describe, expect, it } from "bun:test";
import { isoDateInTimeZone, todayISO } from "../src/date";

const ISO_DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

describe("isoDateInTimeZone", () => {
  it("uses the wall-clock date in the given timezone, not UTC", () => {
    // 2026-06-14T01:00:00Z is still 2026-06-13 (22:00) in São Paulo (UTC-3)
    const instant = new Date("2026-06-14T01:00:00Z");
    expect(isoDateInTimeZone(instant, "America/Sao_Paulo")).toBe("2026-06-13");
    expect(isoDateInTimeZone(instant, "UTC")).toBe("2026-06-14");
  });

  it("formats midday instants without drift", () => {
    const instant = new Date("2026-06-13T12:00:00Z");
    expect(isoDateInTimeZone(instant, "America/Sao_Paulo")).toBe("2026-06-13");
  });

  it("defaults to the app timezone", () => {
    const instant = new Date("2026-06-14T02:30:00Z"); // 23:30 BRT on the 13th
    expect(isoDateInTimeZone(instant)).toBe("2026-06-13");
  });
});

describe("todayISO", () => {
  it("returns a YYYY-MM-DD string", () => {
    expect(todayISO()).toMatch(ISO_DATE_RE);
  });
});
