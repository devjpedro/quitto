import { QueryClient, skipToken, useQuery } from "@tanstack/react-query";
import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Home } from "@/features/home/types";
import { NotificationsPanel } from "@/features/notifications/components/notifications-panel";
import type { NotificationItem } from "@/features/notifications/types";
import { queryKeys } from "@/lib/query-keys";
import { homeFixture } from "./home-fixtures";
import { notificationItem } from "./notification-fixtures";
import { renderWithProviders } from "./test-utils";

// Top-level regex literals (lint/performance/useTopLevelRegex), without backslashes.
const CONFIRMED_ROW = /Pagamento confirmado/;
const INVITE_ACCEPTED_ROW = /Convite aceito/;
const OVERDUE_GROUP_ROW = /24 parcelas a receber estão vencidas/;
const OVERDUE_GROUP_META = /Venda do terreno · parcelas 5 a 28 de 60/;

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
      read: { post: () => postRead() },
      "read-all": { post: () => postReadAll() },
    }
  );
  return { api: { api: { notifications } } };
});

vi.mock("@tanstack/react-router", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@tanstack/react-router")>()),
  useNavigate: () => navigate,
}));

const unreadNote: NotificationItem = notificationItem({
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
});

// Built on its own (not spread from unreadNote), so its ids, groupKey and
// unreadCount follow its own id and readAt.
const readNote: NotificationItem = notificationItem({
  id: "n2",
  type: "invite_accepted",
  contractId: "c1",
  installmentId: null,
  metadata: { email: "ana@example.com" },
  readAt: new Date().toISOString(),
  createdAt: unreadNote.createdAt,
  contractTitle: "Aluguel do apê",
  installmentSequence: null,
  installmentsCount: 12,
});

/** The owner's case: 24 overdue installments of one contract, one line. */
const overdueGroup: NotificationItem = notificationItem({
  id: "g1",
  type: "installment_overdue_receivable",
  contractId: "c9",
  contractTitle: "Venda do terreno",
  installmentsCount: 60,
  ids: Array.from({ length: 24 }, (_, i) => `g${i + 1}`),
  count: 24,
  sequences: Array.from({ length: 24 }, (_, i) => i + 5),
  unreadCount: 24,
  createdAt: unreadNote.createdAt,
});

