import { screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ContractPage } from "@/features/contracts/components/contract-page";
import { CONTRACT_SLOTS } from "@/features/contracts/components/contract-slots";
import type { ContractDetail } from "@/features/contracts/types";
import { queryKeys } from "@/lib/query-keys";
import { motoDetail } from "./contract-fixtures";
import { makeTestQueryClient, renderWithProviders } from "./test-utils";

const { navigate, route } = vi.hoisted(() => ({
  navigate: vi.fn(),
  route: { search: {} as Record<string, unknown> },
}));

vi.mock("@/lib/api", () => ({
  api: {
    api: {
      contracts: () => ({
        get: () => Promise.resolve({ data: null, error: null }),
      }),
    },
  },
}));

interface LinkProps {
  children: ReactNode;
  className?: string;
  to: string;
}

vi.mock("@tanstack/react-router", async (importOriginal) => {
  const staticRouter = {
    state: { location: { state: {} } },
    history: { back: vi.fn() },
    subscribe: () => () => undefined,
  };
  return {
    ...(await importOriginal<typeof import("@tanstack/react-router")>()),
    Link: ({ children, className, to }: LinkProps) => (
      <a className={className} href={to}>
        {children}
      </a>
    ),
    useNavigate: () => navigate,
    useParams: () => ({ id: "c-moto" }),
    // The contract's entry, as the router keeps it (no panel pushed by the list).
    useRouter: () => staticRouter,
    useSearch: () => route.search,
  };
});

const ACTION_NAMES = [
  /Cobrar/,
  /Marcar como/,
  /Pagar/,
  /Abrir a mais antiga/,
  /Lembrar/,
  /^Conferir comprovante$/,
];
const RECEIVED = /recebida/;
const ROW_30_JUN = /^Parcela 1 30 de junho/;
const ROW_3 = /^Parcela 3 30 de agosto Atrasada · 36 dias R\$/;

/**
 * The page without the installment panel: it has its own test
 * (installment-panel.test.tsx), and here its sheet would hide the list from
 * the queries whenever the URL holds an installment.
 */
const SLOTS = { ...CONTRACT_SLOTS, panel: () => null };

function renderList(detail: ContractDetail = motoDetail()) {
  const client = makeTestQueryClient();
  client.setQueryDefaults(queryKeys.contract("c-moto"), {
    gcTime: Number.POSITIVE_INFINITY,
  });
  client.setQueryData(queryKeys.contract("c-moto"), detail);
  const { rerender } = renderWithProviders(<ContractPage slots={SLOTS} />, {
    client,
  });
  return {
    list: screen.getByTestId("installment-list"),
    /** The URL moves to another installment (the panel's arrows, the browser's back). */
    goTo: (installment: string | null) => {
      route.search = installment ? { installment } : {};
      rerender(<ContractPage slots={SLOTS} />);
    },
  };
}

function settledMoto(): ContractDetail {
  const detail = motoDetail();
  return {
    ...detail,
    installments: detail.installments.map((it) => ({
      ...it,
      status: "confirmed",
      paidAt: `${it.dueDate}T15:00:00.000Z`,
    })),
  };
}

const row = (list: HTMLElement, id: string) =>
  list.querySelector(`[data-installment-row="${id}"]`) as HTMLElement;

beforeEach(() => {
  vi.useFakeTimers({ now: new Date("2026-10-05T15:00:00Z"), toFake: ["Date"] });
  navigate.mockReset();
  route.search = {};
});

afterEach(() => {
  vi.useRealTimers();
});

