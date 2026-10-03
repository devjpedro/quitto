import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { ChipsRow, SeeAllButton } from "@/features/home/components/chips-row";
import { SectionTitle } from "@/features/home/components/section-title";
import { TotalsChips } from "@/features/home/components/totals-chips";
import { homeLayout, homeSubtitle } from "@/features/home/lib/home-layout";
import { homeFixture, installmentAction } from "./home-fixtures";

// Top-level regex literals (lint/performance/useTopLevelRegex).
const OVERDUE_CHIP = /em atraso/;

const ALL = {
  pendingCount: 5,
  overdueToPayCents: 180_000,
  overdueToReceiveCents: 70_000,
  toPayCents: 230_000,
  toReceiveCents: 140_000,
};

describe("TotalsChips", () => {
  it("na ordem: pendências, atraso (pagar, receber), 30 dias (pagar, receber), preenchidos e sem contorno", () => {
    render(<TotalsChips {...ALL} />);
    const items = within(
      screen.getByRole("list", { name: "Resumo" })
    ).getAllByRole("listitem");
    expect(items.map((i) => i.textContent)).toEqual([
      "5 pendências",
      "R$ 1.800,00 a pagar em atraso",
      "R$ 700,00 a receber em atraso",
      "R$ 2.300,00 a pagar · 30d",
      "R$ 1.400,00 a receber · 30d",
    ]);
    for (const item of items) {
      expect(item).not.toHaveClass("border");
    }
    expect(items[1]).toHaveClass("bg-danger-subtle", "text-danger");
    expect(items[1]?.querySelector("svg")).not.toBeNull();
    expect(items[3]).toHaveClass("bg-surface-card");
  });

  it("sem atraso não há chip de atraso; nada a mostrar, nada aparece", () => {
    render(
      <TotalsChips {...ALL} overdueToPayCents={0} overdueToReceiveCents={0} />
    );
    expect(screen.queryByText(OVERDUE_CHIP)).toBeNull();
    const empty = render(
      <TotalsChips
        overdueToPayCents={0}
        overdueToReceiveCents={0}
        pendingCount={0}
        toPayCents={0}
        toReceiveCents={0}
      />
    );
    expect(empty.container).toBeEmptyDOMElement();
  });

  it("no celular, uma linha só que rola na horizontal; no desktop, quebra linha", () => {
    render(<TotalsChips {...ALL} />);
    const strip = screen.getByRole("list", { name: "Resumo" });
    expect(strip).toHaveClass(
      "max-md:flex-nowrap",
      "max-md:overflow-x-auto",
      "max-md:-mx-4",
      "max-md:px-4",
      "md:flex-wrap"
    );
    for (const item of within(strip).getAllByRole("listitem")) {
      expect(item).toHaveClass("shrink-0");
    }
    // Nothing overflows here (jsdom measures 0): no tab stop that scrolls nothing.
    expect(strip).not.toHaveAttribute("tabindex");
  });

  it("mede de novo quando os chips mudam: a faixa que passa a rolar vira parada de Tab", () => {
    // The strip's box keeps its size (the container's width, h-8): only the content grows.
    let contentWidth = 300;
    const scrollWidth = vi
      .spyOn(HTMLElement.prototype, "scrollWidth", "get")
      .mockImplementation(() => contentWidth);
    const clientWidth = vi
      .spyOn(HTMLElement.prototype, "clientWidth", "get")
      .mockReturnValue(358);
    try {
      const { rerender } = render(
        <TotalsChips {...ALL} overdueToPayCents={0} overdueToReceiveCents={0} />
      );
      expect(screen.getByRole("list", { name: "Resumo" })).not.toHaveAttribute(
        "tabindex"
      );
      // A refetch brings the two overdue chips.
      contentWidth = 620;
      rerender(<TotalsChips {...ALL} />);
      expect(screen.getByRole("list", { name: "Resumo" })).toHaveAttribute(
        "tabindex",
        "0"
      );
    } finally {
      scrollWidth.mockRestore();
      clientWidth.mockRestore();
    }
  });

  it("enquanto a faixa rola, ela é uma parada de Tab (uma região que rola precisa do teclado)", () => {
    const scrollWidth = vi
      .spyOn(HTMLElement.prototype, "scrollWidth", "get")
      .mockReturnValue(620);
    const clientWidth = vi
      .spyOn(HTMLElement.prototype, "clientWidth", "get")
      .mockReturnValue(358);
    try {
      render(<TotalsChips {...ALL} />);
      expect(screen.getByRole("list", { name: "Resumo" })).toHaveAttribute(
        "tabindex",
        "0"
      );
    } finally {
      scrollWidth.mockRestore();
      clientWidth.mockRestore();
    }
  });

  it("24 atrasadas de um contrato são 1 pendência e 1 coisa (contam cartões)", () => {
    const group = installmentAction({
      id: "overdue:vt:receive",
      kind: "overdue",
      direction: "receive",
      count: 24,
      sequences: Array.from({ length: 24 }, (_, i) => i + 5),
      totalCents: 4_800_000,
    });
    const home = homeFixture({ actions: [group] });
    render(<TotalsChips {...ALL} pendingCount={home.actions.length} />);
    expect(screen.getByText("pendência")).toBeVisible();
    expect(homeSubtitle(home, homeLayout(home), "pt-BR")).toBe(
      "1 coisa pede sua atenção"
    );
  });
});

describe("ChipsRow", () => {
  it("o Ver todas (N) fica na ponta da linha dos chips, só no desktop e controlando a lista", async () => {
    const onToggle = vi.fn();
    render(
      <ChipsRow
        chips={<span>chips</span>}
        count={5}
        expanded={false}
        listId="acoes"
        onToggle={onToggle}
      />
    );
    const button = screen.getByRole("button", { name: "Ver todas (5)" });
    expect(button).toHaveAttribute("aria-controls", "acoes");
    expect(button).toHaveAttribute("aria-expanded", "false");
    expect(button.parentElement).toHaveClass(
      "hidden",
      "lg:flex",
      "wide:hidden"
    );
    await userEvent.click(button);
    expect(onToggle).toHaveBeenCalledTimes(1);
  });

  it("com 3 ações ou menos não há Ver todas", () => {
    render(
      <SeeAllButton
        count={3}
        expanded={false}
        listId="acoes"
        onToggle={vi.fn()}
      />
    );
    expect(screen.queryByRole("button")).toBeNull();
  });
});

describe("SectionTitle", () => {
  it("Bricolage 19/600 em ink, nunca ink-muted", () => {
    render(<SectionTitle id="t">Próximos 30 dias</SectionTitle>);
    const title = screen.getByRole("heading", {
      name: "Próximos 30 dias",
      level: 2,
    });
    expect(title).toHaveClass(
      "font-display",
      "text-[19px]",
      "font-semibold",
      "text-ink"
    );
    expect(title).not.toHaveClass("text-ink-muted");
  });
});