/** As the shell does (Task 13): a button opens the panel, and the count is the cached home's. */
function Harness({
  initiallyOpen,
  onOpenChange,
}: {
  initiallyOpen: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const [open, setOpen] = useState(initiallyOpen);
  const { data: unreadCount = 0 } = useQuery({
    queryKey: queryKeys.home,
    queryFn: skipToken,
    select: (home: Home) => home.unreadCount,
  });
  return (
    <>
      <button onClick={() => setOpen(true)} type="button">
        Abrir notificações
      </button>
      <NotificationsPanel
        onOpenChange={(next) => {
          onOpenChange(next);
          setOpen(next);
        }}
        open={open}
        unreadCount={unreadCount}
      />
    </>
  );
}

function renderPanel(unreadCount = 1, { open = true } = {}) {
  const onOpenChange = vi.fn();
  const client = new QueryClient({
    defaultOptions: {
      queries: { retry: false, gcTime: Number.POSITIVE_INFINITY },
      mutations: { retry: false },
    },
  });
  client.setQueryData(queryKeys.home, homeFixture({ unreadCount }));
  renderWithProviders(
    <Harness initiallyOpen={open} onOpenChange={onOpenChange} />,
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

  it("com mais de uma, o plural", async () => {
    getList.mockResolvedValue({ data: [], error: null });
    renderPanel(2);
    expect(
      screen.getByRole("dialog", { name: "Notificações" })
    ).toHaveAccessibleDescription("2 não lidas");
    // The list suspends until its fetch resolves: let it land inside the test.
    expect(await screen.findByText("Nada novo por aqui")).toBeVisible();
  });

  it("não lida tem o título em semibold; lida, em peso normal", async () => {
    getList.mockResolvedValue({ data: [unreadNote, readNote], error: null });
    renderPanel();
    expect(await screen.findByText("Pagamento confirmado")).toHaveClass(
      "font-semibold"
    );
    expect(screen.getByText("Convite aceito")).toHaveClass("font-normal");
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

  it("abrir um aviso já lido não chama a API, mas vai até ele", async () => {
    getList.mockResolvedValue({ data: [readNote], error: null });
    renderPanel(0);
    await userEvent.click(
      await screen.findByRole("button", { name: INVITE_ACCEPTED_ROW })
    );
    expect(postRead).not.toHaveBeenCalled();
    expect(navigate).toHaveBeenCalledWith({
      to: "/contracts/$id",
      params: { id: "c1" },
      search: { installment: undefined },
    });
  });

  it("Esc fecha o painel e devolve o foco a quem o abriu", async () => {
    getList.mockResolvedValue({ data: [unreadNote], error: null });
    renderPanel(1, { open: false });
    const opener = screen.getByRole("button", { name: "Abrir notificações" });
    await userEvent.click(opener);
    await screen.findByRole("button", { name: CONFIRMED_ROW });
    await userEvent.keyboard("{Escape}");
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
    expect(opener).toHaveFocus();
  });

  it("Marcar todas aparece quando o sino conta não lidas fora das 50 carregadas", async () => {
    getList.mockResolvedValue({ data: [readNote], error: null });
    postReadAll.mockResolvedValue({ data: { ok: true }, error: null });
    renderPanel(3);
    await userEvent.click(
      await screen.findByRole("button", { name: "Marcar todas como lidas" })
    );
    expect(postReadAll).toHaveBeenCalledTimes(1);
    await waitFor(() =>
      expect(
        screen.queryByRole("button", { name: "Marcar todas como lidas" })
      ).toBeNull()
    );
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

  it("vazio: a versão compacta, com o sino no quadrado das linhas e sem ação", async () => {
    getList.mockResolvedValue({ data: [], error: null });
    renderPanel(0);
    const heading = await screen.findByRole("heading", {
      name: "Nada novo por aqui",
    });
    expect(heading).toBeVisible();
    // Mockup 10: the bell sits in the same 32 px brand tile as the rows' icons.
    expect(
      heading.parentElement?.querySelector("[aria-hidden='true']")
    ).toHaveClass("size-8", "rounded-control", "bg-brand-subtle", "text-brand");
    expect(
      screen.queryByRole("button", { name: "Marcar todas como lidas" })
    ).toBeNull();
    expect(
      screen.getByRole("dialog", { name: "Notificações" })
    ).not.toHaveAccessibleDescription();
  });

  it("abrir um grupo lê os avisos dele e abre o contrato filtrado no que ele conta", async () => {
    getList.mockResolvedValue({ data: [overdueGroup], error: null });
    postRead.mockResolvedValue({ data: { ok: true, count: 24 }, error: null });
    const { onOpenChange } = renderPanel(24);
    await userEvent.click(
      await screen.findByRole("button", { name: OVERDUE_GROUP_ROW })
    );
    expect(postRead).toHaveBeenCalledTimes(1);
    expect(onOpenChange).toHaveBeenCalledWith(false);
    expect(navigate).toHaveBeenCalledWith({
      to: "/contracts/$id",
      params: { id: "c9" },
      search: { status: "overdue" },
    });
  });

  it("o título e o metadado quebram linha, nunca cortam: o caso do dono cabe inteiro no celular (mockup 10)", async () => {
    getList.mockResolvedValue({ data: [overdueGroup], error: null });
    renderPanel(24);
    const title = await screen.findByText(OVERDUE_GROUP_ROW);
    const meta = screen.getByText(OVERDUE_GROUP_META);
    for (const line of [title, meta]) {
      expect(line).toHaveClass("text-pretty");
      expect(line).not.toHaveClass("truncate");
    }
  });

  it("o anel e o hover da primeira e da última linha seguem o canto do bloco", async () => {
    getList.mockResolvedValue({ data: [unreadNote, readNote], error: null });
    renderPanel();
    await screen.findByRole("button", { name: CONFIRMED_ROW });
    // The block clips its corners (overflow-hidden): a square row there
    // would cut the inset focus ring along the curve.
    for (const item of screen.getAllByRole("listitem")) {
      expect(item).toHaveClass("first:rounded-t-card", "last:rounded-b-card");
      expect(within(item).getByRole("button")).toHaveClass("rounded-[inherit]");
    }
  });
});
