import { describe, expect, it } from "bun:test";
import { normalizeEmail } from "../src/lib/email";

describe("normalizeEmail", () => {
  it("baixa caixa e remove espaços", () => {
    expect(normalizeEmail("  Joao@Example.COM ")).toBe("joao@example.com");
  });
  it("é estável (idempotente)", () => {
    expect(normalizeEmail(normalizeEmail("A@B.com"))).toBe("a@b.com");
  });
});
