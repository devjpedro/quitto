import { describe, expect, it } from "vitest";
import {
  type ChargeMessageInput,
  chargeMessage,
  whatsappUrl,
} from "@/features/installments/lib/whatsapp-message";

const base: ChargeMessageInput = {
  contractTitle: "Aluguel do apê",
  sequence: 7,
  installmentsCount: 12,
  amountCents: 125_000,
  dueDate: "2026-10-05",
  todayISO: "2026-10-02",
  pixCode: null,
};

const WA_PREFIX = "https://wa.me/?text=";

describe("chargeMessage", () => {
  it("lembra a parcela antes do vencimento", () => {
    expect(chargeMessage(base, "pt-BR")).toEqual([
      "Oi! Passando para lembrar da parcela 7 de 12 de “Aluguel do apê”: R$ 1.250,00, com vencimento em 05/10/2026.",
    ]);
  });

  it("cobra a parcela atrasada", () => {
    expect(chargeMessage({ ...base, dueDate: "2026-09-28" }, "pt-BR")[0]).toBe(
      "Oi! A parcela 7 de 12 de “Aluguel do apê” (R$ 1.250,00) venceu em 28/09/2026. Consegue ver isso pra mim?"
    );
  });

  it("leva o PIX copia e cola quando existe", () => {
    expect(chargeMessage({ ...base, pixCode: "000201abc" }, "pt-BR")).toEqual([
      expect.any(String),
      "Pix copia e cola:",
      "000201abc",
    ]);
  });

  it("sai no idioma de quem envia", () => {
    expect(chargeMessage(base, "en-US")[0]).toBe(
      "Hi! Just a reminder about installment 7 of 12 of “Aluguel do apê”: R$1,250.00, due on 10/05/2026."
    );
  });

  it("vence hoje: ainda é lembrete, não cobrança de atraso", () => {
    expect(chargeMessage({ ...base, dueDate: base.todayISO }, "pt-BR")[0]).toBe(
      "Oi! Passando para lembrar da parcela 7 de 12 de “Aluguel do apê”: R$ 1.250,00, com vencimento em 02/10/2026."
    );
  });

  it("PIX vazio não entra na mensagem", () => {
    expect(chargeMessage({ ...base, pixCode: "" }, "pt-BR")).toHaveLength(1);
  });
});

describe("whatsappUrl", () => {
  it("não leva número e separa os parágrafos com uma linha em branco", () => {
    const url = whatsappUrl(["Oi! R$ 1.250,00", "000201"]);
    expect(url.startsWith(WA_PREFIX)).toBe(true);
    expect(decodeURIComponent(url.slice(WA_PREFIX.length))).toBe(
      ["Oi! R$ 1.250,00", "000201"].join(String.fromCharCode(10, 10))
    );
  });

  it("codifica a mensagem real: aspas, acento, R$, & + % e o espaço do Intl", () => {
    const paragraphs = chargeMessage(
      {
        ...base,
        contractTitle: "Aluguel do apê & cia + 50%",
        pixCode: "000201abc",
      },
      "pt-BR"
    );
    const text = whatsappUrl(paragraphs).slice(WA_PREFIX.length);
    const nbsp = String.fromCharCode(0x00_a0);
    const narrowNbsp = String.fromCharCode(0x20_2f);
    for (const raw of [" ", nbsp, narrowNbsp, "“", "ê", "$", "&", "+"]) {
      expect(text).not.toContain(raw);
    }
    expect(text).toContain(
      "%E2%80%9CAluguel%20do%20ap%C3%AA%20%26%20cia%20%2B%2050%25%E2%80%9D"
    );
    // The amount keeps a plain space (%20), never Intl's NBSP (%C2%A0).
    expect(text).toContain("R%24%201.250%2C00");
    expect(decodeURIComponent(text)).toBe(
      paragraphs.join(String.fromCharCode(10, 10))
    );
  });
});
