import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@tanstack/react-router", () => ({
  Link: ({
    children,
    activeProps: _activeProps,
    ...props
  }: {
    children: React.ReactNode;
    activeProps?: Record<string, unknown>;
  }) => <a {...props}>{children}</a>,
}));
vi.mock("@/lib/auth-client", () => ({ signOut: vi.fn() }));
vi.mock("@/hooks/use-me", () => ({
  useMeQuery: () => ({
    data: { id: "u1", name: "Test", email: "t@e.com", image: null },
  }),
}));
vi.mock("@/components/notification-bell", () => ({
  NotificationBell: () => <div data-testid="bell" />,
}));
vi.mock("@/hooks/use-notifications", () => ({
  useUnreadCountQuery: vi.fn(() => ({ data: { count: 0 } })),
}));

import { useUnreadCountQuery } from "@/hooks/use-notifications";
import { AppSidebar } from "../src/components/app-sidebar";

const NAV_LABEL = /Navegação principal/i;

/** A sidebar desktop; o botão "Buscar…" e a lupa do rail vivem só aqui. */
function desktopAside(container: HTMLElement): HTMLElement {
  const aside = container.querySelector("aside");
  if (!aside) {
    throw new Error("sidebar desktop (<aside>) não renderizou");
  }
  return aside;
}

/** 2º landmark de navegação = a bottom-nav do mobile (a 1ª é a do <aside>). */
function bottomNav(): HTMLElement {
  const navs = screen.getAllByRole("navigation", { name: NAV_LABEL });
  const nav = navs[1];
  if (!nav) {
    throw new Error("bottom-nav mobile não renderizou");
  }
  return nav;
}

describe("AppSidebar", () => {
  beforeEach(() => {
    vi.mocked(useUnreadCountQuery).mockReturnValue({
      data: { count: 0 },
    } as unknown as ReturnType<typeof useUnreadCountQuery>);
  });

  it("renders Dashboard and Contratos nav items", () => {
    render(<AppSidebar />);
    expect(screen.getAllByText("Dashboard").length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText("Contratos").length).toBeGreaterThanOrEqual(1);
  });

  it("renders the Notificações nav item", () => {
    render(<AppSidebar />);
    expect(screen.getAllByText("Notificações").length).toBeGreaterThanOrEqual(
      1
    );
  });

  it("shows the user name from useMeQuery in the footer", () => {
    render(<AppSidebar />);
    expect(screen.getByText("Test")).toBeInTheDocument();
  });

  it("labels both navigation landmarks (desktop + mobile) as 'Navegação principal'", () => {
    render(<AppSidebar />);
    expect(screen.getAllByRole("navigation", { name: NAV_LABEL })).toHaveLength(
      2
    );
  });

  it("shows the unread badge on Notificações when count > 0", () => {
    vi.mocked(useUnreadCountQuery).mockReturnValue({
      data: { count: 3 },
    } as unknown as ReturnType<typeof useUnreadCountQuery>);
    render(<AppSidebar />);
    expect(screen.getAllByText("3").length).toBeGreaterThanOrEqual(1);
  });

  it("pins the desktop sidebar to the viewport (sticky, full height)", () => {
    const { container } = render(<AppSidebar />);
    const aside = container.querySelector("aside");
    expect(aside).not.toBeNull();
    // Guards the fixed-sidebar layout: without these the footer only shows
    // after scrolling to the bottom of long content.
    expect(aside).toHaveClass("sticky", "top-0", "h-screen");
  });
});

describe("AppSidebar — gatilhos da paleta ⌘K", () => {
  // Sem isto o `mockReturnValue` de outro teste vaza pra cá e o badge de não-lidas
  // entra no textContent da bottom-nav, quebrando a ordem esperada dos alvos.
  beforeEach(() => {
    vi.mocked(useUnreadCountQuery).mockReturnValue({
      data: { count: 0 },
    } as unknown as ReturnType<typeof useUnreadCountQuery>);
  });

  it("renderiza o botão 'Buscar…' com a dica ⌘K na sidebar expandida", () => {
    const { container } = render(<AppSidebar />);

    // O nome acessível é só "Buscar…": o chip do atalho é aria-hidden (o ⌘ vira
    // ruído no leitor de tela) e o atalho vai no aria-keyshortcuts.
    const trigger = within(desktopAside(container)).getByRole("button", {
      name: "Buscar…",
    });
    expect(trigger).toBeVisible();
    expect(trigger).toHaveTextContent("⌘K");
    expect(trigger).toHaveAttribute("aria-keyshortcuts", "Meta+K Control+K");
  });

  it("renderiza a lupa com nome acessível no rail colapsado", () => {
    const { container } = render(<AppSidebar collapsed />);

    const trigger = within(desktopAside(container)).getByRole("button", {
      name: "Buscar",
    });
    expect(trigger).toBeVisible();
  });

  it("chama onOpenSearch no clique do botão da expandida e da lupa do rail", async () => {
    const onOpenSearch = vi.fn();

    const expanded = render(<AppSidebar onOpenSearch={onOpenSearch} />);
    await userEvent.click(
      within(desktopAside(expanded.container)).getByRole("button", {
        name: "Buscar…",
      })
    );
    expect(onOpenSearch).toHaveBeenCalledTimes(1);
    expanded.unmount();

    const rail = render(<AppSidebar collapsed onOpenSearch={onOpenSearch} />);
    await userEvent.click(
      within(desktopAside(rail.container)).getByRole("button", {
        name: "Buscar",
      })
    );
    expect(onOpenSearch).toHaveBeenCalledTimes(2);
  });

  it("põe a busca como 5º alvo da bottom-nav, entre Contratos e Notificações", () => {
    render(<AppSidebar />);

    // Os filhos diretos são os alvos: os Fragments do map não viram nó no DOM.
    const targets = Array.from(bottomNav().children);
    expect(targets).toHaveLength(5);
    expect(targets.map((el) => el.textContent)).toEqual([
      "Dashboard",
      "Contratos",
      "Buscar",
      "Notificações",
      "Conta",
    ]);
  });

  it("mantém o alvo de toque de 44px no item novo e não o marca como navegação", async () => {
    const onOpenSearch = vi.fn();
    render(<AppSidebar onOpenSearch={onOpenSearch} />);

    // `getByRole("button")` já prova que não é <Link>: navegar é o que ele NÃO faz.
    const search = within(bottomNav()).getByRole("button", { name: "Buscar" });
    expect(search).toHaveClass("min-h-[44px]");
    expect(search).not.toHaveAttribute("aria-current");

    await userEvent.click(search);
    expect(onOpenSearch).toHaveBeenCalledTimes(1);
  });
});
