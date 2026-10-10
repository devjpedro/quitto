import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ patchMe: vi.fn() }));
vi.mock("@tanstack/react-router", async () => ({
  Link: (await import("./router-link-stub")).LinkStub,
  useHydrated: () => true,
}));
vi.mock("@/lib/api", () => ({
  api: { api: { me: { patch: mocks.patchMe } } },
}));
vi.mock("@/lib/auth-client", () => ({
  changePassword: vi.fn(),
  signOut: vi.fn(),
}));

import { renderSettings } from "./settings-fixtures";

const KEY = "joao@exemplo.com";

afterEach(() => vi.clearAllMocks());

describe("Recebimento (PIX)", () => {
  it("sem chave: a frase do porquê, o campo e Salvar", () => {
    renderSettings("pix");
    expect(
      screen.getByText("Sem chave, quem te paga não vê o QR nas parcelas.")
    ).toBeVisible();
    expect(screen.getByLabelText("Sua chave PIX")).toBeVisible();
    expect(screen.getByRole("button", { name: "Salvar" })).toBeVisible();
  });

  it("chave inválida: o erro no campo, sem chamar a API", async () => {
    const user = userEvent.setup();
    renderSettings("pix");
    await user.type(screen.getByLabelText("Sua chave PIX"), "isto não é chave");
    await user.click(screen.getByRole("button", { name: "Salvar" }));
    expect(screen.getByLabelText("Sua chave PIX")).toHaveAccessibleDescription(
      "Confira a chave."
    );
    expect(mocks.patchMe).not.toHaveBeenCalled();
  });

  it("salvar: PATCH /me com a chave aparada, a linha salva com o tipo e o Agora revalidado", async () => {
    mocks.patchMe.mockResolvedValue({ data: { pixKey: KEY }, error: null });
    const user = userEvent.setup();
    const { client } = renderSettings("pix");
    const invalidate = vi.spyOn(client, "invalidateQueries");
    await user.type(screen.getByLabelText("Sua chave PIX"), `  ${KEY}  `);
    await user.click(screen.getByRole("button", { name: "Salvar" }));
    await waitFor(() =>
      expect(mocks.patchMe).toHaveBeenCalledWith({ pixKey: KEY })
    );
    const saved = await screen.findByTestId("pix-saved");
    expect(saved).toHaveTextContent(KEY);
    expect(saved).toHaveTextContent("chave e-mail");
    expect(invalidate).toHaveBeenCalledWith({ queryKey: ["home"] });
  });

  it("Alterar abre o campo com a chave; Cancelar volta à linha", async () => {
    const user = userEvent.setup();
    renderSettings("pix", { pixKey: KEY });
    await user.click(screen.getByRole("button", { name: "Alterar" }));
    expect(screen.getByLabelText("Sua chave PIX")).toHaveValue(KEY);
    await user.click(screen.getByRole("button", { name: "Cancelar" }));
    expect(screen.getByTestId("pix-saved")).toBeVisible();
  });

  it("Remover pede confirmação; confirmar manda pixKey null", async () => {
    mocks.patchMe.mockResolvedValue({ data: { pixKey: null }, error: null });
    const user = userEvent.setup();
    renderSettings("pix", { pixKey: KEY });
    await user.click(screen.getByRole("button", { name: "Remover" }));
    expect(mocks.patchMe).not.toHaveBeenCalled();
    expect(
      await screen.findByRole("dialog", { name: "Remover a chave PIX?" })
    ).toBeVisible();
    await user.click(
      within(screen.getByRole("dialog")).getByRole("button", {
        name: "Remover",
      })
    );
    await waitFor(() =>
      expect(mocks.patchMe).toHaveBeenCalledWith({ pixKey: null })
    );
  });

  it("duas submissões rápidas: uma chamada só", async () => {
    mocks.patchMe.mockImplementation(
      () =>
        new Promise((resolve) =>
          setTimeout(() => resolve({ data: { pixKey: KEY }, error: null }), 30)
        )
    );
    const user = userEvent.setup();
    renderSettings("pix");
    await user.type(screen.getByLabelText("Sua chave PIX"), KEY);
    await user.keyboard("{Enter}{Enter}");
    await waitFor(() => expect(mocks.patchMe).toHaveBeenCalledTimes(1));
  });
});
