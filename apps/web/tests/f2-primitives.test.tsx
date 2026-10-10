import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ConfirmDialog } from "@/components/ui/dialog";
import { TextArea, TextField } from "@/components/ui/field";
import { InstallmentBar } from "@/components/ui/installment-bar";
import { InstallmentBarKey } from "@/components/ui/installment-bar-key";
import { Menu, MenuItem, MenuSeparator } from "@/components/ui/menu";
import { Money } from "@/components/ui/money";
import { NumberTile } from "@/components/ui/number-tile";
import { PersonAvatar } from "@/components/ui/person-avatar";
import { SectionBoundary } from "@/components/ui/section-boundary";

const MONEY_TEXT = /R\$\s?3\.840,00/;

afterEach(() => vi.restoreAllMocks());

describe("TextField / TextArea", () => {
  it("o rótulo nomeia o campo, a dica o descreve e o contorno é field-line", () => {
    render(
      <TextField
        hint="PDF, JPG ou PNG · até 10 MB"
        id="key"
        label="Chave PIX"
      />
    );
    const input = screen.getByRole("textbox", { name: "Chave PIX" });
    expect(input).toHaveAccessibleDescription("PDF, JPG ou PNG · até 10 MB");
    expect(input).toHaveClass("border-field-line");
    expect(input).not.toHaveAttribute("aria-invalid");
  });

  it("com erro: aria-invalid, a frase descreve o campo e o anel é danger (sem contorno cinza)", () => {
    render(<TextField error="Chave inválida" id="key" label="Chave PIX" />);
    const input = screen.getByRole("textbox", { name: "Chave PIX" });
    expect(input).toHaveAttribute("aria-invalid", "true");
    expect(input).toHaveAccessibleDescription("Chave inválida");
    expect(input).toHaveClass("ring-danger");
    expect(input).not.toHaveClass("border-field-line");
  });

  it("com aviso: anel warning, sem contorno cinza, a frase descreve o campo e não é erro", () => {
    render(<TextField id="key" label="Chave PIX" warning="Confira a chave" />);
    const input = screen.getByRole("textbox", { name: "Chave PIX" });
    expect(input).toHaveClass("ring-warning");
    expect(input).not.toHaveClass("border-field-line");
    expect(input).toHaveAccessibleDescription("Confira a chave");
    expect(input).not.toHaveAttribute("aria-invalid");
  });

  it("TextArea com contador à direita do rótulo, e o que se digita chega ao onChange", async () => {
    const onChange = vi.fn();
    render(
      <TextArea
        counter="0/500"
        id="reason"
        label="Por que você está contestando?"
        maxLength={500}
        onChange={onChange}
      />
    );
    expect(screen.getByText("0/500")).toBeVisible();
    await userEvent.type(
      screen.getByRole("textbox", { name: "Por que você está contestando?" }),
      "Veio R$ 240,00"
    );
    expect(onChange).toHaveBeenCalled();
    expect(
      screen.getByRole("textbox", { name: "Por que você está contestando?" })
    ).toHaveValue("Veio R$ 240,00");
  });
});

describe("Menu", () => {
  it("abre pelo gatilho, lista os itens e chama onSelect; o perigoso é danger", async () => {
    const onDelete = vi.fn();
    render(
      <Menu
        label="Ações do contrato"
        trigger={<button type="button">Mais</button>}
      >
        <MenuItem onSelect={() => undefined}>Convidar pessoa</MenuItem>
        <MenuSeparator />
        <MenuItem onSelect={onDelete} tone="danger">
          Excluir contrato
        </MenuItem>
      </Menu>
    );
    await userEvent.click(screen.getByRole("button", { name: "Mais" }));
    const remove = await screen.findByRole("menuitem", {
      name: "Excluir contrato",
    });
    expect(remove).toHaveClass("text-danger");
    await userEvent.click(remove);
    expect(onDelete).toHaveBeenCalledOnce();
  });
});

