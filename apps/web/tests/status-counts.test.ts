import { describe, expect, it } from "vitest";
import {
  barStatusOf,
  barView,
  legendEnd,
  legendEntries,
  rowState,
} from "@/features/contracts/lib/status-counts";
import { motoDetail } from "./contract-fixtures";

const TODAY = "2026-10-05";
const it3 = (
  sequence: number,
  dueDate: string,
  status: string,
  paidAt: string | null = null
) => ({
  sequence,
  dueDate,
  status,
  paidAt,
  amountCents: 48_000,
  id: `i${sequence}`,
});

// Moto do Rafa on 05/10/2026 (mockup 14, frame A): 2 confirmed, 3 overdue, 4 with a proof, 6 ahead (the last on 30/03/2027).
const MOTO = motoDetail().installments;

describe("rowState e barStatusOf", () => {
  it("paga, comprovante, contestada, vence hoje, atrasada, aberta", () => {
    expect(
      rowState({ dueDate: "2026-06-30", status: "confirmed" }, TODAY)
    ).toBe("paid");
    expect(
      rowState(
        { dueDate: "2026-09-30", status: "awaiting_confirmation" },
        TODAY
      )
    ).toBe("review");
    expect(rowState({ dueDate: "2026-07-30", status: "disputed" }, TODAY)).toBe(
      "disputed"
    );
    expect(rowState({ dueDate: TODAY, status: "pending" }, TODAY)).toBe(
      "today"
    );
    expect(rowState({ dueDate: "2026-08-30", status: "pending" }, TODAY)).toBe(
      "overdue"
    );
    expect(rowState({ dueDate: "2026-10-30", status: "pending" }, TODAY)).toBe(
      "open"
    );
  });

  it("contestada vencida pinta como atrasada; contestada no prazo, como aberta", () => {
    expect(barStatusOf("disputed", "2026-07-30", TODAY)).toBe("overdue");
    expect(barStatusOf("disputed", "2026-10-30", TODAY)).toBe("open");
  });
});

describe("barView", () => {
  it("até 24 parcelas: um status por parcela", () => {
    expect(barView(MOTO, TODAY)).toEqual({
      statuses: [
        "paid",
        "paid",
        "overdue",
        "review",
        "open",
        "open",
        "open",
        "open",
        "open",
        "open",
      ],
      paidCount: 2,
      overdueCount: 1,
    });
  });

  it("acima de 24: sem status por parcela (a barra vira zonas pelas contagens)", () => {
    const sixty = Array.from({ length: 60 }, (_, i) => {
      let due = "2027-01-30";
      if (i < 4) {
        due = "2024-06-30";
      } else if (i < 28) {
        due = "2025-01-30";
      }
      return it3(i + 1, due, i < 4 ? "paid" : "pending");
    });
    expect(barView(sixty, TODAY)).toEqual({
      statuses: null,
      paidCount: 4,
      overdueCount: 24,
    });
  });
});

describe("legendEntries", () => {
  it("quem recebe com confirmação: confirmadas, atrasada, para conferir, a receber", () => {
    expect(legendEntries(MOTO, TODAY, "receive", true, "pt-BR")).toEqual([
      { status: "paid", count: 2, label: "confirmadas" },
      { status: "overdue", count: 1, label: "atrasada" },
      { status: "review", count: 1, label: "para conferir" },
      { status: "open", count: 6, label: "a receber" },
    ]);
  });

  it("quem paga sem confirmação: pagas, aguardando não existe, a pagar; o espectador: em aberto", () => {
    const carlos = [
      it3(1, "2026-04-05", "paid"),
      it3(2, TODAY, "pending"),
      it3(3, "2026-11-05", "pending"),
    ];
    expect(legendEntries(carlos, TODAY, "pay", false, "pt-BR")).toEqual([
      { status: "paid", count: 1, label: "paga" },
      { status: "today", count: 1, label: "vence hoje" },
      { status: "open", count: 1, label: "a pagar" },
    ]);
    expect(legendEntries(MOTO, TODAY, "view", true, "pt-BR").at(-1)).toEqual({
      status: "open",
      count: 6,
      label: "em aberto",
    });
    expect(legendEntries(MOTO, TODAY, "view", true, "pt-BR")[2]).toEqual({
      status: "review",
      count: 1,
      label: "com comprovante enviado",
    });
  });
});

describe("legendEnd", () => {
  it("em aberto: o mês da última parcela; quitado: o dia da última quitação (São Paulo)", () => {
    expect(legendEnd(MOTO, "pt-BR")).toBe("termina em mar/2027");
    const done = [
      it3(1, "2026-09-15", "paid", "2026-09-15T15:00:00Z"),
      it3(2, "2026-10-15", "paid", "2026-10-16T01:30:00Z"),
    ];
    expect(legendEnd(done, "pt-BR")).toBe("quitado em 15/10/2026");
  });
});
