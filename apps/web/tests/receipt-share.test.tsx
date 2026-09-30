import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { renderWithProviders } from "./test-utils";

const state: { data: { token: string; createdAt: string } | null } = {
  data: null,
};
const toastError = vi.fn();
vi.mock("sonner", () => ({
  toast: { error: (m: string) => toastError(m), success: vi.fn() },
}));
const createAsync = vi.fn();
const revokeAsync = vi.fn();
vi.mock("../src/hooks/use-receipt-share", () => ({
  useReceiptShareQuery: (_id: string, enabled: boolean) => ({
    data: enabled ? state.data : undefined,
    isPending: false,
  }),
  useCreateReceiptShareMutation: () => ({
    mutateAsync: createAsync,
    isPending: false,
  }),
  useRevokeReceiptShareMutation: () => ({
    mutateAsync: revokeAsync,
    isPending: false,
  }),
}));

import { ReceiptShare } from "../src/components/receipt-share";

const COMPARTILHAR_RECIBO = /compartilhar recibo/i;
const WHATSAPP = /whatsapp/i;
const E_MAIL = /e-mail/i;
const COPIAR_LINK = /copiar link/i;
const COMPARTILHAR = /compartilhar…/i;
const LINK_P_BLICO_ATIVO = /link público ativo/i;
const REVOGAR_LINK = /revogar link/i;
const CANCELAR = /cancelar/i;
const REVOGAR = /^revogar$/i;

const base = {
  installmentId: "i1",
  isOwner: true,
  status: "paid" as const,
  title: "Aluguel",
  sequence: 3,
  installmentsCount: 12,
};

describe("ReceiptShare", () => {
  beforeEach(() => {
    state.data = null;
    toastError.mockReset();
    createAsync.mockReset().mockImplementation(() => {
      // Espelha o cache da query: a criação grava o share em state.data.
      state.data = { token: "tok", createdAt: "2026-09-29T12:00:00.000Z" };
      return Promise.resolve(state.data);
    });
    revokeAsync.mockReset().mockResolvedValue(null);
  });

  it("não renderiza para não-dono nem para parcela não paga", () => {
    const { container, rerender } = renderWithProviders(
      <ReceiptShare {...base} isOwner={false} />
    );
    expect(container).toBeEmptyDOMElement();
    rerender(<ReceiptShare {...base} status="pending" />);
    expect(container).toBeEmptyDOMElement();
  });

  it("sem link: Compartilhar cria o link e abre as opções", async () => {
    renderWithProviders(<ReceiptShare {...base} />);
    await userEvent.click(
      screen.getByRole("button", { name: COMPARTILHAR_RECIBO })
    );
    await waitFor(() => expect(createAsync).toHaveBeenCalledTimes(1));
    const wa = await screen.findByRole("menuitem", { name: WHATSAPP });
    expect(wa.closest("a")?.getAttribute("href")).toContain(
      "https://wa.me/?text="
    );
    expect(screen.getByRole("menuitem", { name: E_MAIL })).toBeVisible();
    expect(screen.getByRole("menuitem", { name: COPIAR_LINK })).toBeVisible();
  });

  it("Compartilhar… só aparece com navigator.share", async () => {
    renderWithProviders(<ReceiptShare {...base} />);
    await userEvent.click(
      screen.getByRole("button", { name: COMPARTILHAR_RECIBO })
    );
    await screen.findByRole("menuitem", { name: COPIAR_LINK });
    expect(screen.queryByRole("menuitem", { name: COMPARTILHAR })).toBeNull();
  });

  it("link ativo: mostra estado e revoga com confirmação (foco no Cancelar)", async () => {
    state.data = { token: "tok", createdAt: "2026-09-29T12:00:00.000Z" };
    renderWithProviders(<ReceiptShare {...base} />);
    expect(screen.getByText(LINK_P_BLICO_ATIVO)).toBeVisible();
    await userEvent.click(screen.getByRole("button", { name: REVOGAR_LINK }));
    const dialog = await screen.findByRole("dialog");
    expect(
      within(dialog).getByRole("button", { name: CANCELAR })
    ).toHaveFocus();
    await userEvent.click(
      within(dialog).getByRole("button", { name: REVOGAR })
    );
    await waitFor(() => expect(revokeAsync).toHaveBeenCalledTimes(1));
  });

  it("link revogado em outro lugar: o menu deixa de oferecer o link", async () => {
    state.data = { token: "tok", createdAt: "2026-09-29T12:00:00.000Z" };
    const { rerender } = renderWithProviders(<ReceiptShare {...base} />);
    await userEvent.click(
      screen.getByRole("button", { name: COMPARTILHAR_RECIBO })
    );
    await screen.findByRole("menuitem", { name: COPIAR_LINK });
    state.data = null;
    rerender(<ReceiptShare {...base} />);
    await waitFor(() =>
      expect(screen.queryByRole("menuitem", { name: COPIAR_LINK })).toBeNull()
    );
    expect(screen.queryByText(LINK_P_BLICO_ATIVO)).toBeNull();
  });

  it("falha ao copiar: mostra toast de erro sem rejeição solta", async () => {
    state.data = { token: "tok", createdAt: "2026-09-29T12:00:00.000Z" };
    Object.defineProperty(navigator, "clipboard", {
      configurable: true,
      value: { writeText: vi.fn().mockRejectedValue(new Error("denied")) },
    });
    renderWithProviders(<ReceiptShare {...base} />);
    await userEvent.click(
      screen.getByRole("button", { name: COMPARTILHAR_RECIBO })
    );
    await userEvent.click(
      await screen.findByRole("menuitem", { name: COPIAR_LINK })
    );
    await waitFor(() =>
      expect(toastError).toHaveBeenCalledWith("Não foi possível copiar o link")
    );
  });

  it("falha ao revogar: mantém o diálogo aberto", async () => {
    state.data = { token: "tok", createdAt: "2026-09-29T12:00:00.000Z" };
    revokeAsync.mockRejectedValue(new Error("boom"));
    renderWithProviders(<ReceiptShare {...base} />);
    await userEvent.click(screen.getByRole("button", { name: REVOGAR_LINK }));
    const dialog = await screen.findByRole("dialog");
    await userEvent.click(
      within(dialog).getByRole("button", { name: REVOGAR })
    );
    await waitFor(() => expect(revokeAsync).toHaveBeenCalledTimes(1));
    expect(screen.getByRole("dialog")).toBeVisible();
  });
});
