import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  hydrated: true,
  search: {} as { mode?: "signup"; redirect?: string },
  signInEmail: vi.fn(),
  signUpEmail: vi.fn(),
  resend: vi.fn(),
}));
vi.mock("@tanstack/react-router", async () => ({
  Link: (await import("./router-link-stub")).LinkStub,
  useHydrated: () => mocks.hydrated,
  useSearch: () => mocks.search,
}));
vi.mock("@/lib/auth-client", () => ({
  signIn: { email: mocks.signInEmail, social: vi.fn() },
  signUp: { email: mocks.signUpEmail },
  sendVerificationEmail: mocks.resend,
}));

import { LoginPage } from "@/features/auth/components/login-page";
import { overwriteGetLocale } from "@/paraglide/runtime.js";
import { renderWithProviders } from "./test-utils";

const SIGNIN_SUBMIT = /^Entrar$/;
const SIGNUP_SUBMIT = /^Criar conta$/;
const VERIFY_URL = "/verify-email?redirect=%2Fcontracts";

afterEach(() => {
  mocks.search = {};
  mocks.hydrated = true;
  vi.clearAllMocks();
  overwriteGetLocale(() => "pt-BR");
});

function typeSignin(user: ReturnType<typeof userEvent.setup>) {
  return async () => {
    await user.type(screen.getByLabelText("E-mail"), "joao@exemplo.com");
    await user.type(screen.getByLabelText("Senha"), "password123");
  };
}

