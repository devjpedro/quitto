import { describe, expect, it } from "bun:test";
import { addMonths, toISODate } from "../src/lib/dates";

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
