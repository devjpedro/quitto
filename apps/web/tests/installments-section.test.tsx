import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { InstallmentsSection } from "../src/components/installments-section";

const ALL_18 = /Todas \(18\)/;
const PAID_2 = /Pagas \(2\)/;
const OVERDUE_1 = /Atrasadas \(1\)/;
const OVERDUE_0 = /Atrasadas \(0\)/;
const DUE_16 = /A pagar \(16\)/;
const ROW = /^installment-row-/;
const LOAD_MORE_3 = /Carregar mais \(3/;
const LOAD_MORE = /Carregar mais/;

// 2 pagas, 1 atrasada (pending vencida), 15 futuras (a pagar) → 18 no total.
function makeInstallments() {
  const list = [
    {
      id: "p1",
      sequence: 1,
      amountCents: 1000,
      dueDate: "2026-01-10",
      status: "paid",
    },
    {
      id: "p2",
      sequence: 2,
      amountCents: 1000,
      dueDate: "2026-02-10",
      status: "confirmed",
    },
    {
      id: "late",
      sequence: 3,
      amountCents: 1000,
      dueDate: "2026-05-10",
      status: "pending",
    },
  ];
  // 15 parcelas futuras (> hoje 2026-06-15) → "a pagar" e NÃO atrasadas.
  for (let i = 4; i <= 18; i++) {
    list.push({
      id: `f${i}`,
      sequence: i,
      amountCents: 1000,
      dueDate: "2027-01-10",
      status: "pending",
    });
  }
  return list;
}

// Fixar "hoje" para o cálculo de atrasada/overdue (a parcela #3 vence 2026-05-10).
vi.mock("../src/lib/format", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../src/lib/format")>();
  return { ...actual, todayISO: () => "2026-06-15" };
});

describe("InstallmentsSection", () => {
  it("default mostra Todas, com os 4 chips e contagens", () => {
    render(
      <InstallmentsSection
        installments={makeInstallments()}
        onSelect={vi.fn()}
      />
    );
    expect(screen.getByRole("button", { name: ALL_18 })).toHaveAttribute(
      "aria-pressed",
      "true"
    );
    expect(screen.getByRole("button", { name: PAID_2 })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: OVERDUE_1 })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: DUE_16 })).toBeInTheDocument();
  });

  it("limita a 15 e mostra 'Carregar mais'; clicar revela o resto", () => {
    render(
      <InstallmentsSection
        installments={makeInstallments()}
        onSelect={vi.fn()}
      />
    );
    expect(screen.getAllByTestId(ROW)).toHaveLength(15);
    const more = screen.getByRole("button", { name: LOAD_MORE_3 });
    fireEvent.click(more);
    expect(screen.getAllByTestId(ROW)).toHaveLength(18);
    expect(screen.queryByRole("button", { name: LOAD_MORE })).toBeNull();
  });

  it("filtra ao clicar num chip e move o aria-pressed", () => {
    render(
      <InstallmentsSection
        installments={makeInstallments()}
        onSelect={vi.fn()}
      />
    );
    fireEvent.click(screen.getByRole("button", { name: PAID_2 }));
    expect(screen.getByRole("button", { name: PAID_2 })).toHaveAttribute(
      "aria-pressed",
      "true"
    );
    expect(screen.getAllByTestId(ROW)).toHaveLength(2);
  });

  it("mostra empty state quando o filtro não tem itens", () => {
    const noOverdue = [
      {
        id: "p1",
        sequence: 1,
        amountCents: 1000,
        dueDate: "2026-01-10",
        status: "paid",
      },
    ];
    render(<InstallmentsSection installments={noOverdue} onSelect={vi.fn()} />);
    fireEvent.click(screen.getByRole("button", { name: OVERDUE_0 }));
    expect(screen.getByText("Nenhuma parcela atrasada.")).toBeInTheDocument();
  });

  it("não mostra 'Carregar mais' quando há ≤ 15 itens", () => {
    const few = makeInstallments().slice(0, 10);
    render(<InstallmentsSection installments={few} onSelect={vi.fn()} />);
    expect(screen.queryByRole("button", { name: LOAD_MORE })).toBeNull();
  });

  it("chama onSelect com o id ao clicar numa linha", () => {
    const onSelect = vi.fn();
    render(
      <InstallmentsSection
        installments={makeInstallments()}
        onSelect={onSelect}
      />
    );
    fireEvent.click(screen.getByTestId("installment-row-p1"));
    expect(onSelect).toHaveBeenCalledWith("p1");
  });
});
