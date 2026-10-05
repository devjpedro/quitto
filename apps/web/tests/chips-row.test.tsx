import { act, fireEvent, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { ChipsRow, SeeAllButton } from "@/features/home/components/chips-row";
import { SectionTitle } from "@/features/home/components/section-title";
import { TotalsChips } from "@/features/home/components/totals-chips";
import { homeLayout, homeSubtitle } from "@/features/home/lib/home-layout";
import { homeFixture, installmentAction } from "./home-fixtures";

// Top-level regex literals (lint/performance/useTopLevelRegex).
const OVERDUE_CHIP = /em atraso/;

/** The fade on the strip's right edge while a chip is still past it (decision 23). */
const FADE_RIGHT =
  "max-md:[mask-image:linear-gradient(to_right,black_calc(100%-24px),transparent)]";

/**
 * A ResizeObserver that records what it watches, so a test can resize one
 * element (the setup's stub never calls back).
 */
const observers = new Set<RecordingResizeObserver>();
class RecordingResizeObserver {
  readonly callback: ResizeObserverCallback;
  readonly targets = new Set<Element>();
  constructor(callback: ResizeObserverCallback) {
    this.callback = callback;
    observers.add(this);
  }
  observe(target: Element) {
    this.targets.add(target);
  }
  unobserve(target: Element) {
    this.targets.delete(target);
  }
  disconnect() {
    this.targets.clear();
    observers.delete(this);
  }
}

function resize(target: Element) {
  for (const observer of observers) {
    if (observer.targets.has(target)) {
      observer.callback([], observer as unknown as ResizeObserver);
    }
  }
}

/** The strip's measures, as on a 390 px phone; returns the restore. */
function measureStrip(sizes: {
  clientWidth: number;
  scrollLeft?: () => number;
  scrollWidth: () => number;
}) {
  const spies = [
    vi
      .spyOn(HTMLElement.prototype, "scrollWidth", "get")
      .mockImplementation(sizes.scrollWidth),
    vi
      .spyOn(HTMLElement.prototype, "clientWidth", "get")
      .mockReturnValue(sizes.clientWidth),
    vi
      .spyOn(Element.prototype, "scrollLeft", "get")
      .mockImplementation(sizes.scrollLeft ?? (() => 0)),
  ];
  return () => {
    for (const spy of spies) {
      spy.mockRestore();
    }
  };
}

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
      "max-md:px-4",
      "md:flex-wrap"
    );
    // The frame around the list bleeds to the screen edge.
    expect(strip.parentElement).toHaveClass("max-md:-mx-4");
    for (const item of within(strip).getAllByRole("listitem")) {
      expect(item).toHaveClass("shrink-0");
    }
    // Nothing overflows here (jsdom measures 0): no tab stop that scrolls nothing, and no fade.
    expect(strip).not.toHaveAttribute("tabindex");
    expect(strip).not.toHaveClass(FADE_RIGHT);
  });

  it("o foco da faixa é um anel por fora, na moldura: a máscara do esmaecido cortaria um anel da própria lista", () => {
    render(<TotalsChips {...ALL} />);
    const strip = screen.getByRole("list", { name: "Resumo" });
    expect(strip.parentElement).toHaveClass(
      "has-focus-visible:ring-2",
      "has-focus-visible:ring-brand",
      "rounded-control"
    );
    // A mask clips whatever the list paints outside its box, a ring included;
    // an inset ring would paint under the chips.
    expect(strip).not.toHaveClass("focus-visible:ring-2");
    expect(strip).not.toHaveClass("focus-visible:ring-inset");
  });

  it("no celular, a borda direita esmaece enquanto há chip à direita, e o esmaecido some no fim da rolagem", () => {
    // 620 px of chips in a 358 px box: the end is at scrollLeft 262.
    let scrollLeft = 0;
    const restore = measureStrip({
      clientWidth: 358,
      scrollLeft: () => scrollLeft,
      scrollWidth: () => 620,
    });
    try {
      render(<TotalsChips {...ALL} />);
      const strip = screen.getByRole("list", { name: "Resumo" });
      // The start: chips past the right edge.
      expect(strip).toHaveClass(FADE_RIGHT);
      // The middle.
      scrollLeft = 131;
      fireEvent.scroll(strip);
      expect(strip).toHaveClass(FADE_RIGHT);
      // The end: the last chip is in full view, and nothing fades.
      scrollLeft = 262;
      fireEvent.scroll(strip);
      expect(strip).not.toHaveClass(FADE_RIGHT);
      // Back towards the start: the fade returns.
      scrollLeft = 200;
      fireEvent.scroll(strip);
      expect(strip).toHaveClass(FADE_RIGHT);
    } finally {
      restore();
    }
  });

  it("um chip que toma o lugar de outro (a mesma contagem) também é medido quando cresce", async () => {
    vi.stubGlobal("ResizeObserver", RecordingResizeObserver);
    let contentWidth = 300;
    const restore = measureStrip({
      clientWidth: 358,
      scrollWidth: () => contentWidth,
    });
    try {
      const { rerender } = render(
        <TotalsChips {...ALL} overdueToReceiveCents={0} toReceiveCents={0} />
      );
      // The same refetch clears the overdue to pay and brings "a receber · 30d": still 3 chips.
      rerender(
        <TotalsChips {...ALL} overdueToPayCents={0} overdueToReceiveCents={0} />
      );
      // The new chip arrives as a DOM mutation (delivered in a microtask).
      await act(async () => {
        await Promise.resolve();
      });
      const strip = screen.getByRole("list", { name: "Resumo" });
      expect(strip).not.toHaveAttribute("tabindex");
      // A later refetch grows that chip's amount: the strip now scrolls.
      contentWidth = 620;
      act(() => resize(screen.getByText("a receber · 30d")));
      expect(strip).toHaveAttribute("tabindex", "0");
    } finally {
      restore();
      vi.unstubAllGlobals();
    }
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

  it("o aux fica à direita, em 13 px ink-muted; o título com −0,02 em", () => {
    render(
      <SectionTitle aux="5 parcelas" id="t">
        Próximos 30 dias
      </SectionTitle>
    );
    const title = screen.getByRole("heading", { name: "Próximos 30 dias" });
    expect(title).toHaveClass("tracking-[-0.02em]");
    const aux = screen.getByText("5 parcelas");
    expect(aux).toBeVisible();
    expect(aux).toHaveClass("text-[13px]", "text-ink-muted", "tabular-nums");
    // Beside the title, not inside it: the heading's name stays the title alone.
    expect(title).not.toContainElement(aux);
    expect(aux.parentElement).toBe(title.parentElement);
    expect(title.parentElement).toHaveClass("justify-between");
  });
});
