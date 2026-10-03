import { QueryClient } from "@tanstack/react-query";
import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { RecentNotifications } from "@/features/notifications/components/recent-notifications";
import { NotificationsPanelContext } from "@/features/notifications/hooks/use-notifications-panel";
import type { NotificationItem } from "@/features/notifications/types";
import { renderWithProviders } from "./test-utils";

// Top-level regex literals (lint/performance/useTopLevelRegex), without backslashes.
const CONFIRMED_ROW = /Pagamento confirmado/;

const { getList, postRead, navigate } = vi.hoisted(() => ({
  getList: vi.fn(),
  postRead: vi.fn(),
  navigate: vi.fn(),
}));

vi.mock("@/lib/api", () => {
  const notifications = Object.assign(
    (_params: { id: string }) => ({ read: { post: () => postRead() } }),
    {
      get: () => getList(),
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
}));

function note(id: string): NotificationItem {
  return {
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
  };
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
      queries: { retry: false, gcTime: Number.POSITIVE_INFINITY },
      mutations: { retry: false },
    },
  });
  renderWithProviders(
    <NotificationsPanelContext value={showAll}>
      <RecentNotifications />
    </NotificationsPanelContext>,
    { client }
  );
  return { showAll };
}

const region = () =>
  screen.getByRole("region", { name: "Notificações recentes" });

beforeEach(() => {
  getList.mockReset();
  postRead.mockReset();
  navigate.mockReset();
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
    expect(region()).toHaveClass("hidden", "lateral:flex");
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

  it("sem aviso: o vazio compacto do painel", async () => {
    getList.mockResolvedValue({ data: [], error: null });
    renderRecent();
    expect(
      await within(region()).findByRole("heading", {
        name: "Nada novo por aqui",
      })
    ).toBeVisible();
  });

  it("abaixo de 1440 px (celular incluído) não busca nada", async () => {
    setScreenWidth(1439);
    renderRecent();
    // The block is in the HTML (hidden by CSS), with the panel's skeleton.
    expect(region()).toHaveClass("hidden");
    await new Promise((resolve) => setTimeout(resolve, 20));
    expect(getList).not.toHaveBeenCalled();
  });

  it("se a lista falha, o bloco some e a home continua", async () => {
    getList.mockResolvedValue(FAILED);
    renderRecent();
    await waitFor(() =>
      expect(
        screen.queryByRole("region", { name: "Notificações recentes" })
      ).toBeNull()
    );
  });
});
