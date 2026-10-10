import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  deleteMe: vi.fn(),
  deletionSummary: vi.fn(),
  signOut: vi.fn(),
}));
vi.mock("@tanstack/react-router", async () => ({
  Link: (await import("./router-link-stub")).LinkStub,
  useHydrated: () => true,
}));
vi.mock("@/lib/api", () => ({
  api: {
    api: {
      me: {
        delete: mocks.deleteMe,
        "deletion-summary": { get: mocks.deletionSummary },
      },
    },
  },
}));
vi.mock("@/lib/auth-client", () => ({
  changePassword: vi.fn(),
  signOut: mocks.signOut,
}));

import { overwriteGetLocale } from "@/paraglide/runtime.js";
import { renderSettings } from "./settings-fixtures";

const SOMEM = /Somem a conta, 6 contratos/;

const SUMMARY = {
  contracts: 6,
  installments: 60,
  people: [
    { name: "Ana Rocha" },
    { name: "Carlos Lima" },
    { name: "Rafael Prado" },
  ],
};

afterEach(() => {
  vi.clearAllMocks();
  overwriteGetLocale(() => "pt-BR");
});

async function openDialog(user: ReturnType<typeof userEvent.setup>) {
  mocks.deletionSummary.mockResolvedValue({ data: SUMMARY, error: null });
  renderSettings("data");
  await user.click(screen.getByRole("button", { name: "Excluir" }));
  return screen.findByRole("dialog");
}

describe("Excluir a conta", () => {
  it("abre com o cursor no campo da frase", async () => {
    const user = userEvent.setup();
    await openDialog(user);
    await waitFor(() =>
      expect(
        screen.getByLabelText("Digite EXCLUIR para confirmar")
      ).toHaveFocus()
    );
  });

  it("diz o que some: contratos, parcelas e as pessoas", async () => {
    const user = userEvent.setup();
    const dialog = await openDialog(user);
    expect(await screen.findByText(SOMEM)).toBeVisible();
    expect(dialog).toHaveTextContent("60 parcelas");
    expect(dialog).toHaveTextContent("3 pessoas perdem o acesso a eles");
  });

  it("o botão fica desabilitado até a frase conferir", async () => {
    const user = userEvent.setup();
    await openDialog(user);
    const confirm = screen.getByRole("button", {
      name: "Excluir definitivamente",
    });
    expect(confirm).toBeDisabled();
    await user.type(
      screen.getByLabelText("Digite EXCLUIR para confirmar"),
      "EXCLU"
    );
    expect(screen.getByText("A frase não confere.")).toBeVisible();
    expect(confirm).toBeDisabled();
    await user.type(
      screen.getByLabelText("Digite EXCLUIR para confirmar"),
      "IR"
    );
    expect(confirm).toBeEnabled();
  });

  it("a frase é a do idioma: DELETE em en-US", async () => {
    overwriteGetLocale(() => "en-US");
    const user = userEvent.setup();
    mocks.deletionSummary.mockResolvedValue({ data: SUMMARY, error: null });
    renderSettings("data");
    await user.click(screen.getByRole("button", { name: "Delete" }));
    const field = await screen.findByLabelText("Type DELETE to confirm");
    await user.type(field, "EXCLUIR");
    expect(
      screen.getByRole("button", { name: "Delete permanently" })
    ).toBeDisabled();
    await user.clear(field);
    await user.type(field, "DELETE");
    expect(
      screen.getByRole("button", { name: "Delete permanently" })
    ).toBeEnabled();
  });

  it("confirmar apaga a conta e sai para o login", async () => {
    mocks.deleteMe.mockResolvedValue({ data: { ok: true }, error: null });
    const user = userEvent.setup();
    await openDialog(user);
    await user.type(
      screen.getByLabelText("Digite EXCLUIR para confirmar"),
      "EXCLUIR"
    );
    await user.click(
      screen.getByRole("button", { name: "Excluir definitivamente" })
    );
    await waitFor(() => expect(mocks.deleteMe).toHaveBeenCalledTimes(1));
    await waitFor(() => expect(mocks.signOut).toHaveBeenCalledTimes(1));
  });
});
