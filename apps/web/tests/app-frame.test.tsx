import { Bell } from "@phosphor-icons/react";
import {
  createMemoryHistory,
  createRootRoute,
  createRoute,
  createRouter,
  Outlet,
  RouterProvider,
  useLocation,
} from "@tanstack/react-router";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { AppFrame, type ShellProps } from "@/components/layout/app-frame";
import { visibleNotificationsTrigger } from "@/components/layout/notifications-trigger";
import type { SessionIdentity } from "@/lib/session-resolver";
import { renderWithProviders } from "./test-utils";

vi.mock("@/lib/auth-client", () => ({ signOut: vi.fn(async () => undefined) }));
vi.mock("@/lib/api", () => ({
  api: {
    api: { me: { patch: vi.fn(async () => ({ data: {}, error: null })) } },
  },
}));

// The sidebar trigger is named "Conta, <name>"; the avatar-only one just "Conta".
const ACCOUNT_TRIGGER = /^Conta/;

const maria: SessionIdentity = {
  id: "u1",
  name: "Maria Souza",
  email: "maria@example.com",
  image: null,
};

const openNotifications = vi.fn();
const startWidth = window.innerWidth;
beforeEach(() => {
  openNotifications.mockReset();
});
afterEach(() => {
  window.innerWidth = startWidth;
});

/** Each test page says where it is, so a dynamic route reads like the others. */
function PathHeading() {
  const pathname = useLocation({ select: (location) => location.pathname });
  return <h1>page {pathname}</h1>;
}

