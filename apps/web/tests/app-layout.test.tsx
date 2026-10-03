import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { useShowNotifications } from "@/features/notifications/hooks/use-notifications-panel";
import { clearIdentityCookie } from "@/hooks/use-identity-cookie";
import {
  parseIdentityCookie,
  serializeIdentityCookie,
} from "@/lib/identity-cookie";
import { queryKeys } from "@/lib/query-keys";
import { homeFixture, installmentAction } from "./home-fixtures";
import { makeTestQueryClient, renderWithProviders } from "./test-utils";

const { navigate, meGet, homeGet, outlet } = vi.hoisted(() => ({
  navigate: vi.fn(),
  meGet: vi.fn(),
  homeGet: vi.fn(),
  outlet: { view: null as (() => ReactNode) | null },
}));

vi.mock("@tanstack/react-router", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@tanstack/react-router")>()),
  Outlet: () => outlet.view?.() ?? <p>page content</p>,
  useNavigate: () => navigate,
}));
vi.mock("@/lib/api", () => ({
  api: {
    api: {
      me: { get: meGet },
      home: { get: homeGet },
      notifications: { get: () => new Promise(() => undefined) },
    },
  },
}));
vi.mock("@/lib/ssr-session", () => ({ getSessionSSR: vi.fn() }));
// The palette as far as the shell is concerned: its "Notificações" closes it
// (the focused option leaves the page) and opens the bell panel.
vi.mock("@/components/command-palette", () => ({
  CommandPalette: ({
    onOpenChange,
    onOpenNotifications,
    open,
  }: {
    onOpenChange: (open: boolean) => void;
    onOpenNotifications: () => void;
    open: boolean;
  }) =>
    open ? (
      <button
        onClick={() => {
          onOpenChange(false);
          onOpenNotifications();
        }}
        type="button"
      >
        palette: Notificações
      </button>
    ) : null,
}));
vi.mock("@/components/layout/app-frame", () => ({
  AppFrame: ({
    identity,
    children,
    moment,
    navCounts,
    onOpenNotifications,
    unreadCount,
  }: {
    children: ReactNode;
    identity: { name: string } | null;
    moment: { detail: string; title: string } | null;
    navCounts: { contracts: number; now: number };
    onOpenNotifications: () => void;
    unreadCount: number;
  }) => (
    <div data-testid="shell">
      <span>{identity?.name ?? "no identity"}</span>
      <span>unread {unreadCount}</span>
      <span>moment {moment?.title ?? "none"}</span>
      <span>
        counts {navCounts.now}/{navCounts.contracts}
      </span>
      <button
        data-notifications-trigger="sidebar"
        onClick={onOpenNotifications}
        type="button"
      >
        bell
      </button>
      {children}
    </div>
  ),
}));

import { Route } from "../src/routes/_app";

const AppLayout = Route.options.component as () => ReactNode;
const seeded = { id: "u1", name: "Maria", email: "m@e.com", image: null };

/** Page content that opens the bell panel, as "Notificações recentes › Ver todas" does. */
function SeeAllFromThePage() {
  const showNotifications = useShowNotifications();
  return (
    <button onClick={showNotifications} type="button">
      see all from the page
    </button>
  );
}

beforeEach(() => {
  navigate.mockReset();
  meGet.mockReset();
  homeGet.mockReset();
  homeGet.mockReturnValue(new Promise(() => undefined));
  outlet.view = null;
  clearIdentityCookie();
});

