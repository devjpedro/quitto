import { describe, expect, it } from "vitest";
import {
  cardButtons,
  type NextAction,
  nextActionOf,
  nextActionView,
} from "@/features/contracts/lib/next-action";
import { motoDetail } from "./contract-fixtures";

const TODAY = "2026-10-05";
/** Intl's and the messages' no-break spaces, read as plain ones. */
const plain = (text: string) => text.replace(/\s+/g, " ");

describe("nextActionOf (a ordem da home: atrasadas → vence hoje → comprovante → a próxima)", () => {
  it("quem recebe a Moto: a atrasada 3 vem antes do comprovante 4", () => {
    const action = nextActionOf(motoDetail(), TODAY);
    expect(action?.kind).toBe("overdue");
    expect(
      action?.kind === "overdue"
        ? action.installments.map((i) => i.sequence)
        : null
    ).toEqual([3]);
  });

  it("sem atrasada: o comprovante para conferir; depois, a próxima", () => {
    const detail = motoDetail();
    const noOverdue = {
      ...detail,
      installments: detail.installments.filter((i) => i.sequence !== 3),
    };
    expect(nextActionOf(noOverdue, TODAY)).toMatchObject({
      kind: "review",
      installment: { sequence: 4 },
    });
    const noReview = {
      ...noOverdue,
      installments: noOverdue.installments.filter((i) => i.sequence !== 4),
    };
    expect(nextActionOf(noReview, TODAY)).toMatchObject({
      kind: "next",
      installment: { sequence: 5 },
    });
  });

  it("quem paga: o comprovante esperando a outra parte não é ação dele; a contestada é", () => {
    const detail = { ...motoDetail(), role: "buyer" };
    const onlyReview = {
      ...detail,
      installments: detail.installments.filter((i) => i.sequence !== 3),
    };
    expect(nextActionOf(onlyReview, TODAY)).toMatchObject({
      kind: "next",
      installment: { sequence: 5 },
    });
    const disputed = {
      ...onlyReview,
      installments: onlyReview.installments.map((i) =>
        i.sequence === 4 ? { ...i, status: "disputed" } : i
      ),
    };
    expect(nextActionOf(disputed, TODAY)).toMatchObject({
      kind: "disputed",
      installment: { sequence: 4 },
    });
  });

  it("vence hoje vem depois das atrasadas e antes do comprovante", () => {
    const detail = motoDetail();
    const today = {
      ...detail,
      installments: detail.installments
        .filter((i) => i.sequence !== 3)
        .map((i) => (i.sequence === 5 ? { ...i, dueDate: TODAY } : i)),
    };
    expect(nextActionOf(today, TODAY)).toMatchObject({
      kind: "today",
      installment: { sequence: 5 },
    });
  });

  it("espectador: nenhum cartão; quitado: o marco", () => {
    expect(nextActionOf({ ...motoDetail(), role: "viewer" }, TODAY)).toBeNull();
    const settled = {
      ...motoDetail(),
      installments: motoDetail().installments.map((i) => ({
        ...i,
        status: "confirmed",
      })),
    };
    expect(nextActionOf(settled, TODAY)).toEqual({ kind: "settled" });
  });

  it("quem recebe: a contestada vencida conta como atrasada (como na home e na barra)", () => {
    const detail = motoDetail();
    const disputed = {
      ...detail,
      installments: detail.installments
        .filter((i) => i.sequence !== 3)
        .map((i) => (i.sequence === 4 ? { ...i, status: "disputed" } : i)),
    };
    const action = nextActionOf(disputed, TODAY);
    expect(
      action?.kind === "overdue"
        ? action.installments.map((i) => i.sequence)
        : null
    ).toEqual([4]);
  });

  it("duas ou mais atrasadas: um grupo, a mais antiga primeiro", () => {
    const detail = motoDetail();
    const two = {
      ...detail,
      installments: detail.installments.map((i) =>
        i.sequence === 4 ? { ...i, status: "pending" } : i
      ),
    };
    const action = nextActionOf(two, TODAY);
    expect(
      action?.kind === "overdue"
        ? action.installments.map((i) => i.sequence)
        : null
    ).toEqual([3, 4]);
  });
});

