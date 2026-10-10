import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import { describe, expect, it, vi } from "vitest";
import { MonthSelect } from "@/components/ui/month-select";
import { Select } from "@/components/ui/select";
import { InstallmentsToolbar } from "@/features/installments/components/installments-toolbar";

function Fruits() {
  const [value, setValue] = useState("banana");
  return (
    <Select
      groups={[
        {
          options: [
            { value: "apple", label: "Maçã" },
            { value: "banana", label: "Banana" },
            { value: "cherry", label: "Cereja" },
          ],
        },
      ]}
      label="Fruta"
      onValueChange={setValue}
      value={value}
    />
  );
}

describe("Select", () => {
  it("o gatilho mostra a escolhida; o clique abre a lista com ✓ nela; escolher fecha", async () => {
    const user = userEvent.setup();
    render(<Fruits />);
    const trigger = screen.getByRole("combobox", { name: "Fruta" });
    expect(trigger).toHaveTextContent("Banana");
    await user.click(trigger);
    expect(
      await screen.findByRole("option", { name: "Banana" })
    ).toHaveAttribute("aria-selected", "true");
    await user.click(screen.getByRole("option", { name: "Cereja" }));
    expect(trigger).toHaveTextContent("Cereja");
    expect(screen.queryByRole("listbox")).toBeNull();
  });

  it("teclado: Enter abre, setas andam, Enter escolhe, a letra salta para a opção", async () => {
    const user = userEvent.setup();
    render(<Fruits />);
    screen.getByRole("combobox", { name: "Fruta" }).focus();
    await user.keyboard("{Enter}");
    await screen.findByRole("listbox");
    await user.keyboard("{ArrowUp}{Enter}");
    expect(screen.getByRole("combobox", { name: "Fruta" })).toHaveTextContent(
      "Maçã"
    );
    await user.keyboard("{Enter}");
    await screen.findByRole("listbox");
    await user.keyboard("c{Enter}");
    expect(screen.getByRole("combobox", { name: "Fruta" })).toHaveTextContent(
      "Cereja"
    );
  });
});

describe("MonthSelect", () => {
  it("mostra 'Outubro de 2026', agrupa por ano e devolve o mês escolhido", async () => {
    const user = userEvent.setup();
    const onMonthChange = vi.fn();
    render(
      <MonthSelect
        label="Escolher o mês"
        locale="pt-BR"
        month="2026-10"
        onMonthChange={onMonthChange}
      />
    );
    const trigger = screen.getByRole("combobox", { name: "Escolher o mês" });
    expect(trigger).toHaveTextContent("Outubro de 2026");
    await user.click(trigger);
    await user.click(
      within(await screen.findByRole("group", { name: "2027" })).getByRole(
        "option",
        { name: "Janeiro" }
      )
    );
    expect(onMonthChange).toHaveBeenCalledWith("2027-01");
  });

  it("em inglês: 'October 2026'", () => {
    render(
      <MonthSelect
        label="Choose the month"
        locale="en-US"
        month="2026-10"
        onMonthChange={vi.fn()}
      />
    );
    expect(
      screen.getByRole("combobox", { name: "Choose the month" })
    ).toHaveTextContent("October 2026");
  });
});

describe("Parcelas, o mês", () => {
  it("o título é o Select do mês; as setas e o Select mudam o mês", async () => {
    const user = userEvent.setup();
    const onMonth = vi.fn();
    render(
      <InstallmentsToolbar
        counts={{ awaiting: 0, overdue: 0 }}
        current={false}
        filter={undefined}
        locale="pt-BR"
        month="2026-11"
        onFilter={vi.fn()}
        onMonth={onMonth}
      />
    );
    expect(
      screen.getByRole("combobox", { name: "Escolher o mês" })
    ).toHaveTextContent("Novembro de 2026");
    await user.click(screen.getByRole("button", { name: "Próximo mês" }));
    expect(onMonth).toHaveBeenLastCalledWith("2026-12");
    await user.click(screen.getByRole("combobox", { name: "Escolher o mês" }));
    await user.click(
      within(await screen.findByRole("group", { name: "2026" })).getByRole(
        "option",
        { name: "Setembro" }
      )
    );
    expect(onMonth).toHaveBeenLastCalledWith("2026-09");
  });
});