describe("a tela de entrar e criar conta", () => {
  it("antes de hidratar o botão fica desabilitado e o form é POST (um envio nativo perderia o ?redirect)", () => {
    mocks.hydrated = false;
    mocks.search = { mode: "signup", redirect: "/invites/tok" };
    renderWithProviders(<LoginPage />);
    expect(screen.getByRole("button", { name: SIGNUP_SUBMIT })).toBeDisabled();
    expect(
      screen.getByRole("button", { name: SIGNUP_SUBMIT }).closest("form")
    ).toHaveAttribute("method", "post");
  });

  it("o modo vem da URL: ?mode=signup mostra o Nome e Criar conta", () => {
    mocks.search = { mode: "signup" };
    renderWithProviders(<LoginPage />);
    expect(screen.getByLabelText("Nome")).toBeVisible();
    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent(
      "Crie sua conta"
    );
    expect(screen.getByRole("button", { name: SIGNUP_SUBMIT })).toBeVisible();
  });

  it("o link Criar conta leva ao ?mode=signup mantendo o redirect", () => {
    mocks.search = { redirect: "/contracts" };
    renderWithProviders(<LoginPage />);
    const link = screen.getByRole("link", { name: "Criar conta" });
    expect(link).toHaveAttribute(
      "href",
      "/login?redirect=%2Fcontracts&mode=signup"
    );
  });

  it("entrar com sucesso vai para o alvo", async () => {
    mocks.search = { redirect: "/contracts" };
    mocks.signInEmail.mockResolvedValue({ error: null });
    const user = userEvent.setup();
    renderWithProviders(<LoginPage />);
    await typeSignin(user)();
    await user.click(screen.getByRole("button", { name: SIGNIN_SUBMIT }));
    await waitFor(() =>
      expect(mocks.signInEmail).toHaveBeenCalledWith({
        email: "joao@exemplo.com",
        password: "password123",
        callbackURL: "/contracts",
      })
    );
  });

  it("redirect de outra origem cai em /", async () => {
    mocks.search = { redirect: "https://evil.example/steal" };
    mocks.signInEmail.mockResolvedValue({ error: null });
    const user = userEvent.setup();
    renderWithProviders(<LoginPage />);
    await typeSignin(user)();
    await user.click(screen.getByRole("button", { name: SIGNIN_SUBMIT }));
    await waitFor(() =>
      expect(mocks.signInEmail).toHaveBeenCalledWith(
        expect.objectContaining({ callbackURL: "/" })
      )
    );
  });

  it("criar conta sem sessão (token null): Confira seu e-mail com o e-mail, sem navegar", async () => {
    mocks.search = { mode: "signup" };
    mocks.signUpEmail.mockResolvedValue({ data: { token: null }, error: null });
    const user = userEvent.setup();
    renderWithProviders(<LoginPage />);
    await user.type(screen.getByLabelText("Nome"), "João Souza");
    await typeSignin(user)();
    await user.click(screen.getByRole("button", { name: SIGNUP_SUBMIT }));
    const check = await screen.findByTestId("check-email");
    expect(check).toHaveTextContent("Confira seu e-mail");
    expect(check).toHaveTextContent("joao@exemplo.com");
    expect(screen.queryByLabelText("Senha")).toBeNull();
  });

  it("criar conta manda o callbackURL /verify-email?redirect=<alvo>", async () => {
    mocks.search = { mode: "signup", redirect: "/contracts" };
    mocks.signUpEmail.mockResolvedValue({ data: { token: null }, error: null });
    const user = userEvent.setup();
    renderWithProviders(<LoginPage />);
    await user.type(screen.getByLabelText("Nome"), "João Souza");
    await typeSignin(user)();
    await user.click(screen.getByRole("button", { name: SIGNUP_SUBMIT }));
    await waitFor(() =>
      expect(mocks.signUpEmail).toHaveBeenCalledWith(
        expect.objectContaining({ callbackURL: VERIFY_URL })
      )
    );
  });

  it("entrar com e-mail não confirmado: Confira seu e-mail e nenhum reenvio automático", async () => {
    mocks.signInEmail.mockResolvedValue({
      error: { code: "EMAIL_NOT_VERIFIED", message: "Email not verified" },
    });
    const user = userEvent.setup();
    renderWithProviders(<LoginPage />);
    await typeSignin(user)();
    await user.click(screen.getByRole("button", { name: SIGNIN_SUBMIT }));
    expect(await screen.findByTestId("check-email")).toHaveTextContent(
      "Falta confirmar joao@exemplo.com"
    );
    expect(mocks.resend).not.toHaveBeenCalled();
  });

  it("Reenviar o link chama sendVerificationEmail com o mesmo callbackURL e mostra Link reenviado.", async () => {
    mocks.search = { redirect: "/contracts" };
    mocks.signInEmail.mockResolvedValue({
      error: { code: "EMAIL_NOT_VERIFIED" },
    });
    mocks.resend.mockResolvedValue({ error: null });
    const user = userEvent.setup();
    renderWithProviders(<LoginPage />);
    await typeSignin(user)();
    await user.click(screen.getByRole("button", { name: SIGNIN_SUBMIT }));
    await user.click(
      await screen.findByRole("button", { name: "Reenviar o link" })
    );
    expect(mocks.resend).toHaveBeenCalledWith({
      email: "joao@exemplo.com",
      callbackURL: VERIFY_URL,
    });
    expect(await screen.findByRole("status")).toHaveTextContent(
      "Link reenviado."
    );
  });

  it("Usar outro e-mail volta ao formulário com o e-mail e o foco nele", async () => {
    mocks.signInEmail.mockResolvedValue({
      error: { code: "EMAIL_NOT_VERIFIED" },
    });
    const user = userEvent.setup();
    renderWithProviders(<LoginPage />);
    await typeSignin(user)();
    await user.click(screen.getByRole("button", { name: SIGNIN_SUBMIT }));
    await user.click(
      await screen.findByRole("button", { name: "Usar outro e-mail" })
    );
    const email = screen.getByLabelText("E-mail");
    expect(email).toHaveValue("joao@exemplo.com");
    expect(email).toHaveFocus();
    expect(screen.getByLabelText("Senha")).toHaveValue("");
  });

  it("erro de credenciais: a frase no alert, ligada aos dois campos (aria-describedby e aria-invalid)", async () => {
    mocks.signInEmail.mockResolvedValue({
      error: { code: "INVALID_EMAIL_OR_PASSWORD" },
    });
    const user = userEvent.setup();
    renderWithProviders(<LoginPage />);
    await typeSignin(user)();
    await user.click(screen.getByRole("button", { name: SIGNIN_SUBMIT }));
    const alert = await screen.findByRole("alert");
    expect(alert).toHaveTextContent("E-mail ou senha incorretos.");
    for (const field of [
      screen.getByLabelText("E-mail"),
      screen.getByLabelText("Senha"),
    ]) {
      expect(field).toHaveAttribute("aria-invalid", "true");
      expect(field).toHaveAttribute("aria-describedby", "auth-error");
      // The 2 px danger ring of every field in error (field.tsx), not only the sentence.
      expect(field.className).toContain("ring-danger");
    }
    expect(alert.querySelector("svg")).not.toBeNull();
  });

  it("em en-US, os textos em inglês", () => {
    overwriteGetLocale(() => "en-US");
    renderWithProviders(<LoginPage />);
    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent(
      "Sign in to your account"
    );
    expect(screen.getByLabelText("Password")).toBeVisible();
    expect(screen.getByRole("link", { name: "Forgot password" })).toBeVisible();
    expect(screen.getByRole("link", { name: "Create account" })).toBeVisible();
  });
});
