import { describe, expect, it } from "vitest";
import { trailSteps } from "@/features/installments/lib/status-trail";

const common = {
  today: "2026-10-05",
  locale: "pt-BR" as const,
  payerName: "Rafael Prado",
  approverName: "João Souza",
  isApprover: false,
  proofs: [],
  events: [],
  confirmedAt: null,
  paidAt: null,
};
const names = (steps: ReturnType<typeof trailSteps>) =>
  steps.map((s) => [s.name, s.state, s.sub]);

describe("trailSteps (o topo do painel: o valor e a trilha, sem tag e sem data por extenso)", () => {
  it("P4, quem confere: A receber feito, Comprovante atual (ontem, 10:00) em warning, Confirmada falta você", () => {
    const steps = trailSteps({
      ...common,
      perspective: "receive",
      requiresConfirmation: true,
      status: "awaiting_confirmation",
      dueDate: "2026-09-30",
      proofs: [{ createdAt: "2026-10-04T13:00:00.000Z", state: "current" }],
    });
    expect(names(steps)).toEqual([
      ["A receber", "done", "venceu 30/09"],
      ["Comprovante", "current", "ontem, 10:00"],
      ["Confirmada", "todo", "falta você"],
    ]);
    expect(steps[1]?.tone).toBe("warning");
  });

  it("registrada na criação, num contrato com confirmação: dois passos, sem Comprovante nem Confirmada", () => {
    const steps = trailSteps({
      ...common,
      perspective: "receive",
      requiresConfirmation: true,
      registeredOnCreate: true,
      status: "paid",
      dueDate: "2026-09-30",
      paidAt: "2026-09-30T12:00:00.000Z",
    });
    expect(steps.map((s) => [s.key, s.state])).toEqual([
      ["due", "done"],
      ["done", "done"],
    ]);
  });

  it("P3, quem recebe uma atrasada: A receber atual em danger; Rafael envia; você confirma", () => {
    const steps = trailSteps({
      ...common,
      perspective: "receive",
      requiresConfirmation: true,
      status: "pending",
      dueDate: "2026-08-30",
    });
    expect(names(steps)).toEqual([
      ["A receber", "current", "venceu 30/08"],
      ["Comprovante", "todo", "Rafael envia"],
      ["Confirmada", "todo", "você confirma"],
    ]);
    expect(steps[0]?.tone).toBe("danger");
  });

  it("P1 sem confirmação: A pagar vence hoje; Paga quando você enviar", () => {
    expect(
      names(
        trailSteps({
          ...common,
          perspective: "pay",
          requiresConfirmation: false,
          status: "pending",
          dueDate: "2026-10-05",
        })
      )
    ).toEqual([
      ["A pagar", "current", "vence hoje"],
      ["Paga", "todo", "quando você enviar"],
    ]);
  });

  it("P6, quem paga: o comprovante contestado; João confirma", () => {
    expect(
      names(
        trailSteps({
          ...common,
          perspective: "pay",
          requiresConfirmation: true,
          status: "disputed",
          dueDate: "2026-07-30",
        })
      )
    ).toEqual([
      ["A pagar", "done", "venceu 30/07"],
      ["Comprovante", "bad", "contestado"],
      ["Confirmada", "todo", "João confirma"],
    ]);
  });

  it("P5 confirmada por você; P5 sem confirmação marcada por você", () => {
    const confirmed = trailSteps({
      ...common,
      perspective: "receive",
      requiresConfirmation: true,
      status: "confirmed",
      dueDate: "2026-07-30",
      confirmedAt: "2026-07-31T12:12:00.000Z",
      proofs: [{ createdAt: "2026-07-31T11:40:00.000Z", state: "current" }],
      events: [
        {
          type: "payment_confirmed",
          isMe: true,
          actorName: "João Souza",
          createdAt: "2026-07-31T12:12:00.000Z",
        },
      ],
    });
    expect(names(confirmed)).toEqual([
      ["A receber", "done", "venceu 30/07"],
      ["Comprovante", "done", "31/07"],
      ["Confirmada", "done", "31/07 · por você"],
    ]);
    const marked = trailSteps({
      ...common,
      perspective: "receive",
      requiresConfirmation: false,
      status: "paid",
      dueDate: "2026-09-15",
      paidAt: "2026-09-15T18:00:00.000Z",
      events: [
        {
          type: "installment_received",
          isMe: true,
          actorName: "João Souza",
          createdAt: "2026-09-15T18:00:00.000Z",
        },
      ],
    });
    expect(names(marked)).toEqual([
      ["A receber", "done", "venceu 15/09"],
      ["Recebida", "done", "15/09 · marcada por você"],
    ]);
  });

  it("o dono que paga e herda a aprovação: 'você confirma', não 'João confirma'", () => {
    const owner = {
      ...common,
      perspective: "pay" as const,
      requiresConfirmation: true,
      status: "awaiting_confirmation",
      dueDate: "2026-10-05",
      proofs: [{ createdAt: "2026-10-04T13:00:00.000Z", state: "current" }],
    };
    expect(names(trailSteps({ ...owner, isApprover: true })).at(-1)).toEqual([
      "Confirmada",
      "todo",
      "falta você",
    ]);
    expect(names(trailSteps({ ...owner, isApprover: false })).at(-1)?.[2]).toBe(
      "João confirma"
    );
    expect(
      names(
        trailSteps({
          ...owner,
          isApprover: true,
          status: "pending",
          proofs: [],
        })
      ).at(-1)?.[2]
    ).toBe("você confirma");
  });

  it("P7, quem paga enquanto o comprovante vai: 'Paga' espera 'quando terminar'", () => {
    const sending = {
      ...common,
      perspective: "pay" as const,
      requiresConfirmation: false,
      status: "pending",
      dueDate: "2026-10-05",
    };
    expect(names(trailSteps(sending)).at(-1)?.[2]).toBe("quando você enviar");
    expect(names(trailSteps({ ...sending, uploading: true })).at(-1)?.[2]).toBe(
      "quando terminar"
    );
  });
});