describe("_app layout", () => {
  it("renders the shell at once from the SSR seed while /me is still pending", () => {
    meGet.mockReturnValue(new Promise(() => undefined));
    const client = makeTestQueryClient();
    client.setQueryData(queryKeys.session, seeded);
    renderWithProviders(<AppLayout />, { client });

    expect(screen.getByTestId("shell")).toBeVisible();
    expect(screen.getByText("Maria")).toBeVisible();
    expect(screen.getByText("page content")).toBeVisible();
    expect(screen.queryByRole("status")).toBeNull();
    expect(navigate).not.toHaveBeenCalled();
  });

  it("sends the user to login when /me answers 401", async () => {
    meGet.mockResolvedValue({
      data: null,
      error: {
        status: 401,
        value: { error: { code: "UNAUTHORIZED", message: "x" } },
      },
    });
    renderWithProviders(<AppLayout />);

    await waitFor(() =>
      expect(navigate).toHaveBeenCalledWith({
        to: "/login",
        search: { redirect: undefined },
      })
    );
  });

  it("stores the identity cookie once /me loads", async () => {
    meGet.mockResolvedValue({
      data: {
        ...seeded,
        name: "Maria Souza",
        pixKey: null,
        emailRemindersOptIn: false,
        emailRemindersAvailable: false,
        locale: "pt-BR",
      },
      error: null,
    });
    renderWithProviders(<AppLayout />);

    await waitFor(() =>
      expect(parseIdentityCookie(document.cookie)).toEqual({
        ...seeded,
        name: "Maria Souza",
      })
    );
  });

  it("clears the identity cookie before sending a lost session to login", async () => {
    // biome-ignore lint/suspicious/noDocumentCookie: jsdom test setup, a hint left by an earlier visit
    document.cookie = serializeIdentityCookie(seeded, { secure: false });
    let cookieAtNavigation: string | undefined;
    navigate.mockImplementation(() => {
      cookieAtNavigation = document.cookie;
    });
    meGet.mockResolvedValue({
      data: null,
      error: {
        status: 401,
        value: { error: { code: "UNAUTHORIZED", message: "x" } },
      },
    });
    renderWithProviders(<AppLayout />);

    await waitFor(() => expect(navigate).toHaveBeenCalled());
    expect(parseIdentityCookie(cookieAtNavigation)).toBeNull();
  });

  it("the bell count comes from the home, with no polling of its own", async () => {
    meGet.mockReturnValue(new Promise(() => undefined));
    homeGet.mockResolvedValue({
      data: homeFixture({ unreadCount: 4 }),
      error: null,
    });
    renderWithProviders(<AppLayout />);
    expect(await screen.findByText("unread 4")).toBeVisible();
  });

  it("the bell opens the notifications panel", async () => {
    meGet.mockReturnValue(new Promise(() => undefined));
    renderWithProviders(<AppLayout />);
    await userEvent.click(screen.getByRole("button", { name: "bell" }));
    expect(
      await screen.findByRole("dialog", { name: "Notificações" })
    ).toBeVisible();
  });

  it("⌘K → Notificações → Esc gives the focus back to the bell, not to <body>", async () => {
    meGet.mockReturnValue(new Promise(() => undefined));
    renderWithProviders(<AppLayout />);
    await userEvent.keyboard("{Meta>}k{/Meta}");
    await userEvent.click(
      await screen.findByRole("button", { name: "palette: Notificações" })
    );
    expect(
      await screen.findByRole("dialog", { name: "Notificações" })
    ).toBeVisible();
    await userEvent.keyboard("{Escape}");
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
    expect(screen.getByRole("button", { name: "bell" })).toHaveFocus();
  });

  it("the page content can open the bell panel through the shell (Ver todas)", async () => {
    meGet.mockReturnValue(new Promise(() => undefined));
    outlet.view = () => <SeeAllFromThePage />;
    renderWithProviders(<AppLayout />);
    await userEvent.click(
      screen.getByRole("button", { name: "see all from the page" })
    );
    expect(
      await screen.findByRole("dialog", { name: "Notificações" })
    ).toBeVisible();
  });

  it("closing the panel opened by Ver todas gives the focus back to Ver todas: the opener wins over the bell fallback", async () => {
    meGet.mockReturnValue(new Promise(() => undefined));
    outlet.view = () => <SeeAllFromThePage />;
    renderWithProviders(<AppLayout />);
    await userEvent.click(
      screen.getByRole("button", { name: "see all from the page" })
    );
    expect(
      await screen.findByRole("dialog", { name: "Notificações" })
    ).toBeVisible();
    await userEvent.keyboard("{Escape}");
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
    expect(
      screen.getByRole("button", { name: "see all from the page" })
    ).toHaveFocus();
  });

  it("the milestone of the moment comes from the same home, as text for the sidebar", async () => {
    meGet.mockReturnValue(new Promise(() => undefined));
    homeGet.mockResolvedValue({
      data: homeFixture({
        milestones: {
          ...homeFixture().milestones,
          previousMonthAllClear: { month: "2026-09", paidCount: 12 },
        },
      }),
      error: null,
    });
    renderWithProviders(<AppLayout />);
    expect(
      await screen.findByText("moment Tudo em dia em setembro")
    ).toBeVisible();
  });

  it("the sidebar counts come from the same home: pending actions and active contracts", async () => {
    meGet.mockReturnValue(new Promise(() => undefined));
    homeGet.mockResolvedValue({
      data: homeFixture({
        actions: ["i1", "i2", "i3"].map((installmentId) =>
          installmentAction({ installmentId })
        ),
        activeContractsCount: 2,
      }),
      error: null,
    });
    renderWithProviders(<AppLayout />);
    expect(await screen.findByText("counts 3/2")).toBeVisible();
  });
});