describe("InstallmentList (mockup 14, enxuto)", () => {
  it("nenhuma linha tem botão além da própria linha", () => {
    const { list } = renderList();
    expect(list).toHaveAccessibleName("Parcelas do contrato");
    const buttons = within(list).getAllByRole("button");
    // One line per installment, 1 to 10: no group, no accordion.
    expect(buttons).toHaveLength(10);
    for (const button of buttons) {
      expect(button).toHaveAttribute("type", "button");
      // Each is a whole line, an installment, and none opens in place.
      expect(button).toHaveAttribute("data-installment-row");
      expect(button).not.toHaveAttribute("aria-expanded");
      expect(button.querySelector("button, a")).toBeNull();
    }
    expect(within(list).queryByRole("link")).toBeNull();
    for (const name of ACTION_NAMES) {
      expect(within(list).queryByRole("button", { name })).toBeNull();
    }
    expect(buttons[0]).toHaveAccessibleName(ROW_30_JUN);
    // The tile's "03" is drawn, not said: the name says "Parcela 3" (review I5).
    expect(row(list, "i3")).toHaveAccessibleName(ROW_3);
    expect(row(list, "i3")).toHaveTextContent(
      "30 de agosto Atrasada · 36 dias"
    );
    expect(row(list, "i4")).toHaveTextContent(
      "30 de setembro Conferir comprovante"
    );
    // An open installment has no tag, only how near it is.
    expect(row(list, "i5")).toHaveTextContent("30 de outubro em 25 dias");
    expect(row(list, "i8")).toHaveTextContent("30 de janeiro de 2027");
    expect(within(row(list, "i8")).queryByText("em 117 dias")).toBeNull();
  });

  it("a linha 4 selecionada tem row-selected e o tile tingido; as outras não", () => {
    route.search = { installment: "i4" };
    const { list } = renderList();
    const selected = row(list, "i4");
    expect(selected).toHaveAttribute("aria-current", "true");
    expect(selected).toHaveClass("bg-row-selected");
    // The proof's tile keeps its tint: only a paid or open tile steps to inset.
    expect(selected.querySelector(".font-mono")).toHaveClass(
      "bg-warning-subtle"
    );
    for (const id of ["i3", "i5", "i10"]) {
      expect(row(list, id)).not.toHaveAttribute("aria-current");
      expect(row(list, id)).not.toHaveClass("bg-row-selected");
    }
  });

  it("a paga selecionada: o tile inset sobre o row-selected (a vizinha segue brand-subtle)", () => {
    route.search = { installment: "i1" };
    const { list } = renderList();
    expect(row(list, "i1")).toHaveClass("bg-row-selected");
    expect(row(list, "i1").querySelector(".font-mono")).toHaveClass(
      "bg-surface-inset"
    );
    expect(row(list, "i2").querySelector(".font-mono")).toHaveClass(
      "bg-brand-subtle"
    );
  });

  it("clicar numa linha abre a parcela (openInstallment com o id) numa entrada própria do histórico, marcada como do painel", async () => {
    const user = userEvent.setup();
    const { list } = renderList();
    await user.click(row(list, "i5"));
    expect(navigate).toHaveBeenCalledTimes(1);
    const call = navigate.mock.calls[0]?.[0];
    expect(call.replace).toBeFalsy();
    expect(call.state).toEqual({ panel: true });
    expect(call.search({ tab: undefined })).toEqual({
      tab: undefined,
      installment: "i5",
    });
  });

  it("sem accordion: as pagas, as atrasadas e as abertas, uma linha cada, em ordem", () => {
    const { list } = renderList();
    const lines = within(list).getAllByRole("listitem");
    expect(lines).toHaveLength(10);
    expect(
      lines.map((line) =>
        line
          .querySelector("[data-installment-row]")
          ?.getAttribute("data-installment-row")
      )
    ).toEqual(["i1", "i2", "i3", "i4", "i5", "i6", "i7", "i8", "i9", "i10"]);
    expect(list.querySelector("[aria-expanded]")).toBeNull();
    expect(within(list).queryByText("Confirmadas")).toBeNull();
  });

  it("uma parcela paga que está na URL está lá, selecionada, sem abrir nada", () => {
    route.search = { installment: "i2" };
    const { list } = renderList();
    expect(row(list, "i2")).toHaveAttribute("aria-current", "true");
  });

  it("quitado: as 10 linhas, sem tag, com 'recebida' no nome acessível", () => {
    const { list } = renderList(settledMoto());
    const buttons = within(list).getAllByRole("button");
    expect(buttons).toHaveLength(10);
    for (const button of buttons) {
      expect(button).toHaveAccessibleName(RECEIVED);
      expect(button.querySelector(".rounded-full")).toBeNull();
    }
    expect(within(list).queryByText("Confirmada")).toBeNull();
  });

  it("o valor da paga em ink-muted, o da aberta em ink", () => {
    const { list } = renderList();
    const paid = within(row(list, "i1")).getByText("R$ 480,00");
    expect(paid.parentElement).toHaveClass("text-ink-muted");
    const open = within(row(list, "i5")).getByText("R$ 480,00");
    expect(open.parentElement).not.toHaveClass("text-ink-muted");
  });
});