describe("cardButtons", () => {
  const one = nextActionOf(motoDetail(), TODAY);
  it("quem recebe uma atrasada: Cobrar no WhatsApp + Marcar como recebida; o grupo: Cobrar + Abrir a mais antiga", () => {
    expect(
      cardButtons(one as NonNullable<typeof one>, "receive", true)
    ).toEqual(["whatsapp_charge", "mark_received"]);
    expect(
      cardButtons(
        {
          kind: "overdue",
          installments: [
            motoDetail().installments[2],
            motoDetail().installments[3],
          ] as never,
        },
        "receive",
        true
      )
    ).toEqual(["whatsapp_charge", "open_oldest"]);
  });

  it("quem paga: Pagar com PIX + Já paguei só sem confirmação; o grupo: Pagar a mais antiga", () => {
    const next = {
      kind: "next" as const,
      installment: motoDetail().installments[4] as never,
    };
    expect(cardButtons(next, "pay", false)).toEqual(["pay_pix", "mark_paid"]);
    expect(cardButtons(next, "pay", true)).toEqual(["pay_pix"]);
    expect(
      cardButtons(
        {
          kind: "overdue",
          installments: [
            motoDetail().installments[2],
            motoDetail().installments[3],
          ] as never,
        },
        "pay",
        false
      )
    ).toEqual(["pay_oldest"]);
  });

  it("o resto: conferir, reenviar, lembrar; o quitado: extrato e recibos", () => {
    expect(
      cardButtons(
        { kind: "review", installment: motoDetail().installments[3] as never },
        "receive",
        true
      )
    ).toEqual(["review"]);
    expect(
      cardButtons(
        {
          kind: "disputed",
          installment: motoDetail().installments[3] as never,
        },
        "pay",
        true
      )
    ).toEqual(["resend"]);
    expect(
      cardButtons(
        { kind: "next", installment: motoDetail().installments[4] as never },
        "receive",
        true
      )
    ).toEqual(["whatsapp_remind", "mark_received"]);
    expect(cardButtons({ kind: "settled" }, "receive", true)).toEqual([
      "statement",
      "receipts",
    ]);
  });
});

describe("nextActionView: o título do grupo do cartão (revisão I3)", () => {
  const titleOn = (
    today: string,
    review: number[]
  ): { action: NextAction | null; title: string | null } => {
    // From the 3 on, each one pending, or in review when asked.
    const detail = motoDetail();
    const withReview = {
      ...detail,
      installments: detail.installments.map((it) => {
        if (it.sequence < 3) {
          return it;
        }
        const status = review.includes(it.sequence)
          ? "awaiting_confirmation"
          : "pending";
        return { ...it, status };
      }),
    };
    const action = nextActionOf(withReview, today);
    if (!action || action.kind === "settled") {
      return { action, title: null };
    }
    const view = nextActionView(action, withReview, today, "pt-BR");
    return { action, title: plain(view.title) };
  };

  it("seguidas: 'Parcelas 3 e 4', 'Parcelas 3 a 5'", () => {
    expect(titleOn("2026-10-05", []).title).toBe("Parcelas 3 e 4");
    expect(titleOn("2026-11-05", []).title).toBe("Parcelas 3 a 5");
  });

  it("a Moto em 05/01/2027 (a 4 em conferência no meio): 'Parcelas 3 e 5 a 7', e o valor das quatro", () => {
    const { action, title } = titleOn("2027-01-05", [4]);
    expect(
      action?.kind === "overdue"
        ? action.installments.map((it) => it.sequence)
        : null
    ).toEqual([3, 5, 6, 7]);
    expect(title).toBe("Parcelas 3 e 5 a 7");
    const view = nextActionView(
      action as Exclude<NextAction, { kind: "settled" }>,
      motoDetail(),
      "2027-01-05",
      "pt-BR"
    );
    expect(view.amountCents).toBe(192_000);
  });

  it("mais de três pedaços: quantas e entre quais ('4 parcelas entre 3 e 9')", () => {
    expect(titleOn("2027-03-05", [4, 6, 8]).title).toBe(
      "4 parcelas entre 3 e 9"
    );
  });
});
