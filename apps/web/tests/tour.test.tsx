import { act, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { patchMe } = vi.hoisted(() => ({ patchMe: vi.fn() }));

vi.mock("@tanstack/react-router", async () => ({
  Link: (await import("./router-link-stub")).LinkStub,
  useHydrated: () => true,
}));
vi.mock("@/lib/api", () => ({
  api: { api: { me: { patch: patchMe, get: vi.fn() } } },
}));

import { TourOverlay } from "@/features/tour/components/tour-overlay";
import { useTourAutostart } from "@/features/tour/hooks/use-tour-autostart";
import { balloonPlacement, targetBox } from "@/features/tour/lib/tour-steps";
import { tourStore } from "@/features/tour/lib/tour-store";
import { queryKeys } from "@/lib/query-keys";
import { ME, renderSettings } from "./settings-fixtures";
import { makeTestQueryClient, renderWithProviders } from "./test-utils";

function Shell() {
  useTourAutostart();
  return (
    <>
      <a data-tour="new-contract" href="/contracts/new">
        Novo contrato
      </a>
      <a data-tour="nav-now" href="/">
        Agora
      </a>
      <a data-tour="nav-contracts" href="/contracts">
        Contratos
      </a>
      <a data-tour="nav-installments" href="/installments">
        Parcelas
      </a>
      <a data-tour="nav-people" href="/people">
        Pessoas
      </a>
      <button data-tour="notifications" type="button">
        Sino
      </button>
      <TourOverlay />
    </>
  );
}

function renderShell(tourCompletedAt: string | null | undefined) {
  const client = makeTestQueryClient();
  client.setQueryData(queryKeys.me, { ...ME, tourCompletedAt });
  client.setQueryDefaults(queryKeys.me, {
    staleTime: Number.POSITIVE_INFINITY,
  });
  return renderWithProviders(<Shell />, { client });
}

beforeEach(() => {
  patchMe.mockResolvedValue({
    data: { tourCompletedAt: "2026-10-08T12:00:00.000Z" },
    error: null,
  });
});

afterEach(() => {
  act(() => tourStore.close());
  vi.clearAllMocks();
});

describe("tour guiado", () => {
  it("abre sozinho no primeiro acesso (tourCompletedAt null), no passo 1 de 5", async () => {
    renderShell(null);
    expect(
      await screen.findByRole("dialog", { name: "Tudo começa num contrato" })
    ).toBeVisible();
    expect(screen.getByText("1 de 5")).toBeVisible();
  });

  it("conta que já viu o tour (ou cache sem o campo) não abre nada", () => {
    renderShell("2026-09-01T10:00:00.000Z");
    expect(screen.queryByRole("dialog")).toBeNull();
    renderShell(undefined);
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("Próximo e Voltar andam pelos 5 passos; o último tem Concluir e Criar meu primeiro contrato", async () => {
    renderShell(null);
    await screen.findByRole("dialog");
    expect(screen.queryByRole("button", { name: "Voltar" })).toBeNull();
    await userEvent.click(screen.getByRole("button", { name: "Próximo" }));
    expect(
      screen.getByRole("dialog", { name: "Agora: o que pede você hoje" })
    ).toBeVisible();
    expect(screen.getByText("2 de 5")).toBeVisible();
    await userEvent.click(screen.getByRole("button", { name: "Voltar" }));
    expect(screen.getByText("1 de 5")).toBeVisible();
    for (let i = 0; i < 4; i++) {
      await userEvent.click(screen.getByRole("button", { name: "Próximo" }));
    }
    expect(
      screen.getByRole("dialog", { name: "Avisos chegam no sino" })
    ).toBeVisible();
    expect(screen.getByText("5 de 5")).toBeVisible();
    expect(screen.queryByRole("button", { name: "Próximo" })).toBeNull();
    expect(
      screen.getByRole("link", { name: "Criar meu primeiro contrato" })
    ).toHaveAttribute("href", "/contracts/new");
    expect(screen.getByRole("button", { name: "Concluir" })).toBeVisible();
  });

  it("as setas andam e o Esc pula; pular grava como visto", async () => {
    renderShell(null);
    await screen.findByRole("dialog");
    await userEvent.keyboard("{ArrowRight}");
    expect(screen.getByText("2 de 5")).toBeVisible();
    await userEvent.keyboard("{ArrowLeft}");
    expect(screen.getByText("1 de 5")).toBeVisible();
    await userEvent.keyboard("{Escape}");
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(patchMe).toHaveBeenCalledWith({ tourCompleted: true });
  });

  it("Pular o tour grava como visto e não reabre sozinho", async () => {
    const { client } = renderShell(null);
    await screen.findByRole("dialog");
    await userEvent.click(screen.getByRole("button", { name: "Pular o tour" }));
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(patchMe).toHaveBeenCalledWith({ tourCompleted: true });
    expect(
      (client.getQueryData(queryKeys.me) as { tourCompletedAt: string | null })
        .tourCompletedAt
    ).not.toBeNull();
  });

  it("Concluir no último passo grava como visto", async () => {
    renderShell(null);
    await screen.findByRole("dialog");
    for (let i = 0; i < 4; i++) {
      await userEvent.click(screen.getByRole("button", { name: "Próximo" }));
    }
    await userEvent.click(screen.getByRole("button", { name: "Concluir" }));
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(patchMe).toHaveBeenCalledWith({ tourCompleted: true });
  });

  it("Criar meu primeiro contrato, no último passo, também grava como visto", async () => {
    renderShell(null);
    await screen.findByRole("dialog");
    for (let i = 0; i < 4; i++) {
      await userEvent.click(screen.getByRole("button", { name: "Próximo" }));
    }
    await userEvent.click(
      screen.getByRole("link", { name: "Criar meu primeiro contrato" })
    );
    expect(patchMe).toHaveBeenCalledWith({ tourCompleted: true });
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("o recorte do spotlight é a caixa exata do alvo (sem folga que invada o vizinho) e o alvo é trazido à tela", async () => {
    const scroll = vi.fn();
    const proto = HTMLElement.prototype as unknown as {
      scrollIntoView?: () => void;
    };
    const original = proto.scrollIntoView;
    proto.scrollIntoView = scroll;
    const rect = vi
      .spyOn(HTMLElement.prototype, "getBoundingClientRect")
      .mockReturnValue({
        top: 100,
        left: 20,
        right: 120,
        bottom: 146,
        width: 100,
        height: 46,
        x: 20,
        y: 100,
        toJSON: () => ({}),
      });
    try {
      renderShell(null);
      await screen.findByRole("dialog");
      const spot = document.querySelector<HTMLElement>(
        '[aria-hidden="true"].fixed.rounded-control'
      );
      expect(spot).toHaveStyle({
        top: "100px",
        left: "20px",
        width: "100px",
        height: "46px",
      });
      expect(spot?.className).toContain("ring-inset");
      expect(scroll).toHaveBeenCalledWith({ block: "nearest" });
    } finally {
      rect.mockRestore();
      proto.scrollIntoView = original;
    }
  });

  it("Refazer em Ajustes › Perfil zera a marca e abre o tour", async () => {
    patchMe.mockResolvedValue({ data: { tourCompletedAt: null }, error: null });
    const { client } = renderSettings("profile");
    await userEvent.click(
      screen.getByRole("button", { name: "Refazer o tour" })
    );
    expect(patchMe).toHaveBeenCalledWith({ tourCompleted: false });
    expect(tourStore.isOpen()).toBe(true);
    expect(
      (client.getQueryData(queryKeys.me) as { tourCompletedAt: string | null })
        .tourCompletedAt
    ).toBeNull();
  });
});

describe("posição do balão", () => {
  const phone = { height: 800, width: 390 };
  const desktop = { height: 900, width: 1512 };

  it("a partir de md, ao lado do alvo; abaixo, em cima (tab bar) ou embaixo (sino)", () => {
    const sidebarItem = { top: 300, left: 54, right: 313, bottom: 346 };
    expect(balloonPlacement(sidebarItem, desktop)).toMatchObject({
      left: 327,
      top: 292,
      width: 360,
    });
    const tabItem = { top: 740, left: 20, right: 80, bottom: 790 };
    expect(balloonPlacement(tabItem, phone)).toMatchObject({
      bottom: 74,
      width: 358,
    });
    const bell = { top: 8, left: 300, right: 340, bottom: 52 };
    const placed = balloonPlacement(bell, phone);
    expect(placed.top).toBe(66);
    // Never past the screen's edge.
    expect(placed.left + placed.width).toBeLessThanOrEqual(phone.width - 16);
  });

  it("a partir de md, numa janela baixa o balão sobe até caber, com margem", () => {
    const short = { height: 600, width: 1512 };
    const bell = { top: 404, left: 54, right: 313, bottom: 450 };
    const placed = balloonPlacement(bell, short, 220);
    expect(placed.top).toBe(600 - 220 - 16);
    // Com folga de sobra, segue o alvo.
    expect(balloonPlacement(bell, desktop, 220).top).toBe(396);
    // Mais alto que a janela: nunca acima da margem.
    expect(balloonPlacement(bell, short, 700).top).toBe(16);
  });

  it("sem alvo na tela, o balão fica no meio", () => {
    expect(balloonPlacement(null, desktop).left).toBe((1512 - 360) / 2);
  });

  it("o alvo é o primeiro elemento visível do data-tour, e a caixa une os alvos do passo", () => {
    document.body.innerHTML = `<a data-tour="a"></a><a data-tour="b"></a>`;
    const rect = (top: number, bottom: number) =>
      ({ top, bottom, left: 0, right: 10 }) as DOMRect;
    const [a, b] = Array.from(document.querySelectorAll("a"));
    (a as HTMLElement).checkVisibility = () => true;
    (b as HTMLElement).checkVisibility = () => true;
    (a as HTMLElement).getBoundingClientRect = () => rect(10, 30);
    (b as HTMLElement).getBoundingClientRect = () => rect(40, 70);
    expect(targetBox(["a", "b"])).toEqual({
      top: 10,
      bottom: 70,
      left: 0,
      right: 10,
    });
    expect(targetBox(["nenhum"])).toBeNull();
    document.body.innerHTML = "";
  });
});
