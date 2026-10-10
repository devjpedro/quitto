import { describe, expect, it } from "vitest";
import { pluralForm } from "@/lib/plural";

describe("pluralForm", () => {
  it("one só para 1 (e o que o CLDR do idioma chama de one)", () => {
    expect(pluralForm(1, "pt-BR")).toBe("one");
    expect(pluralForm(2, "pt-BR")).toBe("other");
    expect(pluralForm(1, "en-US")).toBe("one");
    expect(pluralForm(0, "en-US")).toBe("other");
  });

  it("em pt-BR o CLDR põe o 0 em one: quem chama guarda o zero antes", () => {
    expect(pluralForm(0, "pt-BR")).toBe("one");
  });
});
