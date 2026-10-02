import { screen, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { clearIdentityCookie } from "@/hooks/use-identity-cookie";
import {
  parseIdentityCookie,
  serializeIdentityCookie,
} from "@/lib/identity-cookie";
import { queryKeys } from "@/lib/query-keys";
import { makeTestQueryClient, renderWithProviders } from "./test-utils";

const { navigate, meGet } = vi.hoisted(() => ({
  navigate: vi.fn(),
  meGet: vi.fn(),
}));

vi.mock("@tanstack/react-router", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@tanstack/react-router")>()),
  Outlet: () => <p>page content</p>,
  useNavigate: () => navigate,
}));
vi.mock("@/lib/api", () => ({
  api: {
    api: {
      me: { get: meGet },
      notifications: {
        "unread-count": { get: () => new Promise(() => undefined) },
      },
    },
  },
}));
vi.mock("@/lib/ssr-session", () => ({ getSessionSSR: vi.fn() }));
vi.mock("@/components/command-palette", () => ({ CommandPalette: () => null }));
vi.mock("@/components/layout/app-frame", () => ({
  AppFrame: ({
    identity,
    children,
  }: {
    children: ReactNode;
    identity: { name: string } | null;
  }) => (
    <div data-testid="shell">
      <span>{identity?.name ?? "no identity"}</span>
      {children}
    </div>
  ),
}));

import { Route } from "../src/routes/_app";

const AppLayout = Route.options.component as () => ReactNode;
const seeded = { id: "u1", name: "Maria", email: "m@e.com", image: null };

beforeEach(() => {
  navigate.mockReset();
  meGet.mockReset();
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
});
