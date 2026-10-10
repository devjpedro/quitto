import { describe, expect, it } from "vitest";
import {
  dateInputPlaceholder,
  formatDateInput,
  maskDateInput,
  parseDateInput,
} from "@/lib/date-input";

describe("date-input", () => {
  it("maskDateInput põe as barras e corta em oito dígitos", () => {
    expect(maskDateInput("1")).toBe("1");
    expect(maskDateInput("101")).toBe("10/1");
    expect(maskDateInput("10112026")).toBe("10/11/2026");
    expect(maskDateInput("10/11/2026999")).toBe("10/11/2026");
    expect(maskDateInput("ab")).toBe("");
  });

  it("parseDateInput: pt-BR é dia primeiro, en-US é mês primeiro", () => {
    expect(parseDateInput("10/11/2026", "pt-BR")).toBe("2026-11-10");
    expect(parseDateInput("10/11/2026", "en-US")).toBe("2026-10-11");
  });

  it("parseDateInput rejeita parcial, dia que não existe e ano de 3 dígitos", () => {
    expect(parseDateInput("10/11", "pt-BR")).toBeNull();
    expect(parseDateInput("31/02/2026", "pt-BR")).toBeNull();
    expect(parseDateInput("13/13/2026", "en-US")).toBeNull();
    expect(parseDateInput("10/11/202", "pt-BR")).toBeNull();
  });

  it("formatDateInput e o placeholder seguem o idioma", () => {
    expect(formatDateInput("2026-11-10", "pt-BR")).toBe("10/11/2026");
    expect(formatDateInput("2026-11-10", "en-US")).toBe("11/10/2026");
    expect(formatDateInput("", "pt-BR")).toBe("");
    expect(dateInputPlaceholder("pt-BR")).toBe("dd/mm/aaaa");
    expect(dateInputPlaceholder("en-US")).toBe("mm/dd/yyyy");
  });
});
