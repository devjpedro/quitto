import { screen } from "@testing-library/react";
import { Suspense } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@tanstack/react-router", () => ({
  Link: ({
    children,
    search,
    to,
  }: {
    children: React.ReactNode;
    search?: Record<string, string>;
    to: string;
  }) => (
    <a href={`${to}?${new URLSearchParams(search).toString()}`}>{children}</a>
  ),
}));

import {
  invitePreviewQueryOptions,
  type PreviewLookup,
} from "@/features/invites/api";
import { InviteGuest } from "@/features/invites/components/invite-guest";
import { FLORIPA_PUBLIC, INVITE_NOW } from "./invite-fixtures";
import { makeTestQueryClient, renderWithProviders } from "./test-utils";

const WA_ME = /^https:[/][/]wa[.]me[/][?]text=/;

function guest(preview: typeof FLORIPA_PUBLIC | PreviewLookup) {
  const client = makeTestQueryClient();
  client.setQueryDefaults(["invite"], { staleTime: Number.POSITIVE_INFINITY });
  const seeded: PreviewLookup =
    "kind" in preview ? preview : { kind: "preview", preview };
  client.setQueryData(invitePreviewQueryOptions("tok").queryKey, seeded);
  return renderWithProviders(
    <Suspense fallback={null}>
      <InviteGuest token="tok" />
    </Suspense>,
    { client }
  );
}

beforeEach(() => {
  vi.useFakeTimers({ now: INVITE_NOW, toFake: ["Date"] });
});
afterEach(() => {
  vi.useRealTimers();
});

describe("o convite sem login (mockup 15, H1)", () => {
  it("quem convidou, o nome, as condições e o papel; nada das outras partes", () => {
    const { container } = guest(FLORIPA_PUBLIC);
    expect(container).toHaveTextContent(
      "Bia Lopes te convidou para um contrato no Quitto"
    );
    expect(
      screen.getByRole("heading", {
        level: 1,
        name: "Viagem para Floripa (dividida)",
      })
    ).toBeVisible();
    expect(container).toHaveTextContent(
      "4 parcelas de R$ 300,00 · a partir de 10/11"
    );
    expect(container).toHaveTextContent("Você entra como quem paga.");
    expect(container).toHaveTextContent("crie sua conta com j•••@exemplo.com");
    expect(
      screen.getByRole("heading", { level: 2, name: "Como o Quitto funciona" })
    ).toBeVisible();
    // No ✕ for someone who is not in the app yet (H1).
    expect(screen.queryByRole("button", { name: "Fechar" })).toBeNull();
  });

  it("Criar conta e Entrar levam ao login com a volta para o convite", () => {
    guest(FLORIPA_PUBLIC);
    const signup =
      screen.getByRole("link", { name: "Criar conta" }).getAttribute("href") ??
      "";
    expect(signup).toContain("redirect=%2Finvites%2Ftok");
    expect(signup).toContain("mode=signup");
    const signin =
      screen.getByRole("link", { name: "Entrar" }).getAttribute("href") ?? "";
    expect(signin).toContain("redirect=%2Finvites%2Ftok");
    expect(signin).not.toContain("mode=");
  });

  it("expirado: até quando valia e Pedir no WhatsApp", () => {
    guest({ ...FLORIPA_PUBLIC, status: "expired" });
    expect(
      screen.getByRole("heading", { name: "Este convite expirou" })
    ).toBeVisible();
    expect(
      screen
        .getByRole("link", { name: "Pedir no WhatsApp" })
        .getAttribute("href")
    ).toMatch(WA_ME);
    expect(screen.queryByRole("link", { name: "Criar conta" })).toBeNull();
  });

  it("já respondido: entrar com a conta do convite para ver o contrato", () => {
    const { container } = guest({ ...FLORIPA_PUBLIC, status: "accepted" });
    expect(
      screen.getByRole("heading", { name: "Este convite já foi respondido" })
    ).toBeVisible();
    expect(container).toHaveTextContent(
      "Entre com a conta de j•••@exemplo.com para ver o contrato."
    );
    expect(screen.getByRole("link", { name: "Entrar" })).toBeVisible();
  });

  it("429 da prévia: a frase para esperar, sem quebrar a tela", () => {
    const { container } = guest({ kind: "rateLimited" });
    expect(
      screen.getByRole("heading", { name: "Muitos acessos agora" })
    ).toBeVisible();
    expect(container).toHaveTextContent("Tente de novo daqui a um minuto.");
  });
});