async function renderAt(
  path: string,
  shell: Partial<Omit<ShellProps, "onOpenNotifications" | "onOpenSearch">> = {}
) {
  const rootRoute = createRootRoute({
    component: () => (
      <AppFrame
        activeContracts={{ items: [], total: 0 }}
        identity={maria}
        moment={null}
        navCounts={{ contracts: 0, now: 0 }}
        notificationsOpen={false}
        onOpenNotifications={openNotifications}
        onOpenSearch={vi.fn()}
        unreadCount={0}
        {...shell}
      >
        <Outlet />
      </AppFrame>
    ),
  });
  rootRoute.addChildren(
    ["/", "/contracts", "/contracts/new", "/contracts/$id", "/settings"].map(
      (p) =>
        createRoute({
          getParentRoute: () => rootRoute,
          path: p,
          component: PathHeading,
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

  it("the bell and the sidebar row carry the unread count and open the panel", async () => {
    await renderAt("/", { unreadCount: 3 });
    const bells = screen.getAllByRole("button", {
      name: "Notificações, 3 não lidas",
    });
    expect(bells).toHaveLength(2);
    for (const bell of bells) {
      expect(bell).toHaveAttribute("aria-haspopup", "dialog");
      expect(bell).toHaveAttribute("aria-expanded", "false");
      await userEvent.click(bell);
    }
    expect(openNotifications).toHaveBeenCalledTimes(2);
  });

  it("with the panel open, both bells say so: expanded, filled icon and the sidebar row tinted white", async () => {
    await renderAt("/", { notificationsOpen: true, unreadCount: 2 });
    const filled = render(<Bell weight="fill" />).container.querySelector(
      "svg"
    );
    const bells = screen.getAllByRole("button", {
      name: "Notificações, 2 não lidas",
    });
    expect(bells).toHaveLength(2);
    for (const bell of bells) {
      expect(bell).toHaveAttribute("aria-expanded", "true");
      expect(bell.querySelector("svg")?.innerHTML).toBe(filled?.innerHTML);
    }
    const row = within(screen.getByRole("complementary")).getByRole("button", {
      name: "Notificações, 2 não lidas",
    });
    expect(row).toHaveClass("bg-surface");
  });

  it("closed, the bells are outlined and the row is not tinted", async () => {
    await renderAt("/");
    const outlined = render(<Bell />).container.querySelector("svg");
    const bells = screen.getAllByRole("button", { name: "Notificações" });
    for (const bell of bells) {
      expect(bell).toHaveAttribute("aria-expanded", "false");
      expect(bell.querySelector("svg")?.innerHTML).toBe(outlined?.innerHTML);
    }
    expect(
      within(screen.getByRole("complementary")).getByRole("button", {
        name: "Notificações",
      })
    ).not.toHaveClass("bg-surface");
  });

  it("the bell on screen is the one the focus returns to, whatever the width in px says", async () => {
    await renderAt("/");
    const sidebar = screen.getByRole("complementary");
    const topBar = screen.getByRole("banner");
    const sidebarRow = within(sidebar).getByRole("button", {
      name: "Notificações",
    });
    const [topBarBell] = within(topBar).getAllByRole("button", {
      name: "Notificações",
    });
    // No CSS in jsdom: display none stands in for md:hidden and hidden md:flex.
    // 1024 px with the sidebar hidden is md in rem with a browser font above
    // 16 px (48rem at 22 px is 1056 px), the case a px media query gets wrong.
    window.innerWidth = 1024;
    sidebar.style.display = "none";
    expect(visibleNotificationsTrigger()).toBe(topBarBell);
    sidebar.style.display = "";
    topBar.style.display = "none";
    expect(visibleNotificationsTrigger()).toBe(sidebarRow);
  });

  it("one unread reads in the singular", async () => {
    await renderAt("/", { unreadCount: 1 });
    expect(
      screen.getAllByRole("button", { name: "Notificações, 1 não lida" })
    ).toHaveLength(2);
  });

  it("shows the milestone of the moment as a lime card at the foot of the sidebar", async () => {
    await renderAt("/", {
      moment: {
        label: "Tudo em dia em setembro",
        title: "12 de 12 parcelas quitadas",
        detail: null,
        percent: 100,
      },
    });
    const label = screen.getByText("Tudo em dia em setembro");
    expect(label).toBeVisible();
    expect(screen.getByText("12 de 12 parcelas quitadas")).toBeVisible();
    expect(label.closest("aside")).not.toBeNull();
    // Dark text on lime, never lime text (DIRECAO).
    expect(label.closest("div")).toHaveClass(
      "bg-highlight",
      "text-on-highlight"
    );
  });

  it("o cartão limão do marco do momento: rótulo, anel com o %, título e detalhe", async () => {
    await renderAt("/", {
      moment: {
        label: "Mais perto de quitar",
        title: "Celular da Ana · 9/10",
        detail: "Falta 1 parcela, em 13/10",
        percent: 90,
      },
    });
    const card = screen
      .getByText("Mais perto de quitar")
      .closest("div") as HTMLElement;
    expect(card).toHaveClass("bg-highlight");
    expect(within(card).getByText("90%")).toBeVisible();
    expect(card.querySelector("svg")).toHaveAttribute("width", "22");
    expect(within(card).getByText("Celular da Ana · 9/10")).toBeVisible();
    expect(within(card).getByText("Falta 1 parcela, em 13/10")).toBeVisible();
    // A long detail wraps without leaving one word (the date) alone on the last line.
    expect(within(card).getByText("Falta 1 parcela, em 13/10")).toHaveClass(
      "text-pretty"
    );
  });

  it("um marco que não é progresso (pago no mês): sem anel e sem %", async () => {
    await renderAt("/", {
      moment: {
        label: "Pago em outubro",
        title: "R$ 1.250,00",
        detail: null,
        percent: null,
      },
    });
    const card = screen
      .getByText("Pago em outubro")
      .closest("div") as HTMLElement;
    expect(within(card).getByText("R$ 1.250,00")).toBeVisible();
    expect(card.querySelector("svg")).toBeNull();
  });

  it("without a milestone the lime card is gone", async () => {
    await renderAt("/");
    expect(document.querySelector("aside .bg-highlight")).toBeNull();
  });

  it("desktop structure B: the sidebar sits on the canvas and only the content is a white panel, with no max width", async () => {
    await renderAt("/contracts");
    // The frame follows the screen: 12 px of canvas top, bottom and right, none on the left.
    const shell = document.getElementById("app-shell");
    expect(shell).toHaveClass("md:bg-canvas", "md:pt-3");
    expect(shell).not.toHaveClass("md:p-3");
    // viewport-fit=cover: a phone on its side is md+ with the notch at a side,
    // so the 12 px of canvas grow to the safe area, and the left one is the safe area itself.
    expect(shell).toHaveClass(
      "pl-[env(safe-area-inset-left)]",
      "md:pr-[max(0.75rem,env(safe-area-inset-right))]",
      "md:pb-[max(0.75rem,env(safe-area-inset-bottom))]"
    );
    const main = screen.getByRole("main");
    expect(main).toHaveClass("md:rounded-panel", "md:bg-surface");
    const row = main.parentElement;
    expect(row).toHaveClass("flex");
    expect(row).not.toHaveClass("max-w-[1440px]");
    expect(row).not.toHaveClass("mx-auto");
    expect(row).not.toHaveClass("gap-3");
    // No card: the sidebar is the canvas itself, 232 px wide, its own p-3 the gap to the panel.
    const sidebar = screen.getByRole("complementary");
    expect(sidebar).toHaveClass("w-[232px]", "p-3");
    // A short screen (a phone on its side) scrolls it instead of pushing the account menu out.
    expect(sidebar).toHaveClass("overflow-y-auto");
    expect(sidebar).not.toHaveClass("rounded-panel");
    expect(sidebar).not.toHaveClass("bg-surface");
    // The search stays a field on the canvas: white, no line around it.
    expect(screen.getByRole("button", { name: "Buscar…" })).toHaveClass(
      "bg-surface",
      "border-transparent"
    );
    // Hover with nav-hover (one step on the canvas); the active row stays black.
    const [sidebarNav] = screen.getAllByRole("navigation", {
      name: "Navegação principal",
    });
    const nav = within(sidebarNav as HTMLElement);
    expect(nav.getByRole("link", { name: "Agora" })).toHaveClass(
      "hover:bg-nav-hover"
    );
    expect(nav.getByRole("link", { name: "Contratos" })).toHaveClass(
      "data-[status=active]:bg-ink",
      "data-[status=active]:text-ink-inverse"
    );
  });

  it("below md the content uses the phone's surfaces (no white panel)", async () => {
    await renderAt("/");
    expect(document.getElementById("conteudo")).toHaveClass(
      "max-md:page-surfaces"
    );
  });

  it("Agora and Contratos show their counts, hidden from AT and read in the link name", async () => {
    await renderAt("/contracts", { navCounts: { contracts: 2, now: 3 } });
    const [sidebarNav, tabBar] = screen.getAllByRole("navigation", {
      name: "Navegação principal",
    });
    const nav = within(sidebarNav as HTMLElement);
    const now = nav.getByRole("link", { name: "Agora, 3 pendências" });
    const contracts = nav.getByRole("link", { name: "Contratos, 2 ativos" });
    expect(now).toHaveTextContent("Agora3");
    expect(contracts).toHaveTextContent("Contratos2");
    const nowCount = within(now).getByText("3");
    expect(nowCount).toHaveAttribute("aria-hidden", "true");
    expect(nowCount).toHaveClass("tabular-nums", "text-ink-muted");
    // On the active (black) row the number reads light: ink-inverse at 70% passes AA there.
    const contractsCount = within(contracts).getByText("2");
    expect(contractsCount).toHaveAttribute("aria-hidden", "true");
    expect(contractsCount).toHaveClass("tabular-nums", "text-ink-inverse/70");
    // On a phone nothing changes: the tab bar shows no numbers.
    const tabs = within(tabBar as HTMLElement);
    expect(tabs.getByRole("link", { name: "Agora" }).textContent).toBe("Agora");
    expect(tabs.getByRole("link", { name: "Contratos" }).textContent).toBe(
      "Contratos"
    );
  });

  it("one pending action and one active contract read in the singular", async () => {
    await renderAt("/", { navCounts: { contracts: 1, now: 1 } });
    const [sidebarNav] = screen.getAllByRole("navigation", {
      name: "Navegação principal",
    });
    const nav = within(sidebarNav as HTMLElement);
    expect(nav.getByRole("link", { name: "Agora, 1 pendência" })).toBeVisible();
    expect(nav.getByRole("link", { name: "Contratos, 1 ativo" })).toBeVisible();
  });

  it("with nothing to count, no number shows", async () => {
    await renderAt("/");
    const [sidebarNav] = screen.getAllByRole("navigation", {
      name: "Navegação principal",
    });
    const nav = within(sidebarNav as HTMLElement);
    expect(nav.getByRole("link", { name: "Agora" }).textContent).toBe("Agora");
    expect(nav.getByRole("link", { name: "Contratos" }).textContent).toBe(
      "Contratos"
    );
  });

  it("shows the Quitto logo in the sidebar and the top bar, never a placeholder", async () => {
    await renderAt("/");
    const logos = screen.getAllByRole("img", { name: "Quitto" });
    expect(logos).toHaveLength(2);
    for (const logo of logos) {
      expect(logo).toHaveClass("text-brand");
    }
    expect(document.querySelector(".rounded-full.bg-brand-surface")).toBeNull();
    // DIRECAO › Logo: 24 px in the sidebar, 22 px on the phone's top bar.
    expect(
      within(screen.getByRole("complementary")).getByRole("img", {
        name: "Quitto",
      })
    ).toHaveStyle({ fontSize: "24px" });
    expect(
      within(screen.getByRole("banner")).getByRole("img", { name: "Quitto" })
    ).toHaveStyle({ fontSize: "22px" });
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
    // WCAG 2.5.3: the sidebar (full) trigger's name includes the visible name;
    // the avatar-only top bar has nothing visible to match, so just "Conta".
    expect(
      screen.getByRole("button", { name: "Conta, Maria Souza" })
    ).toHaveTextContent("Maria Souza");
    expect(screen.getByRole("button", { name: "Conta" })).toBeVisible();
    const [trigger] = screen.getAllByRole("button", { name: ACCOUNT_TRIGGER });
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
    await renderAt("/", { identity: null });
    expect(screen.queryByText("Maria Souza")).toBeNull();
    expect(screen.getAllByRole("button", { name: "Conta" })).toHaveLength(2);
  });

  it("offers 'Novo contrato' in the mobile tab bar", async () => {
    await renderAt("/");
    expect(screen.getByRole("link", { name: "Novo contrato" })).toHaveAttribute(
      "href",
      "/contracts/new"
    );
  });
});

const SIX = {
  total: 6,
  items: [
    {
      contractId: "c6",
      title: "Notebook da Marina",
      paidCount: 2,
      totalCount: 12,
      hasOverdue: true,
    },
    {
      contractId: "c5",
      title: "Aluguel da sala",
      paidCount: 4,
      totalCount: 12,
      hasOverdue: true,
    },
    {
      contractId: "c4",
      title: "Moto do Rafa",
      paidCount: 2,
      totalCount: 10,
      hasOverdue: false,
    },
    {
      contractId: "c3",
      title: "Empréstimo do Carlos",
      paidCount: 6,
      totalCount: 10,
      hasOverdue: false,
    },
    {
      contractId: "c2",
      title: "Celular da Ana",
      paidCount: 9,
      totalCount: 10,
      hasOverdue: false,
    },
  ],
};

describe("Sidebar · Contratos ativos (mockup 13)", () => {
  it("até 5, na ordem que chegam, cada um com o anel e a fração; Ver todos (N) quando há mais", async () => {
    await renderAt("/", { activeContracts: SIX });
    const list = screen.getByRole("list", { name: "Contratos ativos" });
    const links = within(list).getAllByRole("link");
    expect(links).toHaveLength(5);
    // The order they come in (the API's fixed order), never re-sorted here.
    for (const [index, contract] of SIX.items.entries()) {
      expect(links[index]).toHaveTextContent(contract.title);
    }
    expect(links[0]).toHaveAttribute("href", "/contracts/c6");
    expect(links[0]?.querySelector("svg")).toHaveAttribute("width", "16");
    expect(links[2]).toHaveTextContent("2/10");
    expect(screen.getByRole("link", { name: "Ver todos (6)" })).toHaveAttribute(
      "href",
      "/contracts"
    );
  });

  it("a marca de atraso é dita ao leitor de tela; a fração também", async () => {
    await renderAt("/", { activeContracts: SIX });
    expect(
      screen.getByRole("link", {
        name: "Notebook da Marina em atraso, 2 de 12 quitadas",
      })
    ).toBeVisible();
    expect(
      screen.getByRole("link", { name: "Moto do Rafa 2 de 10 quitadas" })
    ).toBeVisible();
    // The visual mark beside the words: on the overdue ones only.
    const links = within(
      screen.getByRole("list", { name: "Contratos ativos" })
    ).getAllByRole("link");
    expect(links[0]?.querySelector(".bg-danger")).not.toBeNull();
    expect(links[2]?.querySelector(".bg-danger")).toBeNull();
  });

  it("Ver todos (N) é a página atual só na lista, não na página de um contrato", async () => {
    await renderAt("/contracts/new", { activeContracts: SIX });
    expect(
      screen.getByRole("link", { name: "Ver todos (6)" })
    ).not.toHaveAttribute("aria-current");
  });

  it("o contrato aberto: a linha inteira com o fundo do painel, o foco ainda por dentro", async () => {
    await renderAt("/contracts/c6", { activeContracts: SIX });
    const [open, ...others] = within(
      screen.getByRole("list", { name: "Contratos ativos" })
    ).getAllByRole("link");
    expect(open).toHaveAttribute("aria-current", "page");
    expect(open).toHaveAttribute("data-status", "active");
    // Selection is a tinted fill on the whole row (DIRECAO), never a colored
    // side bar: the panel's own surface, like the Notificações row while its
    // panel is open. The focus ring stays inside, as on every row.
    expect(open).toHaveClass(
      "data-[status=active]:bg-surface",
      "focus-visible:ring-inset"
    );
    // The overdue mark's halo takes the row's fill.
    expect(open?.querySelector(".bg-danger")).toHaveClass(
      "group-data-[status=active]:ring-surface"
    );
    for (const other of others) {
      expect(other).not.toHaveAttribute("aria-current");
    }
    expect(
      screen.getByRole("link", { name: "Ver todos (6)" })
    ).not.toHaveAttribute("aria-current");
  });

  it("antes do home: 3 linhas de esqueleto; com 0 contratos, nada", async () => {
    await renderAt("/", { activeContracts: null });
    const [sidebarNav] = screen.getAllByRole("navigation", {
      name: "Navegação principal",
    });
    // The group's shape while the home loads (decision 25): hidden from AT, no list yet.
    const skeleton = (sidebarNav as HTMLElement).querySelector(
      "[data-sidebar-contracts-skeleton]"
    );
    expect(skeleton).toHaveAttribute("aria-hidden", "true");
    expect(skeleton?.querySelectorAll("[data-skeleton-row]")).toHaveLength(3);
    expect(screen.queryByRole("list", { name: "Contratos ativos" })).toBeNull();
  });

  it("com 0 contratos (ou o home com erro), nem grupo nem esqueleto", async () => {
    await renderAt("/", { activeContracts: { items: [], total: 0 } });
    expect(screen.queryByRole("list", { name: "Contratos ativos" })).toBeNull();
    expect(
      document.querySelector("[data-sidebar-contracts-skeleton]")
    ).toBeNull();
  });

  it("itens da sidebar: hover com nav-hover e foco por dentro, sem cortar no canto; com 5, sem Ver todos", async () => {
    await renderAt("/", { activeContracts: { ...SIX, total: 5 } });
    expect(screen.queryByRole("link", { name: "Ver todos (5)" })).toBeNull();
    // The sidebar's own nav: the tab bar has a "Contratos" link too, in the DOM with it.
    const [sidebarNav] = screen.getAllByRole("navigation", {
      name: "Navegação principal",
    });
    const nav = within(sidebarNav as HTMLElement);
    const contracts = nav.getByRole("link", { name: "Contratos" });
    // Inside on every item but the active one: on the black row an inner
    // brand ring is 2.31:1 (1.73:1 dark), so its ring stays outside, on the canvas.
    expect(contracts).toHaveClass(
      "hover:bg-nav-hover",
      "focus-visible:not-data-[status=active]:ring-inset"
    );
    expect(contracts).not.toHaveClass("focus-visible:ring-inset");
    const row = within(
      nav.getByRole("list", { name: "Contratos ativos" })
    ).getAllByRole("link")[0];
    expect(row).toHaveClass("hover:bg-nav-hover", "focus-visible:ring-inset");
    // The mockup's row padding (0 8px 0 12px measured from a 210 px sidebar):
    // 6 px on our 208, so the fraction ends where the mockup's does.
    expect(row).toHaveClass("pr-1.5");
    // The overdue mark's halo follows the row's hover, so no canvas ring shows on it.
    expect(row).toHaveClass("group");
    expect(row?.querySelector(".bg-danger")).toHaveClass(
      "group-hover:ring-nav-hover"
    );
  });

  it("a tecla ⌘K da busca: placa de 6 px, que não some no hover do campo", async () => {
    await renderAt("/");
    const search = screen.getByRole("button", { name: "Buscar…" });
    expect(search).toHaveClass("group");
    // rounded-md is 10 px in this repo (the legacy --radius): a pill on a 19 px plate.
    const plate = within(search).getByText("⌘K");
    expect(plate).toHaveClass("rounded-[6px]", "group-hover:bg-surface");
    expect(plate).not.toHaveClass("rounded-md");
  });
});
