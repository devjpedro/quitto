import { ArrowDownLeft, ArrowUpRight } from "@phosphor-icons/react";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import { describe, expect, it, vi } from "vitest";
import { CheckboxCard } from "@/components/ui/checkbox-card";
import { DateField } from "@/components/ui/date-field";
import { TextField } from "@/components/ui/field";
import { MoneyField } from "@/components/ui/money-field";
import { OptionCard, OptionGroup } from "@/components/ui/option-card";
import { PlaceholderBlock } from "@/components/ui/placeholder-block";

function Money({ onValue }: { onValue: (cents: number | null) => void }) {
  const [value, setValue] = useState<number | null>(null);
  return (
    <MoneyField
      id="total"
      label="Valor total"
      locale="pt-BR"
      onValueChange={(cents) => {
        setValue(cents);
        onValue(cents);
      }}
      value={value}
    />
  );
}

describe("TextField (acréscimos da Fase 3)", () => {
  it("o 'opcional' entra no nome do campo; os adornos não", () => {
    render(
      <TextField
        id="desc"
        label="Descrição"
        leading="R$"
        optionalLabel="opcional"
        trailing="parcelas"
      />
    );
    expect(
      screen.getByRole("textbox", { name: "Descrição opcional" })
    ).toBeVisible();
  });

  it("o campo alto do wizard", () => {
    render(<TextField id="t" label="Nome do contrato" tall />);
    expect(
      screen.getByRole("textbox", { name: "Nome do contrato" })
    ).toHaveClass("h-12");
  });

  it("labelHidden: o rótulo fica no nome acessível, só para o leitor de tela, e nada vaza para o input", () => {
    render(<TextField id="row-1" label="Valor da parcela 1" labelHidden />);
    const input = screen.getByRole("textbox", { name: "Valor da parcela 1" });
    expect(input).not.toHaveAttribute("labelhidden");
    expect(screen.getByText("Valor da parcela 1").parentElement).toHaveClass(
      "sr-only"
    );
  });
});

describe("MoneyField", () => {
  it("digitar 6000 dá 600000 centavos; sair do campo formata", async () => {
    const user = userEvent.setup();
    const onValue = vi.fn();
    render(<Money onValue={onValue} />);
    const input = screen.getByRole("textbox", { name: "Valor total" });
    expect(input).toHaveAttribute("inputmode", "decimal");
    await user.type(input, "6000");
    expect(onValue).toHaveBeenLastCalledWith(600_000);
    await user.tab();
    expect(input).toHaveValue("6.000,00");
  });

  it("um valor que chega de fora aparece quando o campo não está em uso", () => {
    const { rerender } = render(
      <MoneyField
        id="t"
        label="Valor total"
        locale="pt-BR"
        onValueChange={vi.fn()}
        value={600_000}
      />
    );
    rerender(
      <MoneyField
        id="t"
        label="Valor total"
        locale="pt-BR"
        onValueChange={vi.fn()}
        value={710_000}
      />
    );
    expect(screen.getByRole("textbox", { name: "Valor total" })).toHaveValue(
      "7.100,00"
    );
  });

  it("o erro descreve o campo e o marca inválido", () => {
    render(
      <MoneyField
        error="O total precisa ser maior que zero."
        id="t"
        label="Valor total"
        locale="pt-BR"
        onValueChange={vi.fn()}
        value={0}
      />
    );
    const input = screen.getByRole("textbox", { name: "Valor total" });
    expect(input).toHaveAttribute("aria-invalid", "true");
    expect(input).toHaveAccessibleDescription(
      "O total precisa ser maior que zero."
    );
  });
});

