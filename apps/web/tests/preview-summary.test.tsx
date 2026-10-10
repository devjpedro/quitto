import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import { PreviewSummary } from "@/components/preview/preview-summary";
import type { PreviewModel } from "@/components/preview/types";

const OPEN_PREVIEW = /Ver a prévia do contrato/;

const base: PreviewModel = {
  side: "receive",
  title: "Notebook da Renata",
  description: null,
  totalCents: 600_000,
  summary: { kind: "even", amountCents: 50_000, count: 12, day: 10 },
  person: null,
  rows: [
    {
      sequence: 1,
      dueDate: "2026-11-10",
      amountCents: 50_000,
      adjusted: false,
    },
  ],
  count: 12,
  lastDueDate: "2027-10-10",
  statuses: null,
  overdueCount: 0,
  paidCount: 0,
};

describe("PreviewSummary", () => {
  it("recém-aberto: um tracejado que não é botão", () => {
    render(
      <PreviewSummary
        compact={false}
        locale="pt-BR"
        model={{
          ...base,
          side: null,
          title: null,
          totalCents: null,
          summary: null,
          rows: [],
        }}
      />
    );
    expect(screen.getByText("A prévia do contrato aparece aqui")).toBeVisible();
    expect(screen.queryByRole("button")).toBeNull();
  });

  it("no passo 1: o valor entra no passo 2", () => {
    render(
      <PreviewSummary
        compact={false}
        locale="pt-BR"
        model={{ ...base, totalCents: null, summary: null, rows: [] }}
      />
    );
    expect(screen.getByText("O valor entra no passo 2")).toBeVisible();
  });

  it("tocar abre a prévia inteira; 'Toque para fechar a prévia' fecha", async () => {
    const user = userEvent.setup();
    const { container } = render(
      <PreviewSummary compact={false} locale="pt-BR" model={base} />
    );
    expect(container).toHaveTextContent("12x de R$ 500,00 · dia 10");
    const open = screen.getByRole("button", { name: OPEN_PREVIEW });
    expect(open).toHaveAttribute("aria-expanded", "false");
    await user.click(open);
    const dialog = screen.getByRole("dialog", { name: "Prévia do contrato" });
    expect(dialog).toBeVisible();
    await user.click(
      screen.getByRole("button", { name: "Toque para fechar a prévia" })
    );
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("com o teclado aberto: uma linha, com o nome e o total", () => {
    const { container } = render(
      <PreviewSummary compact locale="pt-BR" model={base} />
    );
    expect(container).not.toHaveTextContent("12x de R$ 500,00");
    expect(screen.getByText("Notebook da Renata")).toBeVisible();
  });
});