describe("NumberTile", () => {
  it("o número em mono no tile tingido pelo estado", () => {
    const { container, rerender } = render(
      <NumberTile label="03" tone="overdue" />
    );
    const tile = container.firstElementChild;
    expect(tile).toHaveAttribute("aria-hidden", "true");
    expect(tile).toHaveClass(
      "font-mono",
      "size-11",
      "bg-danger-subtle",
      "text-danger"
    );
    rerender(<NumberTile label="07" tone="today" />);
    expect(container.firstElementChild).toHaveClass(
      "bg-ink",
      "text-ink-inverse"
    );
  });

  it("na linha selecionada, o tile pago ou aberto vira inset (o row-selected é o mesmo verde)", () => {
    const { container } = render(
      <NumberTile label="01" selected tone="paid" />
    );
    expect(container.firstElementChild).toHaveClass(
      "bg-surface-inset",
      "text-brand"
    );
    expect(container.firstElementChild).not.toHaveClass("bg-brand-subtle");
  });

  it("um intervalo usa o corpo menor", () => {
    const { container } = render(
      <NumberTile label="01–02" range tone="paid" />
    );
    expect(container.firstElementChild).toHaveClass("text-[11.5px]");
  });
});

describe("InstallmentBar alta e a legenda-chave", () => {
  it("tall: 8 px de altura e 3 px entre os segmentos", () => {
    const { container } = render(
      <InstallmentBar
        installmentsCount={3}
        overdueCount={1}
        paidCount={1}
        size="tall"
        statuses={["paid", "overdue", "open"]}
      />
    );
    expect(container.firstElementChild).toHaveClass("h-2", "gap-[3px]");
  });

  it("a legenda diz cada estado com texto (status nunca só por cor) e a ponta à direita", () => {
    render(
      <InstallmentBarKey
        end="termina em mar/2027"
        entries={[
          { status: "paid", count: 2, label: "confirmadas" },
          { status: "overdue", count: 1, label: "atrasada" },
        ]}
      />
    );
    expect(screen.getByText("confirmadas").parentElement).toHaveTextContent(
      "2 confirmadas"
    );
    expect(screen.getByText("termina em mar/2027")).toHaveClass("ml-auto");
  });
});

describe("Money hero, PersonAvatar e SectionBoundary", () => {
  it("Money hero: 40 px no desktop, 36 no celular, com o valor inteiro para o leitor de tela", () => {
    const { container } = render(<Money cents={384_000} size="hero" />);
    expect(container.firstElementChild).toHaveClass(
      "text-[36px]",
      "md:text-[40px]"
    );
    expect(screen.getByText(MONEY_TEXT)).toHaveClass("sr-only");
  });

  it("PersonAvatar lg tem 40 px; self usa o verde claro do próprio usuário", () => {
    const { container } = render(
      <PersonAvatar name="João Souza" self size="lg" />
    );
    expect(container.firstElementChild).toHaveClass(
      "size-10",
      "bg-brand-subtle",
      "text-brand"
    );
    expect(container.firstElementChild).not.toHaveClass("text-on-avatar");
  });

  it("renderError substitui o Tentar de novo quando devolve algo", () => {
    function Boom(): never {
      throw new Error("404");
    }
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    render(
      <SectionBoundary
        fallback={null}
        renderError={() => <p>Contrato não encontrado</p>}
      >
        <Boom />
      </SectionBoundary>
    );
    expect(screen.getByText("Contrato não encontrado")).toBeVisible();
    expect(screen.queryByRole("button")).toBeNull();
  });

  it("renderError que devolve null cai no Tentar de novo", () => {
    function Boom(): never {
      throw new Error("500");
    }
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    render(
      <SectionBoundary fallback={null} renderError={() => null}>
        <Boom />
      </SectionBoundary>
    );
    expect(
      screen.getByRole("button", { name: "Tentar de novo" })
    ).toBeVisible();
  });
});

describe("ConfirmDialog", () => {
  it("abre com o foco no Cancelar; Excluir chama onConfirm", async () => {
    const onConfirm = vi.fn();
    render(
      <ConfirmDialog
        cancelLabel="Cancelar"
        confirmLabel="Excluir"
        description="Parcelas, comprovantes e histórico são apagados."
        onConfirm={onConfirm}
        onOpenChange={() => undefined}
        open
        pending={false}
        title="Excluir contrato"
        tone="danger"
      />
    );
    const dialog = await screen.findByRole("dialog", {
      name: "Excluir contrato",
    });
    expect(dialog).toHaveAccessibleDescription(
      "Parcelas, comprovantes e histórico são apagados."
    );
    expect(screen.getByRole("button", { name: "Cancelar" })).toHaveFocus();
    await userEvent.click(screen.getByRole("button", { name: "Excluir" }));
    expect(onConfirm).toHaveBeenCalledOnce();
  });
});