describe("DateField", () => {
  it("digita dd/mm/aaaa e devolve o ISO, com as barras no lugar", async () => {
    const user = userEvent.setup();
    const onValueChange = vi.fn();
    function Controlled() {
      const [value, setValue] = useState("");
      return (
        <DateField
          id="first"
          label="1º vencimento"
          onValueChange={(iso) => {
            onValueChange(iso);
            setValue(iso);
          }}
          value={value}
        />
      );
    }
    render(<Controlled />);
    const input = screen.getByLabelText("1º vencimento");
    expect(input).toHaveAttribute("placeholder", "dd/mm/aaaa");
    await user.type(input, "10112026");
    expect(input).toHaveValue("10/11/2026");
    expect(onValueChange).toHaveBeenLastCalledWith("2026-11-10");
  });

  it("data pela metade ou impossível: devolve vazio e guarda o que foi digitado", async () => {
    const user = userEvent.setup();
    const onValueChange = vi.fn();
    render(
      <DateField
        id="first"
        label="1º vencimento"
        onValueChange={onValueChange}
        value=""
      />
    );
    const input = screen.getByLabelText("1º vencimento");
    await user.type(input, "3102");
    expect(input).toHaveValue("31/02");
    expect(onValueChange).toHaveBeenLastCalledWith("");
    await user.type(input, "2026");
    expect(input).toHaveValue("31/02/2026");
    expect(onValueChange).toHaveBeenLastCalledWith("");
  });

  it("o aviso não marca inválido, mas descreve", () => {
    render(
      <DateField
        id="first"
        label="1º vencimento"
        onValueChange={vi.fn()}
        value="2026-09-10"
        warning="Essa data já passou: as parcelas antes de hoje entram como atrasadas."
      />
    );
    const input = screen.getByLabelText("1º vencimento");
    expect(input).not.toHaveAttribute("aria-invalid");
    expect(input).toHaveAccessibleDescription(
      "Essa data já passou: as parcelas antes de hoje entram como atrasadas."
    );
  });
});

function Roles() {
  const [value, setValue] = useState<string | null>(null);
  return (
    <OptionGroup
      id="role"
      label="Nesse acordo, você paga ou recebe?"
      layout="tall"
      onValueChange={setValue}
      value={value}
    >
      <OptionCard
        checked={value === "buyer"}
        hint="Comprei parcelado, peguei emprestado ou divido uma conta."
        icon={ArrowUpRight}
        title="Eu pago"
        value="buyer"
        variant="tall"
      />
      <OptionCard
        checked={value === "seller"}
        hint="Vendi parcelado, emprestei ou alugo algo."
        icon={ArrowDownLeft}
        title="Eu recebo"
        value="seller"
        variant="tall"
      />
    </OptionGroup>
  );
}

describe("OptionGroup / OptionCard", () => {
  it("um radiogroup: o nome é o título, a dica descreve, o clique escolhe", async () => {
    const user = userEvent.setup();
    render(<Roles />);
    expect(
      screen.getByRole("radiogroup", {
        name: "Nesse acordo, você paga ou recebe?",
      })
    ).toBeVisible();
    const receive = screen.getByRole("radio", { name: "Eu recebo" });
    expect(receive).toHaveAccessibleDescription(
      "Vendi parcelado, emprestei ou alugo algo."
    );
    await user.click(receive);
    expect(receive).toBeChecked();
    expect(receive).toHaveAttribute("data-state", "checked");
    expect(screen.getByRole("radio", { name: "Eu pago" })).toHaveAttribute(
      "data-state",
      "unchecked"
    );
  });

  it("as setas andam entre as opções e o espaço escolhe", async () => {
    const user = userEvent.setup();
    render(<Roles />);
    await user.click(screen.getByRole("radio", { name: "Eu pago" }));
    await user.keyboard("{ArrowRight}");
    // Radix moves the focus on the next tick (roving focus). In a browser the
    // choice follows the focus; jsdom does not run that part, so Space picks.
    const receive = screen.getByRole("radio", { name: "Eu recebo" });
    await waitFor(() => expect(receive).toHaveFocus());
    await user.keyboard(" ");
    expect(receive).toBeChecked();
  });
});

describe("CheckboxCard", () => {
  it("o título é o nome; tocar no texto marca", async () => {
    const user = userEvent.setup();
    const onCheckedChange = vi.fn();
    render(
      <CheckboxCard
        checked={false}
        hint="Quando Renata marcar uma parcela como paga, ela só conta depois que você conferir."
        id="confirm"
        onCheckedChange={onCheckedChange}
        title="Quero confirmar cada pagamento"
      />
    );
    await user.click(screen.getByText("Quero confirmar cada pagamento"));
    expect(onCheckedChange).toHaveBeenCalledWith(true);
    expect(
      screen.getByRole("checkbox", { name: "Quero confirmar cada pagamento" })
    ).toBeVisible();
  });
});

describe("PlaceholderBlock", () => {
  it("diz o que vai aparecer ali, num contorno tracejado", () => {
    render(<PlaceholderBlock shape="title">Nome do contrato</PlaceholderBlock>);
    expect(screen.getByText("Nome do contrato")).toHaveClass("border-dashed");
  });
});
