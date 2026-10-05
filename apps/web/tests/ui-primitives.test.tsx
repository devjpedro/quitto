import { FileText, Lightning } from "@phosphor-icons/react";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import { describe, expect, it, vi } from "vitest";
import { Button } from "@/components/ui/button";
import { EmptyState, GhostCard } from "@/components/ui/empty-state";
import { IconButton } from "@/components/ui/icon-button";
import { Money } from "@/components/ui/money";
import { SegmentedControl } from "@/components/ui/segmented-control";
import { Tag } from "@/components/ui/tag";

/** Any background utility in a class list (classes are space-separated). */
const BACKGROUND_RE = /(^| )bg-/;

describe("Button", () => {
  it("is a real button that fires onClick and respects disabled", async () => {
    const onClick = vi.fn();
    const { rerender } = render(<Button onClick={onClick}>Pagar</Button>);
    await userEvent.click(screen.getByRole("button", { name: "Pagar" }));
    expect(onClick).toHaveBeenCalledTimes(1);
    rerender(
      <Button disabled onClick={onClick}>
        Pagar
      </Button>
    );
    await userEvent.click(screen.getByRole("button", { name: "Pagar" }));
    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it("defaults to type=button so it never submits forms by accident", () => {
    render(<Button>Ok</Button>);
    expect(screen.getByRole("button")).toHaveAttribute("type", "button");
  });

  it("onBrand swaps the focus ring so it stays visible on the brand surface", () => {
    render(<Button variant="onBrand">Entrar</Button>);
    const button = screen.getByRole("button", { name: "Entrar" });
    expect(button).toHaveClass(
      "focus-visible:ring-highlight",
      "focus-visible:ring-offset-brand-surface"
    );
    expect(button).not.toHaveClass("focus-visible:ring-brand");
    expect(button).not.toHaveClass("focus-visible:ring-offset-surface");
  });

  it("onBrand stays light on the green card in the dark theme (mockup 08), hover included", () => {
    render(<Button variant="onBrand">Entrar</Button>);
    expect(screen.getByRole("button", { name: "Entrar" })).toHaveClass(
      "dark:bg-ink",
      "dark:text-ink-inverse",
      "dark:hover:bg-ink/90"
    );
  });

  it("onBrandOutline swaps the focus ring too", () => {
    render(<Button variant="onBrandOutline">Recusar</Button>);
    const button = screen.getByRole("button", { name: "Recusar" });
    expect(button).toHaveClass(
      "focus-visible:ring-highlight",
      "focus-visible:ring-offset-brand-surface"
    );
    expect(button).not.toHaveClass("focus-visible:ring-brand");
    expect(button).not.toHaveClass("focus-visible:ring-offset-surface");
  });

  it("inset: the secondary button inside a card, filled one step lighter, no border", () => {
    render(<Button variant="inset">Já paguei</Button>);
    const button = screen.getByRole("button", { name: "Já paguei" });
    expect(button).toHaveClass("bg-surface-inset");
    expect(button).not.toHaveClass("border");
  });

  it("inset hover: its own token, a step away from the hovered card in light, dark and on a phone", () => {
    render(<Button variant="inset">Já paguei</Button>);
    expect(screen.getByRole("button", { name: "Já paguei" })).toHaveClass(
      "hover:bg-surface-inset-hover"
    );
  });
});

describe("IconButton", () => {
  it("exposes its label as the accessible name and shows a badge count", () => {
    render(
      <IconButton
        badge={3}
        icon={Lightning}
        label="Notificações, 3 não lidas"
      />
    );
    const button = screen.getByRole("button", {
      name: "Notificações, 3 não lidas",
    });
    expect(button).toBeVisible();
    expect(button).toHaveTextContent("3");
    // the badge is decorative: the count reaches assistive tech through the label
    expect(screen.getByText("3")).toHaveAttribute("aria-hidden", "true");
  });
});

describe("Tag", () => {
  it("renders its text (status is never color-only)", () => {
    render(<Tag tone="danger">Atrasada</Tag>);
    expect(screen.getByText("Atrasada")).toBeVisible();
  });

  it("neutral sits inside a card: one step lighter (surface-inset), never the sunken surface", () => {
    render(<Tag>opcional</Tag>);
    expect(screen.getByText("opcional")).toHaveClass(
      "bg-surface-inset",
      "text-ink-muted"
    );
  });

  it("ink is the black of action: the 'Vence hoje' tag", () => {
    render(<Tag tone="ink">Vence hoje</Tag>);
    expect(screen.getByText("Vence hoje")).toHaveClass(
      "bg-ink",
      "text-ink-inverse"
    );
  });
});

function Segmented() {
  const [value, setValue] = useState<"active" | "done">("active");
  return (
    <>
      <SegmentedControl
        label="Situação"
        onValueChange={setValue}
        options={[
          { value: "active", label: "Ativos", count: 5 },
          { value: "done", label: "Concluídos", count: 2 },
        ]}
        value={value}
      />
      <output>{value}</output>
    </>
  );
}

describe("SegmentedControl", () => {
  it("selects with the keyboard and never ends up empty", async () => {
    render(<Segmented />);
    const group = screen.getByRole("group", { name: "Situação" });
    expect(group).toBeVisible();
    await userEvent.tab();
    expect(screen.getByRole("radio", { name: "Ativos 5" })).toHaveFocus();
    await userEvent.keyboard("{ArrowRight}");
    expect(screen.getByRole("radio", { name: "Concluídos 2" })).toHaveFocus();
    await userEvent.keyboard(" ");
    expect(screen.getByRole("status")).toHaveTextContent("done");
    // clicking the selected option again keeps it selected
    await userEvent.click(screen.getByRole("radio", { name: "Concluídos 2" }));
    expect(screen.getByRole("status")).toHaveTextContent("done");
  });
});

describe("Money", () => {
  it("inline renders the full localized amount", () => {
    render(<Money cents={125_000} />);
    expect(screen.getByText("R$ 1.250,00")).toBeVisible();
  });

  it("card keeps the full amount for screen readers and splits the visual parts", () => {
    const { container } = render(<Money cents={125_050} size="card" />);
    expect(screen.getByText("R$ 1.250,50")).toHaveClass("sr-only");
    const visual = container.querySelector("[aria-hidden='true']");
    expect(visual).toHaveTextContent("R$1.250,50");
  });

  it("card shows the minus sign for negative values", () => {
    const { container } = render(<Money cents={-900} size="card" />);
    expect(container.querySelector("[aria-hidden='true']")).toHaveTextContent(
      "-R$9,00"
    );
  });
});

describe("EmptyState", () => {
  it("renders title, description, action and the ghost preview", () => {
    render(
      <EmptyState
        action={<Button>Novo contrato</Button>}
        description="Cada contrato mostra quanto já foi quitado."
        icon={FileText}
        preview={<GhostCard />}
        title="Seus acordos aparecem aqui"
      />
    );
    expect(
      screen.getByRole("heading", { name: "Seus acordos aparecem aqui" })
    ).toBeVisible();
    expect(
      screen.getByText("Cada contrato mostra quanto já foi quitado.")
    ).toBeVisible();
    expect(screen.getByRole("button", { name: "Novo contrato" })).toBeVisible();
  });

  it("compact: a dashed outline with no fill (DIRECAO › empty states), never a solid box", () => {
    render(
      <EmptyState
        description="Avisamos aqui quando alguém enviar um comprovante."
        icon={FileText}
        title="Nada novo por aqui"
        variant="compact"
      />
    );
    const box = screen.getByRole("heading", {
      name: "Nada novo por aqui",
    }).parentElement;
    // The same outline as GhostCard, the dashed shape of what will be there.
    expect(box).toHaveClass(
      "rounded-card",
      "border-[1.5px]",
      "border-dashed",
      "border-line-strong"
    );
    expect(box).not.toHaveClass("border-line");
    expect(box?.className).not.toMatch(BACKGROUND_RE);
  });
});
