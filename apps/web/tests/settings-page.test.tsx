import { screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  patchMe: vi.fn(),
  deletionSummary: vi.fn(),
}));
vi.mock("@tanstack/react-router", async () => ({
  Link: (await import("./router-link-stub")).LinkStub,
  useHydrated: () => true,
}));
vi.mock("@/lib/api", () => ({
  api: {
    api: {
      me: {
        patch: mocks.patchMe,
        "deletion-summary": { get: mocks.deletionSummary },
      },
    },
  },
}));
vi.mock("@/lib/auth-client", () => ({
  changePassword: vi.fn(),
  signOut: vi.fn(),
}));

import { overwriteGetLocale } from "@/paraglide/runtime.js";
import { renderSettings } from "./settings-fixtures";

const PROFILE = /Perfil/;
const PIX = /Recebimento \(PIX\)/;
const REMINDERS = /Lembretes/;
const SECURITY = /Segurança/;
const DATA = /Seus dados/;
const EMAIL = /agora@demo\.quitto\.dev/;
const ENGLISH = /English \(US\)/;
const PORTUGUESE = /Português \(Brasil\)/;
const BRL_PT = /R\$ 1\.250,00/;
const BRL_EN = /R\$1,250\.00/;

afterEach(() => {
  overwriteGetLocale(() => "pt-BR");
  vi.clearAllMocks();
});

describe("Ajustes", () => {
  it("as cinco seções, na ordem, sob o título Ajustes", () => {
    renderSettings("profile");
    expect(
      screen.getByRole("heading", { level: 1, name: "Ajustes" })
    ).toBeInTheDocument();
    const names = screen
      .getAllByRole("link")
      .map((link) => link.textContent ?? "");
    expect(names[0]).toMatch(PROFILE);
    expect(names[1]).toMatch(PIX);
    expect(names[2]).toMatch(REMINDERS);
    expect(names[3]).toMatch(SECURITY);
    expect(names[4]).toMatch(DATA);
    expect(screen.getByRole("link", { name: PROFILE })).toHaveAttribute(
      "aria-current",
      "page"
    );
  });

  it("Lembretes some sem a chave global", () => {
    renderSettings("profile", { emailRemindersAvailable: false });
    expect(screen.queryByRole("link", { name: REMINDERS })).toBeNull();
  });

  it("sem senha (Google): a frase e nenhum campo de senha", () => {
    renderSettings("security", { hasPassword: false });
    expect(screen.getByText("Você entra com o Google")).toBeVisible();
    expect(screen.getByText("Sem senha no Quitto.")).toBeVisible();
    expect(screen.queryByRole("button", { name: "Trocar a senha" })).toBeNull();
  });

  it("o Perfil mostra nome, e-mail e o idioma da conta marcado", () => {
    renderSettings("profile", { locale: "en-US" });
    expect(screen.getByText("João Souza")).toBeVisible();
    expect(screen.getByText(EMAIL)).toBeVisible();
    expect(screen.getByRole("radio", { name: ENGLISH })).toBeChecked();
    expect(screen.getByRole("radio", { name: PORTUGUESE })).not.toBeChecked();
  });

  it("sem idioma na conta, o do navegador vem marcado", () => {
    renderSettings("profile", { locale: null });
    expect(screen.getByRole("radio", { name: PORTUGUESE })).toBeChecked();
  });

  it("chegar em /settings/pix sem chave: o foco no campo da chave", () => {
    renderSettings("pix");
    expect(screen.getByLabelText("Sua chave PIX")).toHaveFocus();
  });

  it("o idioma mostra a data e o dinheiro naquele idioma", () => {
    renderSettings("profile");
    expect(screen.getByText(BRL_PT)).toBeVisible();
    expect(screen.getByText(BRL_EN)).toBeVisible();
  });
});
