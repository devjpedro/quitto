import { QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { HistoryTab } from "@/features/contracts/components/history-tab";
import { RecentActivity } from "@/features/contracts/components/recent-activity";
import type { ContractRoute } from "@/features/contracts/hooks/use-contract-route";
import type { ContractEvent } from "@/features/contracts/types";
import { makeQueryClient } from "@/lib/query";
import { motoDetail } from "./contract-fixtures";

const { eventsGet } = vi.hoisted(() => ({ eventsGet: vi.fn() }));

vi.mock("@/lib/api", () => ({
  api: {
    api: {
      contracts: () => ({
        events: { get: (args: unknown) => eventsGet(args) },
      }),
    },
  },
}));

const ev = (over: Partial<ContractEvent>): ContractEvent => ({
  id: over.id ?? "e",
  type: "proof_submitted",
  installmentId: "i4",
  installmentSequence: 4,
  actorName: "Rafael Prado",
  isMe: false,
  metadata: null,
  createdAt: "2026-10-04T13:00:00.000Z",
  ...over,
});

const FIRST_PAGE = [
  ev({
    id: "e1",
    metadata: { fileName: "pix-moto-outubro.pdf", sizeBytes: 188_416 },
  }),
  ev({
    id: "e2",
    type: "payment_confirmed",
    installmentId: "i3",
    installmentSequence: 3,
    actorName: "João Souza",
    isMe: true,
    createdAt: "2026-09-30T15:00:00.000Z",
  }),
];
const SECOND_PAGE = [
  ev({
    id: "e3",
    type: "contract_created",
    installmentId: null,
    installmentSequence: null,
    actorName: "João Souza",
    isMe: true,
    createdAt: "2026-06-28T19:40:00.000Z",
  }),
];

const route = {
  id: "c-moto",
  installmentId: null,
  tab: "history",
  today: "2026-10-05",
  setTab: vi.fn(),
} as unknown as ContractRoute;

const ok = (data: unknown) => Promise.resolve({ data, error: null });

function renderWith(ui: React.ReactNode) {
  const client = makeQueryClient();
  return render(
    <QueryClientProvider client={client}>{ui}</QueryClientProvider>
  );
}

beforeEach(() => {
  eventsGet.mockReset();
  vi.useFakeTimers({ now: new Date("2026-10-05T15:00:00Z"), toFake: ["Date"] });
});

afterEach(() => {
  vi.useRealTimers();
});

describe("HistoryTab (mockup 14, Histórico)", () => {
  it("os dias com o rótulo, um bloco por dia e a hora à direita", async () => {
    eventsGet.mockImplementation(() =>
      ok({ items: FIRST_PAGE, nextBefore: null })
    );
    renderWith(<HistoryTab route={route} />);
    const history = await screen.findByTestId("history");
    expect(
      within(history).getByText("Ontem · domingo, 4 de outubro")
    ).toBeVisible();
    expect(
      within(history).getByText("Quarta-feira, 30 de setembro")
    ).toBeVisible();
    expect(within(history).getAllByRole("list")).toHaveLength(2);
    expect(within(history).getByText("Rafael Prado")).toBeVisible();
    expect(
      within(history).getByText("pix-moto-outubro.pdf · 184 KB")
    ).toBeVisible();
    expect(within(history).getByText("10:00")).toBeVisible();
    // The tile is tinted by the kind of event: a proof is warning, a confirmation brand.
    const tiles = history.querySelectorAll("[aria-hidden='true'].size-10");
    expect(tiles[0]).toHaveClass("bg-warning-subtle", "text-warning");
    expect(tiles[1]).toHaveClass("bg-brand-subtle", "text-brand");
    expect(
      within(history).getByText("Você confirmou o pagamento da parcela 3")
    ).toBeVisible();
    expect(screen.queryByRole("button", { name: "Ver mais" })).toBeNull();
  });

  it("com mais páginas, 'Ver mais' busca com before= o cursor", async () => {
    eventsGet.mockImplementation((args: { query: { before?: string } }) =>
      args.query.before
        ? ok({ items: SECOND_PAGE, nextBefore: null })
        : ok({ items: FIRST_PAGE, nextBefore: "cursor-1" })
    );
    renderWith(<HistoryTab route={route} />);
    await userEvent.click(
      await screen.findByRole("button", { name: "Ver mais" })
    );
    await waitFor(() =>
      expect(eventsGet).toHaveBeenLastCalledWith({
        query: { before: "cursor-1" },
      })
    );
    expect(await screen.findByText("Você criou o contrato")).toBeVisible();
    expect(screen.queryByRole("button", { name: "Ver mais" })).toBeNull();
  });

  it("uma página nula (contrato apagado) não desenha nada e não quebra", async () => {
    eventsGet.mockImplementation(() => ok(null));
    renderWith(<HistoryTab route={route} />);
    expect(await screen.findByTestId("history")).toBeEmptyDOMElement();
  });
});

describe("RecentActivity", () => {
  it("mostra 3 linhas, com o 'quando', e 'Ver histórico' troca para a aba Histórico", async () => {
    const setTab = vi.fn();
    const recent = [
      ...FIRST_PAGE,
      ev({
        id: "e4",
        type: "installment_received",
        installmentSequence: 2,
        actorName: "João Souza",
        isMe: true,
        createdAt: "2026-07-31T12:12:00.000Z",
      }),
      ...SECOND_PAGE,
    ];
    renderWith(
      <RecentActivity
        detail={motoDetail({ recentEvents: recent })}
        route={
          { ...route, tab: "installments", setTab } as unknown as ContractRoute
        }
      />
    );
    const block = screen.getByTestId("recent-activity");
    expect(within(block).getAllByRole("listitem")).toHaveLength(3);
    expect(within(block).getByText("ontem")).toBeVisible();
    expect(within(block).getByText("30/09")).toBeVisible();
    await userEvent.click(
      within(block).getByRole("button", { name: "Ver histórico" })
    );
    expect(setTab).toHaveBeenCalledWith("history");
  });

  it("dois recibos seguidos entram agrupados: 3 linhas, uma delas com '2 recibos'", () => {
    const shared = (id: string, sequence: number) =>
      ev({
        id,
        type: "receipt_share_created",
        installmentSequence: sequence,
        actorName: "João Souza",
        isMe: true,
        createdAt: "2026-09-15T12:00:00.000Z",
      });
    renderWith(
      <RecentActivity
        detail={motoDetail({
          recentEvents: [
            FIRST_PAGE[0] as ContractEvent,
            shared("s2", 2),
            shared("s1", 1),
            SECOND_PAGE[0] as ContractEvent,
          ],
        })}
        route={route}
      />
    );
    const items = within(screen.getByTestId("recent-activity")).getAllByRole(
      "listitem"
    );
    expect(items).toHaveLength(3);
    expect(items[1]).toHaveTextContent("2 recibos");
  });

  it("sem eventos, não aparece", () => {
    renderWith(<RecentActivity detail={motoDetail()} route={route} />);
    expect(screen.queryByTestId("recent-activity")).toBeNull();
  });
});
