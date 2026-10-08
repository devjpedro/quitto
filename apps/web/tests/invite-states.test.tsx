import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const accept = vi.fn();
const decline = vi.fn();
const resend = vi.fn();
vi.mock("@/features/invites/api", () => ({
  useAcceptInvite: () => ({ mutate: accept, isPending: false }),
  useDeclineInvite: () => ({ mutate: decline, isPending: false }),
  useResendInvite: () => ({ mutate: resend, isPending: false }),
}));
vi.mock("@tanstack/react-router", () => ({
  Link: ({ children, to }: { children: React.ReactNode; to: string }) => (
    <a href={to}>{children}</a>
  ),
  useCanGoBack: () => false,
  useNavigate: () => vi.fn(),
  useRouter: () => ({ history: { back: vi.fn() } }),
}));
vi.mock("@/hooks/use-identity", () => ({
  useIdentity: () => ({
    id: "u-renata",
    name: "Renata Campos",
    email: "renata.campos@exemplo.com",
    image: null,
  }),
}));
vi.mock("@/lib/auth-client", () => ({ signOut: vi.fn() }));

import { InviteFrame } from "@/features/invites/components/invite-frame";
import { viewScreen } from "@/features/invites/lib/invite-screen";
import { FLORIPA, INVITE_NOW } from "./invite-fixtures";
import { renderWithProviders } from "./test-utils";

const WA_ME = /^https:[/][/]wa[.]me[/][?]text=/;

const frame = (view: typeof FLORIPA) =>
  renderWithProviders(<InviteFrame screen={viewScreen(view)} token="tok" />);

beforeEach(() => {
  vi.useFakeTimers({ now: INVITE_NOW, toFake: ["Date"] });
});
afterEach(() => {
  vi.useRealTimers();
});

describe("o convite com sessão", () => {
  it("decidir: quem convidou com rosto, o papel, as condições e o que acontece ao aceitar", () => {
    const { container } = frame(FLORIPA);
    expect(container).toHaveTextContent("Bia Lopes te convidou");
    expect(
      screen.getByRole("heading", {
        level: 1,
        name: "Viagem para Floripa (dividida)",
      })
    ).toBeVisible();
    expect(container).toHaveTextContent("Você entra como quem paga.");
    expect(container).toHaveTextContent(
      "4 parcelas de R$ 300,00 · a partir de 10/11"
    );
    expect(container).toHaveTextContent("As 4 parcelas entram no seu Agora");
    expect(container).toHaveTextContent(
      "Bia vê na hora; este contrato não pede confirmação"
    );
    expect(container).toHaveTextContent(
      "Enviado para joao.souza@exemplo.com · vale até domingo, 11/10."
    );
    // ajuste-15 §5.2: no "fica do lado de quem recebe", and the stage has no subtitle.
    expect(container).not.toHaveTextContent("fica do lado");
    // The invite does not know the payments: no progress on its cards (planner's decision 46).
    expect(container).not.toHaveTextContent("0 de 4");
    expect(container).not.toHaveTextContent("É assim que ele vai aparecer");
  });

  it("aceitar chama a mutação; recusar pede confirmação, com o foco no Voltar", async () => {
    const user = userEvent.setup();
    frame(FLORIPA);
    await user.click(screen.getByRole("button", { name: "Aceitar convite" }));
    expect(accept).toHaveBeenCalledTimes(1);
    await user.click(screen.getByRole("button", { name: "Recusar" }));
    expect(
      screen.getByRole("dialog", { name: "Recusar o convite?" })
    ).toBeVisible();
    expect(screen.getByRole("button", { name: "Voltar" })).toHaveFocus();
    await user.click(screen.getByRole("button", { name: "Recusar convite" }));
    expect(decline).toHaveBeenCalledTimes(1);
  });

  it("já aceito: quando, e Abrir o contrato", () => {
    frame({
      ...FLORIPA,
      status: "accepted",
      acceptedAt: "2026-10-05T17:32:00.000Z",
    });
    expect(
      screen.getByRole("heading", { name: "Você já aceitou este convite" })
    ).toBeVisible();
    expect(
      screen.getByText("Em 05/10, às 14:32. O contrato já está na sua lista.")
    ).toBeVisible();
    expect(
      screen.getByRole("link", { name: "Abrir o contrato" })
    ).toBeVisible();
    expect(
      screen.queryByRole("button", { name: "Aceitar convite" })
    ).toBeNull();
  });

  it("expirado: até quando valia e Pedir no WhatsApp (wa.me sem número)", () => {
    const { container } = frame({ ...FLORIPA, status: "expired" });
    expect(
      screen.getByRole("heading", { name: "Este convite expirou" })
    ).toBeVisible();
    expect(container).toHaveTextContent(
      "Ele valia até domingo, 11/10. Peça para Bia mandar de novo"
    );
    expect(
      screen
        .getByRole("link", { name: "Pedir no WhatsApp" })
        .getAttribute("href")
    ).toMatch(WA_ME);
  });

  it("recusado: quando, e que dá para pedir de novo", () => {
    const { container } = frame({
      ...FLORIPA,
      status: "declined",
      declinedAt: "2026-10-05T12:00:00.000Z",
    });
    expect(
      screen.getByRole("heading", { name: "Você recusou este convite" })
    ).toBeVisible();
    expect(container).toHaveTextContent(
      "Mudou de ideia? Peça para Bia mandar um novo convite."
    );
  });

  it("outra conta: o e-mail mascarado e Trocar de conta", () => {
    const { container } = frame({
      ...FLORIPA,
      viewer: "otherAccount",
      email: null,
    });
    expect(container).toHaveTextContent(
      "Ele foi enviado para j•••@exemplo.com, e você entrou como renata.campos@exemplo.com."
    );
    expect(container).not.toHaveTextContent("joao.souza@exemplo.com");
    expect(
      screen.getByRole("button", { name: "Trocar de conta" })
    ).toBeVisible();
  });

  it("outra conta, convite expirado: sem palco, sem 'passo 2', com o mini-cartão", () => {
    const { container } = frame({
      ...FLORIPA,
      status: "expired",
      viewer: "otherAccount",
      email: null,
      terms: null,
      schedulePreview: [],
    });
    expect(container).not.toHaveTextContent("passo 2");
    expect(container).not.toHaveTextContent("As parcelas aparecem aqui");
    expect(screen.getByTestId("invite-mini")).not.toHaveClass("stage:hidden");
  });

  it("o dono: o status, Copiar link e Reenviar e-mail", async () => {
    const user = userEvent.setup();
    const { container } = frame({
      ...FLORIPA,
      viewer: "owner",
      inviteeName: "João Souza",
    });
    expect(
      screen.getByRole("heading", { name: "Este é o convite que você mandou" })
    ).toBeVisible();
    expect(container).toHaveTextContent("Ele espera a resposta de João.");
    expect(container).toHaveTextContent("Aguardando");
    // No stage for the owner: never "Você paga … para Bia Lopes" with the owner's own name.
    expect(screen.queryByTestId("wizard-stage")).toBeNull();
    expect(container).not.toHaveTextContent("para Bia Lopes");
    await user.click(screen.getByRole("button", { name: "Reenviar e-mail" }));
    expect(resend).toHaveBeenCalledTimes(1);
    expect(screen.getByRole("button", { name: "Copiar link" })).toBeVisible();
  });
});
