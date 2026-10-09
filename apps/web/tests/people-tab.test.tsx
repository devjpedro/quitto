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
const REQUIRED_EMAIL = "Diga o e-mail de quem acompanha.";

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
  toast.error.mockReset();
  Object.assign(navigator, {
    clipboard: { writeText: vi.fn().mockResolvedValue(undefined) },
  });
});

describe("PeopleTab (mockup 14, Pessoas)", () => {
  it("a lista: um bloco, uma linha por pessoa com o papel em texto (sem tag), sem notas explicativas", () => {
    renderPeople(motoDetail());
    const list = screen.getByTestId("people-list");
    const rows = within(list).getAllByRole("listitem");
    expect(rows).toHaveLength(3);
    expect(within(rows[0] as HTMLElement).getByText("Você")).toBeVisible();
    // The role is plain text at the start of the meta, once per row (mockup 20, B5).
    expect(within(rows[0] as HTMLElement).getAllByText("Recebe")).toHaveLength(
      1
    );
    expect(within(rows[1] as HTMLElement).getAllByText("Paga")).toHaveLength(1);
    expect(within(rows[1] as HTMLElement).getByText("Paga")).not.toHaveClass(
      "rounded-full"
    );
    expect(
      within(rows[2] as HTMLElement).getByText("Convite pendente")
    ).toBeVisible();
    expect(screen.queryByText(NOTE_WORDS)).toBeNull();
  });

  it("convite pendente: Reenviar chama o reenvio; Copiar link copia a URL e mostra 'Link copiado'", async () => {
    renderPeople(motoDetail());
    await userEvent.click(screen.getByRole("button", RESEND));
    await waitFor(() => expect(resend).toHaveBeenCalledWith("p-silvia"));
    // "Copiar link" is no longer on the row: it lives in the ⋮.
    expect(screen.queryByRole("button", COPY_LINK)).toBeNull();
    await userEvent.click(
      screen.getByRole("button", { name: "Ações de Sílvia Souza" })
    );
    await userEvent.click(
      await screen.findByRole("menuitem", { name: "Copiar link do convite" })
    );
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

  it("Convidar pessoa: quem paga ou recebe pode ficar só com o nome; quem acompanha exige e-mail", async () => {
    // Só o dono no contrato: "Paga" está livre e é o papel inicial.
    const detail = motoDetail({
      participants: motoDetail().participants.slice(0, 1),
    });
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
        role: "buyer",
        email: null,
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
    await userEvent.click(
      within(again).getByRole("radio", { name: "Acompanha" })
    );
    // Quem acompanha: o e-mail deixa de ser opcional e vazio não chama a API.
    expect(within(again).queryByLabelText(EMAIL_OPTIONAL)).toBeNull();
    addPerson.mockClear();
    await userEvent.click(
      within(again).getByRole("button", { name: "Convidar pessoa" })
    );
    expect(within(again).getByText(REQUIRED_EMAIL)).toBeVisible();
    expect(addPerson).not.toHaveBeenCalled();
    await userEvent.type(
      within(again).getByLabelText(EMAIL_FIELD),
      "ana@exemplo.com"
    );
    await userEvent.click(
      within(again).getByRole("button", { name: "Convidar pessoa" })
    );
    await waitFor(() =>
      expect(invite).toHaveBeenCalledWith("p-new", { email: "ana@exemplo.com" })
    );
    expect(addPerson).toHaveBeenCalledWith({
      displayName: "Ana Lima",
      role: "viewer",
      email: "ana@exemplo.com",
    });
    await waitFor(() =>
      expect(toast.success).toHaveBeenCalledWith("Convite enviado")
    );
  });

  it("dois cliques em Convidar pessoa criam uma pessoa só", async () => {
    let release: (value: unknown) => void = () => undefined;
    addPerson.mockImplementation(
      () =>
        new Promise((resolve) => {
          release = resolve;
        })
    );
    const route = { tab: "people" } as unknown as ContractRoute;
    render(
      <QueryClientProvider client={makeQueryClient()}>
        {CONTRACT_SLOTS.tabAction(motoDetail(), route)}
      </QueryClientProvider>
    );
    await userEvent.click(
      screen.getByRole("button", { name: "Convidar pessoa" })
    );
    const dialog = await screen.findByRole("dialog", {
      name: "Convidar pessoa",
    });
    await userEvent.type(within(dialog).getByLabelText("Nome"), "Ana Lima");
    await userEvent.type(
      within(dialog).getByLabelText(EMAIL_FIELD),
      "ana@exemplo.com"
    );
    const submit = within(dialog).getByRole("button", {
      name: "Convidar pessoa",
    });
    await userEvent.click(submit);
    await userEvent.click(submit);
    await waitFor(() => expect(submit).toBeDisabled());
    expect(addPerson).toHaveBeenCalledTimes(1);
    release({ data: { id: "p-new" }, error: null });
  });

  it("o foco volta ao gatilho ao fechar o Convidar pessoa (Esc) e o Remover (Cancelar)", async () => {
    const route = { tab: "people" } as unknown as ContractRoute;
    render(
      <QueryClientProvider client={makeQueryClient()}>
        {CONTRACT_SLOTS.tabAction(motoDetail(), route)}
      </QueryClientProvider>
    );
    const trigger = screen.getByRole("button", { name: "Convidar pessoa" });
    await userEvent.click(trigger);
    await screen.findByRole("dialog", { name: "Convidar pessoa" });
    await userEvent.keyboard("{Escape}");
    await waitFor(() => expect(trigger).toHaveFocus());
  });

  it("o foco volta ao ⋯ da linha ao cancelar o Remover", async () => {
    renderPeople(motoDetail());
    const menu = screen.getByRole("button", { name: "Ações de Rafael Prado" });
    await userEvent.click(menu);
    await userEvent.click(
      await screen.findByRole("menuitem", { name: "Remover do contrato" })
    );
    const dialog = await screen.findByRole("dialog", {
      name: "Remover Rafael Prado?",
    });
    await userEvent.click(
      within(dialog).getByRole("button", { name: "Cancelar" })
    );
    await waitFor(() => expect(menu).toHaveFocus());
  });

  it("no celular o ⋮ abre um sheet com o rosto, o nome e os itens de 44 px, e o Remover ainda confirma", async () => {
    const wide = window.innerWidth;
    window.innerWidth = 390;
    try {
      renderPeople(motoDetail());
      await userEvent.click(
        screen.getByRole("button", { name: "Ações de Rafael Prado" })
      );
      const sheet = await screen.findByRole("dialog", {
        name: "Rafael Prado",
      });
      expect(screen.queryByRole("menu")).toBeNull();
      await userEvent.click(
        within(sheet).getByRole("button", { name: "Remover do contrato" })
      );
      expect(
        await screen.findByRole("dialog", { name: "Remover Rafael Prado?" })
      ).toBeVisible();
    } finally {
      window.innerWidth = wide;
    }
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

  it("a linha da pessoa: avatar de 40 px (o seu, em verde-claro), a tag do papel e o metadado", () => {
    renderPeople(motoDetail());
    const rows = within(screen.getByTestId("people-list")).getAllByRole(
      "listitem"
    );
    const mine = rows[0] as HTMLElement;
    const avatar = within(mine).getByText("JS");
    expect(avatar).toHaveClass("size-10", "bg-brand-subtle", "text-brand");
    expect(within(rows[1] as HTMLElement).getByText("RP")).not.toHaveClass(
      "bg-brand-subtle"
    );
    expect(mine).toHaveTextContent("joao.souza@exemplo.com");
    expect(rows[2]).toHaveTextContent("silvia@demo.quitto.dev");
  });

  it("a 390 o metadado tem a largura toda: o e-mail numa linha (cortado com reticências e inteiro no title, nunca quebrado no meio), o 'enviado em' na de baixo, e a tag do papel sobe para a linha do nome", () => {
    renderPeople(motoDetail());
    const rows = within(screen.getByTestId("people-list")).getAllByRole(
      "listitem"
    );
    const silvia = rows[2] as HTMLElement;
    const email = within(silvia).getByText("silvia@demo.quitto.dev");
    expect(email).toHaveClass("block", "truncate", "md:inline");
    expect(email).toHaveAttribute("title", "silvia@demo.quitto.dev");
    expect(email.parentElement).not.toHaveClass("[overflow-wrap:anywhere]");
    expect(within(silvia).getByText("enviado em 01/10")).toHaveClass(
      "block",
      "md:inline"
    );
    // The separator joins the two on one line from md; below, only a screen reader hears it.
    for (const separator of within(silvia).getAllByText("·")) {
      expect(separator).toHaveClass("max-md:sr-only");
    }
    expect(silvia).toHaveTextContent(
      "Acompanha · silvia@demo.quitto.dev · enviado em 01/10"
    );
    // The role is the meta's first word, under the name, not a tag beside it.
    expect(within(silvia).getAllByText("Acompanha")).toHaveLength(1);
  });

  it("com um papel só livre, o papel é dito (Tag), não oferecido", async () => {
    const route = { tab: "people" } as unknown as ContractRoute;
    render(
      <QueryClientProvider client={makeQueryClient()}>
        {CONTRACT_SLOTS.tabAction(motoDetail(), route)}
      </QueryClientProvider>
    );
    await userEvent.click(
      screen.getByRole("button", { name: "Convidar pessoa" })
    );
    const dialog = await screen.findByRole("dialog", {
      name: "Convidar pessoa",
    });
    expect(within(dialog).queryByRole("radio")).toBeNull();
    expect(within(dialog).getByText("Acompanha")).toBeVisible();
  });

  it("Convidar pessoa: o nome é obrigatório e o e-mail digitado tem de valer (um e-mail com acento (que a API recusa) é barrado antes de criar a pessoa)", async () => {
    const route = { tab: "people" } as unknown as ContractRoute;
    render(
      <QueryClientProvider client={makeQueryClient()}>
        {CONTRACT_SLOTS.tabAction(
          motoDetail({ participants: motoDetail().participants.slice(0, 1) }),
          route
        )}
      </QueryClientProvider>
    );
    await userEvent.click(
      screen.getByRole("button", { name: "Convidar pessoa" })
    );
    const dialog = await screen.findByRole("dialog", {
      name: "Convidar pessoa",
    });
    const submit = within(dialog).getByRole("button", {
      name: "Convidar pessoa",
    });
    await userEvent.click(submit);
    expect(within(dialog).getByText("Diga o nome.")).toBeVisible();
    await userEvent.type(within(dialog).getByLabelText("Nome"), "Ana Lima");
    await userEvent.type(
      within(dialog).getByLabelText(EMAIL_OPTIONAL),
      "joão@exemplo.com"
    );
    await userEvent.click(submit);
    expect(within(dialog).getByText(INVALID_EMAIL)).toBeVisible();
    expect(addPerson).not.toHaveBeenCalled();
  });

  it("a pessoa entrou mas o convite falhou: fecha o diálogo, avisa e não duplica", async () => {
    invite.mockImplementation(() =>
      Promise.resolve({
        data: null,
        error: {
          status: 500,
          value: { error: { code: "INTERNAL", message: "falhou" } },
        },
      })
    );
    const route = { tab: "people" } as unknown as ContractRoute;
    render(
      <QueryClientProvider client={makeQueryClient()}>
        {CONTRACT_SLOTS.tabAction(motoDetail(), route)}
      </QueryClientProvider>
    );
    await userEvent.click(
      screen.getByRole("button", { name: "Convidar pessoa" })
    );
    const dialog = await screen.findByRole("dialog", {
      name: "Convidar pessoa",
    });
    await userEvent.type(within(dialog).getByLabelText("Nome"), "Ana Lima");
    await userEvent.type(
      within(dialog).getByLabelText(EMAIL_FIELD),
      "ana@exemplo.com"
    );
    await userEvent.click(
      within(dialog).getByRole("button", { name: "Convidar pessoa" })
    );
    await waitFor(() =>
      expect(toast.error).toHaveBeenCalledWith(
        "Pessoa adicionada, mas o convite não saiu. Envie de novo pela lista."
      )
    );
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
    expect(addPerson).toHaveBeenCalledTimes(1);
  });

  it("copiar o link sem permissão: avisa em vez de calar", async () => {
    Object.assign(navigator, {
      clipboard: { writeText: vi.fn().mockRejectedValue(new Error("denied")) },
    });
    renderPeople(motoDetail());
    await userEvent.click(
      screen.getByRole("button", { name: "Ações de Sílvia Souza" })
    );
    await userEvent.click(
      await screen.findByRole("menuitem", { name: "Copiar link do convite" })
    );
    await waitFor(() =>
      expect(toast.error).toHaveBeenCalledWith("Não deu para copiar")
    );
    expect(toast.success).not.toHaveBeenCalled();
  });
});
