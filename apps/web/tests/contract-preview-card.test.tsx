import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { ContractPreviewCard } from "@/components/preview/contract-preview-card";
import type { PreviewModel } from "@/components/preview/types";

const FIRST_ROWS = /^Parcela [1-3] de 12$/;

const EMPTY: PreviewModel = {
  side: null,
  title: null,
  description: null,
  totalCents: null,
  summary: null,
  person: null,
  rows: [],
  count: 0,
  lastDueDate: null,
  statuses: null,
  overdueCount: 0,
  mismatch: false,
};

const FILLED: PreviewModel = {
  side: "receive",
  title: "Notebook da Renata",
  description: "Dell Inspiron 15, usado, com carregador",
  totalCents: 600_000,
  summary: { kind: "even", amountCents: 50_000, count: 12, day: 10 },
  person: { kind: "other", name: "Renata Campos" },
  rows: [
    {
      sequence: 1,
      dueDate: "2026-11-10",
      amountCents: 50_000,
      adjusted: false,
    },
    {
      sequence: 2,
      dueDate: "2026-12-10",
      amountCents: 50_000,
      adjusted: false,
    },
    {
      sequence: 3,
      dueDate: "2027-01-10",
      amountCents: 50_000,
      adjusted: false,
    },
  ],
  count: 12,
  lastDueDate: "2027-10-10",
  statuses: Array.from({ length: 12 }, () => "open" as const),
  overdueCount: 0,
  mismatch: false,
};

describe("ContractPreviewCard", () => {
  it("vazio: o tracejado de cada região, rotulado com o passo", () => {
    render(<ContractPreviewCard locale="pt-BR" model={EMPTY} />);
    for (const text of [
      "Paga ou recebe",
      "Nome do contrato",
      "Valor total · passo 2",
      "Com quem · passo 3, opcional",
      "As parcelas aparecem aqui",
    ]) {
      expect(screen.getByText(text)).toBeVisible();
    }
  });

  it("cheio: o contrato como ele vai aparecer", () => {
    const { container } = render(
      <ContractPreviewCard locale="pt-BR" model={FILLED} />
    );
    expect(screen.getByText("Você recebe")).toBeVisible();
    expect(
      screen.getByRole("heading", { name: "Notebook da Renata" })
    ).toBeVisible();
    expect(screen.getByText("R$ 6.000,00")).toHaveClass("sr-only");
    expect(container).toHaveTextContent("12x de R$ 500,00 · todo dia 10");
    expect(container).toHaveTextContent("Renata Campos te paga");
    expect(screen.getByText("0 de 12 recebidas")).toBeVisible();
    expect(screen.getByText("termina em 10/10/2027")).toBeVisible();
    expect(screen.getAllByText(FIRST_ROWS)).toHaveLength(3);
    expect(screen.getByText("Mais 9 parcelas, até 10/10/2027")).toBeVisible();
    // Owner's cuts (ajuste-15 §5.2): no "12 parcelas" at the top, no "convite por e-mail".
    expect(container).not.toHaveTextContent("12 parcelas");
    expect(container).not.toHaveTextContent("convite por e-mail");
  });

  it("ajustada e soma diferente: as tags", () => {
    render(
      <ContractPreviewCard
        locale="pt-BR"
        model={{
          ...FILLED,
          mismatch: true,
          rows: FILLED.rows.map((row, index) => ({
            ...row,
            adjusted: index === 0,
          })),
        }}
      />
    );
    expect(screen.getByText("soma diferente do total")).toBeVisible();
    expect(screen.getAllByText("ajustada")).toHaveLength(1);
  });

  it("quem paga vê − R$ e 'para'; só eu: 'Só você acompanha'", () => {
    const { container } = render(
      <ContractPreviewCard
        locale="pt-BR"
        model={{ ...FILLED, side: "pay", person: { kind: "solo" } }}
      />
    );
    expect(screen.getByText("Você paga")).toBeVisible();
    expect(container).toHaveTextContent("Só você acompanha");
    expect(screen.getAllByText("− R$ 500,00")[0]).toHaveClass("sr-only");
  });
});
