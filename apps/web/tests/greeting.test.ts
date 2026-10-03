import { describe, expect, it } from "vitest";
import {
  firstName,
  greetingFor,
  partOfDay,
} from "@/features/home/lib/greeting";

describe("partOfDay", () => {
  it("segue o relógio de São Paulo, não o UTC", () => {
    expect(partOfDay(Date.UTC(2026, 9, 2, 12, 0))).toBe("morning"); // 09:00
    expect(partOfDay(Date.UTC(2026, 9, 2, 16, 0))).toBe("afternoon"); // 13:00
    expect(partOfDay(Date.UTC(2026, 9, 2, 23, 0))).toBe("evening"); // 20:00
    expect(partOfDay(Date.UTC(2026, 9, 3, 7, 59))).toBe("evening"); // 04:59
  });

  it("as fronteiras: 05:00 já é manhã, 12:00 já é tarde, 18:00 já é noite", () => {
    expect(partOfDay(Date.UTC(2026, 9, 2, 8, 0))).toBe("morning"); // 05:00
    expect(partOfDay(Date.UTC(2026, 9, 2, 14, 59))).toBe("morning"); // 11:59
    expect(partOfDay(Date.UTC(2026, 9, 2, 15, 0))).toBe("afternoon"); // 12:00
    expect(partOfDay(Date.UTC(2026, 9, 2, 20, 59))).toBe("afternoon"); // 17:59
    expect(partOfDay(Date.UTC(2026, 9, 2, 21, 0))).toBe("evening"); // 18:00
  });
});

describe("firstName", () => {
  it("o primeiro nome, sem espaços", () => {
    expect(firstName("João Pedro Souza")).toBe("João");
    expect(firstName("  Ana ")).toBe("Ana");
    expect(firstName("")).toBeNull();
    expect(firstName(null)).toBeNull();
  });
});

describe("greetingFor", () => {
  it("com e sem nome", () => {
    expect(greetingFor("morning", "João")).toBe("Bom dia, João");
    expect(greetingFor("evening", null)).toBe("Boa noite");
  });
});
