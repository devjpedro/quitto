import {
  createMemoryHistory,
  createRootRoute,
  createRoute,
  createRouter,
  Outlet,
  RouterProvider,
} from "@tanstack/react-router";
import { screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { AppFrame } from "@/components/layout/app-frame";
import type { SessionIdentity } from "@/lib/session-resolver";
import { renderWithProviders } from "./test-utils";

vi.mock("@/lib/auth-client", () => ({ signOut: vi.fn(async () => undefined) }));
vi.mock("@/lib/api", () => ({
  api: {
    api: { me: { patch: vi.fn(async () => ({ data: {}, error: null })) } },
  },
}));

const maria: SessionIdentity = {
  id: "u1",
  name: "Maria Souza",
  email: "maria@example.com",
  image: null,
};

async function renderAt(
  path: string,
  identity: SessionIdentity | null = maria,
  unreadCount = 0
) {
  const rootRoute = createRootRoute({
    component: () => (
      <AppFrame
        identity={identity}
        onOpenSearch={vi.fn()}
        unreadCount={unreadCount}
      >
        <Outlet />
      </AppFrame>
    ),
  });
  rootRoute.addChildren(
    ["/", "/contracts", "/contracts/new", "/notifications", "/settings"].map(
      (p) =>
        createRoute({
          getParentRoute: () => rootRoute,
          path: p,
          component: () => <h1>page {p}</h1>,
        })
    )
  );
  const router = createRouter({
    routeTree: rootRoute,
    history: createMemoryHistory({ initialEntries: [path] }),
  });
  renderWithProviders(<RouterProvider router={router} />);
  await screen.findByRole("heading", { name: `page ${path}` });
}

describe("AppFrame", () => {
  it("marks the current section in the main navigation", async () => {
    await renderAt("/contracts");
    // jsdom has no CSS: both the sidebar nav and the tab bar nav are in the tree.
    const [sidebarNav] = screen.getAllByRole("navigation", {
      name: "Navegação principal",
    });
    const nav = within(sidebarNav as HTMLElement);
    expect(nav.getByRole("link", { name: "Contratos" })).toHaveAttribute(
      "aria-current",
      "page"
    );
    expect(nav.getByRole("link", { name: "Agora" })).not.toHaveAttribute(
      "aria-current"
    );
  });

  it("announces unread notifications in the link name", async () => {
    await renderAt("/", maria, 3);
    expect(
      screen.getAllByRole("link", { name: "Notificações, 3 não lidas" }).length
    ).toBeGreaterThan(0);
  });

  it("has a skip link to the main content", async () => {
    await renderAt("/");
    expect(
      screen.getByRole("link", { name: "Pular para o conteúdo" })
    ).toHaveAttribute("href", "#conteudo");
    expect(document.getElementById("conteudo")?.tagName).toBe("MAIN");
  });

  it("opens the account menu with settings, theme, language and sign out", async () => {
    await renderAt("/");
    const [trigger] = screen.getAllByRole("button", { name: "Conta" });
    await userEvent.click(trigger as HTMLElement);
    expect(
      await screen.findByRole("menuitem", { name: "Ajustes" })
    ).toBeVisible();
    expect(screen.getByRole("menuitem", { name: "Tema escuro" })).toBeVisible();
    expect(
      screen.getByRole("menuitemradio", { name: "Português (Brasil)" })
    ).toHaveAttribute("aria-checked", "true");
    expect(
      screen.getByRole("menuitemradio", { name: "English (US)" })
    ).toBeVisible();
    expect(screen.getByRole("menuitem", { name: "Sair" })).toBeVisible();
  });

  it("renders without identity (cold start) without crashing or leaking a name", async () => {
    await renderAt("/", null);
    expect(screen.queryByText("Maria Souza")).toBeNull();
  });

  it("offers 'Novo contrato' in the mobile tab bar", async () => {
    await renderAt("/");
    expect(screen.getByRole("link", { name: "Novo contrato" })).toHaveAttribute(
      "href",
      "/contracts/new"
    );
  });
});
