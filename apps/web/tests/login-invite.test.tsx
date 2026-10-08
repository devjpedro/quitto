import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

const { signUpEmail } = vi.hoisted(() => ({
  signUpEmail: vi.fn(async () => ({ error: null })),
}));
vi.mock("@tanstack/react-router", () => ({
  // After hydration: the invite on top shows (useInvitePreview, planner's decision 37).
  useHydrated: () => true,
  useSearch: () => ({ redirect: "/invites/tok", mode: "signup" }),
}));
vi.mock("@/lib/auth-client", () => ({
  signIn: { email: vi.fn(), social: vi.fn() },
  signUp: { email: signUpEmail },
  sendVerificationEmail: vi.fn(),
}));

import { LoginPage } from "@/features/auth/login-page";
import {
  invitePreviewQueryOptions,
  type PreviewLookup,
} from "@/features/invites/api";
import { FLORIPA_PUBLIC } from "./invite-fixtures";
import { makeTestQueryClient, renderWithProviders } from "./test-utils";

function login() {
  const client = makeTestQueryClient();
  client.setQueryDefaults(["invite"], { staleTime: Number.POSITIVE_INFINITY });
  const seeded: PreviewLookup = { kind: "preview", preview: FLORIPA_PUBLIC };
  client.setQueryData(invitePreviewQueryOptions("tok").queryKey, seeded);
  return renderWithProviders(<LoginPage />, { client });
}

describe("o login com o contexto do convite (mockup 15, H2)", () => {
  it("o convite no topo, o título que diz para quê e a dica do e-mail mascarado", () => {
    const { container } = login();
    expect(container).toHaveTextContent("Convite de Bia Lopes");
    expect(container).toHaveTextContent("Viagem para Floripa (dividida)");
    expect(
      screen.getByRole("heading", {
        level: 1,
        name: "Crie sua conta para responder",
      })
    ).toBeVisible();
    expect(screen.getByLabelText("E-mail")).toHaveAccessibleDescription(
      "O convite foi enviado para j•••@exemplo.com."
    );
    // mode=signup opens the sign-up form.
    expect(screen.getByLabelText("Nome")).toBeVisible();
  });

  it("criar a conta volta para o convite (o link de verificação também)", async () => {
    const user = userEvent.setup();
    login();
    await user.type(screen.getByLabelText("Nome"), "João Souza");
    await user.type(screen.getByLabelText("E-mail"), "joao.souza@exemplo.com");
    await user.type(screen.getByLabelText("Senha"), "password123");
    await user.click(
      screen.getByRole("button", { name: "Criar conta e ver o convite" })
    );
    expect(signUpEmail).toHaveBeenCalledWith(
      expect.objectContaining({
        callbackURL: "/invites/tok",
        email: "joao.souza@exemplo.com",
      })
    );
  });
});
