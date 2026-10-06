import { QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { CONTRACT_SLOTS } from "@/features/contracts/components/contract-slots";
import { PeopleTab } from "@/features/contracts/components/people-tab";
import type { ContractRoute } from "@/features/contracts/hooks/use-contract-route";
import type { ContractDetail } from "@/features/contracts/types";
import { makeQueryClient } from "@/lib/query";
import { motoDetail } from "./contract-fixtures";

const { addPerson, invite, remove, resend, toast } = vi.hoisted(() => ({
  addPerson: vi.fn(),
  invite: vi.fn(),
  remove: vi.fn(),
  resend: vi.fn(),
  toast: { success: vi.fn(), error: vi.fn() },
}));

vi.mock("sonner", () => ({ toast }));

vi.mock("@/lib/api", () => ({
  api: {
    api: {
      contracts: () => ({
        participants: Object.assign(
          ({ participantId }: { participantId: string }) => ({
            delete: () => remove(participantId),
            invite: {
              post: (body: unknown) => invite(participantId, body),
              resend: { post: () => resend(participantId) },
            },
          }),
          { post: (body: unknown) => addPerson(body) }
        ),
      }),
    },
  },
}));

const ok = (data: unknown) => Promise.resolve({ data, error: null });
const MARINA = {
  id: "p-m",
  displayName: "Marina Pires",
  role: "buyer",
  linked: false,
  isOwner: false,
  isMe: false,
  email: null,
  invite: null,
  joinedAt: null,
};
const ROW_ACTIONS = /^Ações de/;
const RESEND = { name: "Reenviar convite" };
const COPY_LINK = { name: "Copiar link do convite" };
const EMAIL_FIELD = /^E-mail$/;
const EMAIL_OPTIONAL = /E-mail \(opcional\)/;
const NOTE_WORDS = /Quem acompanha|Entradas e saídas/;
const INVALID_EMAIL = "Confira o e-mail.";

function renderPeople(detail: ContractDetail) {
  return render(
    <QueryClientProvider client={makeQueryClient()}>
      <PeopleTab detail={detail} />
    </QueryClientProvider>
  );
}

beforeEach(() => {
  for (const fn of [addPerson, invite, remove, resend]) {
    fn.mockReset();
    fn.mockImplementation(() => ok({ id: "p-new" }));
  }
  toast.success.mockReset();
  Object.assign(navigator, {
    clipboard: { writeText: vi.fn().mockResolvedValue(undefined) },
  });
});

describe("PeopleTab (mockup 14, Pessoas)", () => {
  it("a lista: um bloco, uma linha por pessoa com a tag do papel, sem notas explicativas", () => {
    renderPeople(motoDetail());
    const list = screen.getByTestId("people-list");
    const rows = within(list).getAllByRole("listitem");
    expect(rows).toHaveLength(3);
    expect(within(rows[0] as HTMLElement).getByText("Você")).toBeVisible();
    expect(within(rows[0] as HTMLElement).getByText("Recebe")).toBeVisible();
    expect(within(rows[1] as HTMLElement).getByText("Paga")).toBeVisible();
    expect(
      within(rows[2] as HTMLElement).getByText("Convite pendente")
    ).toBeVisible();
    expect(screen.queryByText(NOTE_WORDS)).toBeNull();
  });

  it("convite pendente: Reenviar chama o reenvio; Copiar link copia a URL e mostra 'Link copiado'", async () => {
    renderPeople(motoDetail());
    await userEvent.click(screen.getByRole("button", RESEND));
    await waitFor(() => expect(resend).toHaveBeenCalledWith("p-silvia"));
    await userEvent.click(screen.getByRole("button", COPY_LINK));
    await waitFor(() =>
      expect(navigator.clipboard.writeText).toHaveBeenCalledWith(
        "http://localhost:3001/invites/t-silvia"
      )
    );
    expect(toast.success).toHaveBeenCalledWith("Link copiado");
  });

  it("o dono remove pelo ⋯ da linha, com a confirmação focada no Cancelar", async () => {
    renderPeople(motoDetail());
    await userEvent.click(
      screen.getByRole("button", { name: "Ações de Rafael Prado" })
    );
    await userEvent.click(
      await screen.findByRole("menuitem", { name: "Remover do contrato" })
    );
    const dialog = await screen.findByRole("dialog", {
      name: "Remover Rafael Prado?",
    });
    expect(
      within(dialog).getByRole("button", { name: "Cancelar" })
    ).toHaveFocus();
    await userEvent.click(
      within(dialog).getByRole("button", { name: "Remover" })
    );
    await waitFor(() => expect(remove).toHaveBeenCalledWith("p-rafa"));
  });

  it("só o nome: o convite tracejado; e-mail inválido não chama a API, válido manda o convite", async () => {
    const detail = motoDetail({
      participants: [...motoDetail().participants.slice(0, 1), MARINA as never],
    });
    renderPeople(detail);
    const card = screen.getByTestId("invite-card");
    expect(
      within(card).getByText("Chame Marina para o contrato")
    ).toBeVisible();
    await userEvent.type(
      within(card).getByLabelText(EMAIL_FIELD),
      "marina-sem-arroba"
    );
    await userEvent.click(
      within(card).getByRole("button", { name: "Enviar convite" })
    );
    expect(within(card).getByText(INVALID_EMAIL)).toBeVisible();
    expect(invite).not.toHaveBeenCalled();
    await userEvent.clear(within(card).getByLabelText(EMAIL_FIELD));
    await userEvent.type(
      within(card).getByLabelText(EMAIL_FIELD),
      "marina@exemplo.com"
    );
    await userEvent.click(
      within(card).getByRole("button", { name: "Enviar convite" })
    );
    await waitFor(() =>
      expect(invite).toHaveBeenCalledWith("p-m", {
        email: "marina@exemplo.com",
      })
    );
  });

  it("Convidar pessoa sem e-mail cria só o nome; com e-mail, cria e convida", async () => {
    const detail = motoDetail();
    const route = { tab: "people" } as unknown as ContractRoute;
    render(
      <QueryClientProvider client={makeQueryClient()}>
        {CONTRACT_SLOTS.tabAction(detail, route)}
      </QueryClientProvider>
    );
    await userEvent.click(
      screen.getByRole("button", { name: "Convidar pessoa" })
    );
    const dialog = await screen.findByRole("dialog", {
      name: "Convidar pessoa",
    });
    await userEvent.type(within(dialog).getByLabelText("Nome"), "Marcos Prado");
    await userEvent.click(
      within(dialog).getByRole("button", { name: "Convidar pessoa" })
    );
    await waitFor(() =>
      expect(addPerson).toHaveBeenCalledWith({
        displayName: "Marcos Prado",
        role: "viewer",
      })
    );
    expect(invite).not.toHaveBeenCalled();
    await waitFor(() =>
      expect(toast.success).toHaveBeenCalledWith("Pessoa adicionada")
    );

    await userEvent.click(
      screen.getByRole("button", { name: "Convidar pessoa" })
    );
    const again = await screen.findByRole("dialog", {
      name: "Convidar pessoa",
    });
    await userEvent.type(within(again).getByLabelText("Nome"), "Ana Lima");
    await userEvent.type(
      within(again).getByLabelText(EMAIL_OPTIONAL),
      "ana@exemplo.com"
    );
    await userEvent.click(
      within(again).getByRole("button", { name: "Convidar pessoa" })
    );
    await waitFor(() =>
      expect(invite).toHaveBeenCalledWith("p-new", { email: "ana@exemplo.com" })
    );
    await waitFor(() =>
      expect(toast.success).toHaveBeenCalledWith("Convite enviado")
    );
  });

  it("quem não é dono não vê Reenviar, Copiar, ⋯, o convite tracejado nem a ação da aba", () => {
    const silvia = {
      ...motoDetail().participants[2],
      email: null,
      invite: {
        status: "pending",
        sentAt: "2026-10-01T12:00:00.000Z",
        url: null,
      },
    };
    const detail = motoDetail({
      isOwner: false,
      role: "buyer",
      participants: [
        ...motoDetail().participants.slice(0, 2),
        silvia as never,
        MARINA as never,
      ],
    });
    renderPeople(detail);
    expect(screen.queryByRole("button", RESEND)).toBeNull();
    expect(screen.queryByRole("button", COPY_LINK)).toBeNull();
    expect(screen.queryByRole("button", { name: ROW_ACTIONS })).toBeNull();
    expect(screen.queryByTestId("invite-card")).toBeNull();
    expect(
      CONTRACT_SLOTS.tabAction(detail, {
        tab: "people",
      } as unknown as ContractRoute)
    ).toBeNull();
  });
});
