import { describe, expect, it } from "bun:test";
import {
  addDays,
  addMonths,
  formatISODateBR,
  toISODate,
} from "../src/lib/dates";

describe("addDays", () => {
  it("adds days within a month", () => {
    expect(addDays("2026-07-10", 3)).toBe("2026-07-13");
  });
  it("rolls over month boundaries", () => {
    expect(addDays("2026-07-30", 3)).toBe("2026-08-02");
  });
  it("supports negative offsets", () => {
    expect(addDays("2026-03-01", -1)).toBe("2026-02-28");
  });
  it("rolls over year boundaries", () => {
    expect(addDays("2026-12-31", 1)).toBe("2027-01-01");
  });
});

describe("addMonths", () => {
  it("adds whole months", () => {
    expect(toISODate(addMonths("2026-01-15", 1))).toBe("2026-02-15");
  });

  it("clamps the day to the end of a shorter month", () => {
    // Jan 31 + 1 month -> Feb 28 (2026 não é bissexto)
    expect(toISODate(addMonths("2026-01-31", 1))).toBe("2026-02-28");
  });

  it("rolls over the year", () => {
    expect(toISODate(addMonths("2026-12-10", 2))).toBe("2027-02-10");
  });
});

describe("formatISODateBR", () => {
  it("formats ISO as DD/MM/YYYY", () => {
    expect(formatISODateBR("2026-07-10")).toBe("10/07/2026");
  });
});
