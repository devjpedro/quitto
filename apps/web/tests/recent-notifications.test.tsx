import { QueryClient } from "@tanstack/react-query";
import { act, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ErrorBoundary } from "react-error-boundary";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { NotificationsSkeleton } from "@/features/notifications/components/notifications-list";
import { RecentNotifications } from "@/features/notifications/components/recent-notifications";
import { NotificationsPanelContext } from "@/features/notifications/hooks/use-notifications-panel";
import type { NotificationItem } from "@/features/notifications/types";
import { queryKeys } from "@/lib/query-keys";
import { notificationItem } from "./notification-fixtures";
import { renderWithProviders } from "./test-utils";

// Top-level regex literals (lint/performance/useTopLevelRegex), without backslashes.
const CONFIRMED_ROW = /Pagamento confirmado/;
const OVERDUE_GROUP_ROW = /24 parcelas a receber estão vencidas/;

const { getList, postRead, navigate, hydration } = vi.hoisted(() => ({
  getList: vi.fn(),
  postRead: vi.fn(),
  navigate: vi.fn(),
  // jsdom renders already hydrated; false stands in for the SSR and hydration pass.
  hydration: { done: true },
}));

vi.mock("@/lib/api", () => {
  const notifications = Object.assign(
    (_params: { id: string }) => ({ read: { post: () => postRead() } }),
    {
      get: () => getList(),
      read: { post: () => postRead() },
      "read-all": {
        post: () => Promise.resolve({ data: { ok: true }, error: null }),
      },
    }
  );
  return { api: { api: { notifications } } };
});

vi.mock("@tanstack/react-router", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@tanstack/react-router")>()),
  useNavigate: () => navigate,
  useHydrated: () => hydration.done,
}));

function note(id: string): NotificationItem {
  return notificationItem({
    id,
    type: "payment_confirmed",
    contractId: "c1",
    installmentId: "i1",
    metadata: null,
    readAt: null,
    createdAt: new Date(Date.now() - 2 * 3_600_000).toISOString(),
    contractTitle: "Aluguel do apê",
    installmentSequence: 7,
    installmentsCount: 12,
  });
}

const FAILED = {
  data: null,
  error: { status: 500, value: { error: { code: "INTERNAL", message: "x" } } },
};

/** The test setup's matchMedia answers min-width queries against innerWidth. */
function setScreenWidth(width: number) {
  Object.defineProperty(window, "innerWidth", {
    configurable: true,
    value: width,
  });
}

const startWidth = window.innerWidth;

function renderRecent() {
  const showAll = vi.fn();
  const client = new QueryClient({
    defaultOptions: {
      // throwOnError as in the app (src/lib/query.ts), which sends every
      // non-401 error to the boundary: the block must opt out on its own.
      queries: {
        retry: false,
        gcTime: Number.POSITIVE_INFINITY,
        throwOnError: true,
      },
      mutations: { retry: false },
    },
  });
  // As on the home: the block sits next to the rest, inside the home's boundary.
  renderWithProviders(
    <NotificationsPanelContext value={showAll}>
      <ErrorBoundary fallback={<p>home boundary</p>}>
        <p>rest of the home</p>
        <RecentNotifications />
      </ErrorBoundary>
    </NotificationsPanelContext>,
    { client }
  );
  return { client, showAll };
}

const region = () =>
  screen.getByRole("region", { name: "Notificações recentes" });

beforeEach(() => {
  getList.mockReset();
  postRead.mockReset();
  navigate.mockReset();
  hydration.done = true;
  setScreenWidth(1440);
});

afterEach(() => {
  setScreenWidth(startWidth);
});

