import { QueryClient } from "@tanstack/react-query";
import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { NotificationsPanel } from "@/features/notifications/components/notifications-panel";
import type { NotificationItem } from "@/features/notifications/types";
import { queryKeys } from "@/lib/query-keys";
import { homeFixture } from "./home-fixtures";
import { renderWithProviders } from "./test-utils";

// Top-level regex literals (lint/performance/useTopLevelRegex), without backslashes.
const CONFIRMED_ROW = /Pagamento confirmado/;
const INVITE_ACCEPTED_ROW = /Convite aceito/;

const { getList, postRead, postReadAll, navigate } = vi.hoisted(() => ({
  getList: vi.fn(),
  postRead: vi.fn(),
  postReadAll: vi.fn(),
  navigate: vi.fn(),
}));

vi.mock("@/lib/api", () => {
  const notifications = Object.assign(
    (_params: { id: string }) => ({ read: { post: () => postRead() } }),
    {
      get: () => getList(),
      "read-all": { post: () => postReadAll() },
    }
  );
  return { api: { api: { notifications } } };
});

vi.mock("@tanstack/react-router", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@tanstack/react-router")>()),
  useNavigate: () => navigate,
}));

const unreadNote: NotificationItem = {
  id: "n1",
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

const readNote: NotificationItem = {
  ...unreadNote,
  id: "n2",
  type: "invite_accepted",
  installmentId: null,
  installmentSequence: null,
  metadata: { email: "ana@example.com" },
  readAt: new Date().toISOString(),
};

function renderPanel(unreadCount = 1) {
  const onOpenChange = vi.fn();
  const client = new QueryClient({
    defaultOptions: {
      queries: { retry: false, gcTime: Number.POSITIVE_INFINITY },
      mutations: { retry: false },
    },
  });
  client.setQueryData(queryKeys.home, homeFixture({ unreadCount }));
  renderWithProviders(
    <NotificationsPanel
      onOpenChange={onOpenChange}
      open
      unreadCount={unreadCount}
    />,
    { client }
  );
  return { onOpenChange };
}

beforeEach(() => {
  getList.mockReset();
  postRead.mockReset();
  postReadAll.mockReset();
  navigate.mockReset();
});

describe("NotificationsPanel", () => {
  it("diz quantas não lidas, e só as não lidas têm a tag Nova", async () => {
    getList.mockResolvedValue({ data: [unreadNote, readNote], error: null });
    renderPanel();
    const panel = screen.getByRole("dialog", { name: "Notificações" });
    expect(panel).toHaveAccessibleDescription("1 não lida");
    expect(
      await screen.findByRole("button", { name: CONFIRMED_ROW })
    ).toBeVisible();
    expect(
      screen.getByRole("button", { name: INVITE_ACCEPTED_ROW })
    ).toBeVisible();
    expect(screen.getAllByText("Nova")).toHaveLength(1);
  });

  it("abrir um aviso marca como lido, fecha o painel e vai para a parcela", async () => {
    getList.mockResolvedValue({ data: [unreadNote], error: null });
    postRead.mockResolvedValue({ data: { ok: true }, error: null });
    const { onOpenChange } = renderPanel();
    await userEvent.click(
      await screen.findByRole("button", { name: CONFIRMED_ROW })
    );
    expect(postRead).toHaveBeenCalledTimes(1);
    expect(onOpenChange).toHaveBeenCalledWith(false);
    expect(navigate).toHaveBeenCalledWith({
      to: "/contracts/$id",
      params: { id: "c1" },
      search: { installment: "i1" },
    });
  });

  it("Marcar todas como lidas some quando não há mais não lidas", async () => {
    getList.mockResolvedValue({ data: [unreadNote], error: null });
    postReadAll.mockResolvedValue({ data: { ok: true }, error: null });
    renderPanel();
    await userEvent.click(
      await screen.findByRole("button", { name: "Marcar todas como lidas" })
    );
    await waitFor(() =>
      expect(
        screen.queryByRole("button", { name: "Marcar todas como lidas" })
      ).toBeNull()
    );
    expect(screen.queryAllByText("Nova")).toHaveLength(0);
  });

  it("vazio: a versão compacta", async () => {
    getList.mockResolvedValue({ data: [], error: null });
    renderPanel(0);
    expect(
      await screen.findByRole("heading", { name: "Nada novo por aqui" })
    ).toBeVisible();
  });
});
