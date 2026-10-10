import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import { describe, expect, it, vi } from "vitest";
import { InstallmentsCalendar } from "@/features/installments/components/installments-calendar";
import { listInstallment } from "./installments-fixtures";

const TODAY = "2026-10-08";
const ITEMS = [
  listInstallment({
    installmentId: "a",
    contractTitle: "Notebook da Marina",
    dueDate: "2026-10-05",
    direction: "receive",
    counterpartyName: "Marina Pires",
  }),
  listInstallment({
    installmentId: "b",
    dueDate: "2026-10-15",
    contractTitle: "Aluguel",
  }),
  listInstallment({
    installmentId: "c",
    dueDate: "2026-10-15",
    contractTitle: "Celular",
  }),
];

function Harness({ onSeeCarried = vi.fn(), carried = 0 }) {
  const [day, setDay] = useState(TODAY);
  return (
    <InstallmentsCalendar
      carried={carried}
      day={day}
      items={ITEMS}
      locale="pt-BR"
      month="2026-10"
      onDay={setDay}
      onIntent={vi.fn()}
      onOpen={vi.fn()}
      onSeeCarried={onSeeCarried}
      selectedId={null}
      today={TODAY}
    />
  );
}

describe("InstallmentsCalendar", () => {
  it("escolher o dia mostra as parcelas dele", async () => {
    const user = userEvent.setup();
    render(<Harness />);
    expect(screen.getByText("Nada vence neste dia.")).toBeVisible();
    await user.click(screen.getByTestId("calendar-day-2026-10-05"));
    expect(screen.getByTestId("calendar-day-2026-10-05")).toHaveAttribute(
      "aria-pressed",
      "true"
    );
    const list = screen.getByTestId("installments-day");
    expect(list).toHaveTextContent("Notebook da Marina");
    expect(list).toHaveTextContent("Atrasada · 3 dias");
  });

  it("o nome do dia diz a data e quantas parcelas", () => {
    render(<Harness />);
    expect(
      screen.getByRole("button", { name: "15 de outubro, 2 parcelas" })
    ).toBeVisible();
    expect(
      screen.getByRole("button", { name: "5 de outubro, 1 parcela" })
    ).toBeVisible();
    expect(
      screen.getByRole("button", { name: "9 de outubro, nenhuma parcela" })
    ).toBeVisible();
  });

  it("Ver na lista chama a troca para a lista com Atrasadas", async () => {
    const user = userEvent.setup();
    const onSeeCarried = vi.fn();
    render(<Harness carried={2} onSeeCarried={onSeeCarried} />);
    expect(screen.getByText("2 atrasadas de meses anteriores")).toBeVisible();
    await user.click(screen.getByRole("button", { name: "Ver na lista" }));
    expect(onSeeCarried).toHaveBeenCalledOnce();
  });

  it("os dias de fora do mês ficam desabilitados", () => {
    render(<Harness />);
    expect(screen.getByTestId("calendar-day-2026-09-27")).toBeDisabled();
  });
});