describe("RecentNotifications", () => {
  it("a partir de 1440 px: as 4 últimas, com as linhas do painel, e Ver todas abre o painel do sino", async () => {
    getList.mockResolvedValue({
      data: ["n1", "n2", "n3", "n4", "n5"].map(note),
      error: null,
    });
    const { showAll } = renderRecent();
    // Hidden below lateral by CSS: the same HTML at any width.
    expect(region()).toHaveClass("hidden", "lateral:block");
    await waitFor(() =>
      expect(
        within(region()).getAllByRole("button", { name: CONFIRMED_ROW })
      ).toHaveLength(4)
    );
    expect(within(region()).getAllByText("Nova")).toHaveLength(4);
    const seeAll = within(region()).getByRole("button", { name: "Ver todas" });
    expect(seeAll).toHaveAttribute("aria-haspopup", "dialog");
    await userEvent.click(seeAll);
    expect(showAll).toHaveBeenCalledTimes(1);
  });

  it("abrir um aviso marca como lido e vai para a parcela, como no painel", async () => {
    getList.mockResolvedValue({ data: [note("n1")], error: null });
    postRead.mockResolvedValue({ data: { ok: true }, error: null });
    renderRecent();
    await userEvent.click(
      await within(region()).findByRole("button", { name: CONFIRMED_ROW })
    );
    expect(postRead).toHaveBeenCalledTimes(1);
    expect(navigate).toHaveBeenCalledWith({
      to: "/contracts/$id",
      params: { id: "c1" },
      search: { installment: "i1" },
    });
  });

  it("sem aviso: o vazio compacto do painel, com o sino no quadrado das linhas", async () => {
    getList.mockResolvedValue({ data: [], error: null });
    renderRecent();
    const heading = await within(region()).findByRole("heading", {
      name: "Nada novo por aqui",
    });
    expect(heading).toBeVisible();
    // The same empty as the panel (mockup 10): the bell in the 32 px brand tile.
    expect(
      heading.parentElement?.querySelector("[aria-hidden='true']")
    ).toHaveClass("size-8", "rounded-control", "bg-brand-subtle", "text-brand");
  });

  it("carregando: o esqueleto tem as 4 linhas do bloco, no mesmo fundo", () => {
    getList.mockReturnValue(new Promise(() => undefined));
    renderRecent();
    const skeleton = region().querySelector("ul[aria-hidden='true']");
    expect(skeleton).toHaveClass("bg-surface-card");
    expect(skeleton?.children).toHaveLength(4);
  });

  it("abaixo de 1440 px (celular incluído) não busca nada", () => {
    setScreenWidth(1439);
    renderRecent();
    // The block is in the HTML (hidden by CSS), with the panel's skeleton.
    // An enabled query would have fetched within the render's act already.
    expect(region()).toHaveClass("hidden");
    expect(region().querySelector("ul[aria-hidden='true']")).not.toBeNull();
    expect(getList).not.toHaveBeenCalled();
  });

  it("antes da hidratação não busca nada, nem em tela larga: o esqueleto, como no HTML do servidor", () => {
    hydration.done = false;
    renderRecent();
    expect(region().querySelector("ul[aria-hidden='true']")).not.toBeNull();
    expect(getList).not.toHaveBeenCalled();
  });

  it("se a lista falha, o bloco some sem jogar o erro para a fronteira da home", async () => {
    getList.mockResolvedValue(FAILED);
    renderRecent();
    await waitFor(() =>
      expect(
        screen.queryByRole("region", { name: "Notificações recentes" })
      ).toBeNull()
    );
    expect(screen.getByText("rest of the home")).toBeVisible();
    expect(screen.queryByText("home boundary")).toBeNull();
  });

  it("uma revalidação que falha mantém as linhas em cache, como o painel", async () => {
    getList.mockResolvedValue({ data: [note("n1")], error: null });
    const { client } = renderRecent();
    await within(region()).findByRole("button", { name: CONFIRMED_ROW });
    // The panel refetches on open (staleTime 0); a failed read invalidates the list.
    getList.mockResolvedValue(FAILED);
    await act(async () => {
      await client.refetchQueries({ queryKey: queryKeys.notifications });
      // React Query tells the observers on the next macrotask (notifyManager's
      // setTimeout 0): let the block render the failed state before asserting.
      await new Promise((resolve) => setTimeout(resolve, 0));
    });
    expect(client.getQueryState(queryKeys.notifications)?.status).toBe("error");
    expect(
      within(region()).getByRole("button", { name: CONFIRMED_ROW })
    ).toBeVisible();
  });

  it("linha agrupada: o tile de ícone com a contagem, 'Nova' e o chevron; o bloco é preenchido", async () => {
    getList.mockResolvedValue({
      data: [
        notificationItem({
          id: "g1",
          type: "installment_overdue_receivable",
          contractTitle: "Venda do terreno",
          installmentsCount: 60,
          ids: Array.from({ length: 24 }, (_, i) => `g${i + 1}`),
          count: 24,
          sequences: Array.from({ length: 24 }, (_, i) => i + 5),
          unreadCount: 24,
          createdAt: new Date(Date.now() - 2 * 3_600_000).toISOString(),
        }),
      ],
      error: null,
    });
    renderRecent();
    const row = await within(region()).findByRole("button", {
      name: OVERDUE_GROUP_ROW,
    });
    // The tile's badge, not the "24" in the title.
    expect(within(row).getByText("24", { exact: true })).toHaveClass("bg-ink");
    expect(row).toHaveTextContent("Nova");
    expect(row.querySelectorAll("svg").length).toBeGreaterThanOrEqual(2);
    // On hover the badge's ring takes the line's fill, never a halo of the resting one.
    expect(row).toHaveClass("hover:**:ring-surface-card-hover");
    expect(row.closest("ul")).toHaveClass("bg-surface-card", "divide-divider");
    expect(row.closest("ul")).not.toHaveClass("border");
    // The block clips its corners: the row inherits them, so the inset focus
    // ring follows the curve.
    expect(row.closest("li")).toHaveClass(
      "first:rounded-t-card",
      "last:rounded-b-card"
    );
    expect(row).toHaveClass("rounded-[inherit]");
  });

  it("o esqueleto: o bloco preenchido e os ossos em inset, que não somem sobre ele", () => {
    const { container } = render(<NotificationsSkeleton />);
    expect(container.querySelector("ul")).toHaveClass("bg-surface-card");
    const bones = container.querySelectorAll(".animate-pulse");
    expect(bones.length).toBeGreaterThan(0);
    for (const bone of bones) {
      expect(bone).toHaveClass("bg-surface-inset");
    }
  });
});
