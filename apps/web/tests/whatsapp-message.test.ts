import { describe, expect, it } from "vitest";
import {
  type ChargeMessageInput,
  chargeMessage,
  groupChargeMessage,
  receiptMessage,
  whatsappUrl,
} from "@/features/installments/lib/whatsapp-message";
import { NBSP } from "./nbsp";

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

  it("grupo: cita todas as parcelas, o total e a mais antiga, sem PIX (um código é um valor)", () => {
    expect(
      groupChargeMessage(
        {
          contractTitle: "Notebook da Marina",
          dueDate: "2026-08-30",
          sequences: [3, 4],
          totalCents: 70_000,
        },
        "pt-BR"
      )
    ).toEqual([
      "Oi! As parcelas 3 e 4 de “Notebook da Marina” estão em aberto, somando R$ 700,00. A mais antiga venceu em 30/08/2026. Consegue ver isso pra mim?",
    ]);
  });

  it("grupo com lacuna: as faixas; com mais de 3 itens, quantas e entre quais", () => {
    const group = {
      contractTitle: "Venda do terreno",
      dueDate: "2024-10-28",
      totalCents: 4_600_000,
    };
    expect(
      groupChargeMessage(
        {
          ...group,
          sequences: [5, 6, 7, 8, 9, 10, 11, 12, 14, 15, 16, 17, 18],
        },
        "pt-BR"
      )[0]
    ).toBe(
      "Oi! As parcelas 5 a 12 e 14 a 18 de “Venda do terreno” estão em aberto, somando R$ 46.000,00. A mais antiga venceu em 28/10/2024. Consegue ver isso pra mim?"
    );
    expect(
      groupChargeMessage(
        { ...group, sequences: [3, 5, 7, 9, 10, 11] },
        "pt-BR"
      )[0]
    ).toBe(
      "Oi! 6 parcelas de “Venda do terreno”, entre a 3 e a 11, estão em aberto, somando R$ 46.000,00. A mais antiga venceu em 28/10/2024. Consegue ver isso pra mim?"
    );
  });

  it("grupo: a faixa sai com espaço comum, o NBSP é só da nossa tela (o WhatsApp recebe texto puro)", () => {
    for (const locale of ["pt-BR", "en-US"] as const) {
      const [text] = groupChargeMessage(
        {
          contractTitle: "Terreno do Sítio",
          dueDate: "2026-08-25",
          sequences: [1, 2, 3],
          totalCents: 60_000,
        },
        locale
      );
      expect(text).not.toContain(NBSP);
    }
    expect(
      groupChargeMessage(
        {
          contractTitle: "Terreno do Sítio",
          dueDate: "2026-08-25",
          sequences: [1, 2, 3],
          totalCents: 60_000,
        },
        "pt-BR"
      )[0]
    ).toContain("As parcelas 1 a 3 de “Terreno do Sítio” estão em aberto");
  });

  it("grupo no idioma de quem envia", () => {
    const group = {
      contractTitle: "Notebook da Marina",
      dueDate: "2026-08-30",
      totalCents: 70_000,
    };
    expect(
      groupChargeMessage({ ...group, sequences: [3, 4] }, "en-US")[0]
    ).toBe(
      "Hi! Installments 3 and 4 of “Notebook da Marina” are still open, R$700.00 in all. The oldest was due on 08/30/2026. Could you look into it?"
    );
    expect(
      groupChargeMessage({ ...group, sequences: [1, 3, 5, 7] }, "en-US")[0]
    ).toBe(
      "Hi! 4 installments of “Notebook da Marina”, between 1 and 7, are still open, R$700.00 in all. The oldest was due on 08/30/2026. Could you look into it?"
    );
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

describe("receiptMessage", () => {
  const input = {
    amountCents: 48_000,
    contractTitle: "Moto do Rafa",
    installmentsCount: 10,
    sequence: 2,
    url: "https://app.quitto.dev/r/7fQ2kX9mVb",
  };

  it("quem recebe: 'Recebi a parcela…' e o link, em parágrafos", () => {
    expect(
      receiptMessage({ ...input, perspective: "receive" }, "pt-BR")
    ).toEqual([
      "Oi! Recebi a parcela 2 de 10 de “Moto do Rafa” (R$ 480,00). O recibo está aqui:",
      "https://app.quitto.dev/r/7fQ2kX9mVb",
    ]);
  });

  it("quem paga: 'Paguei a parcela…' (I7)", () => {
    expect(receiptMessage({ ...input, perspective: "pay" }, "pt-BR")[0]).toBe(
      "Oi! Paguei a parcela 2 de 10 de “Moto do Rafa” (R$ 480,00). O recibo está aqui:"
    );
  });
});
