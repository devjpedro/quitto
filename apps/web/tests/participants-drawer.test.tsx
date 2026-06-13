import { fireEvent, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { renderWithProviders } from "./test-utils";

const ACOES_MARIA = /ações de maria/i;
const INVITE_ACTION = /convidar/i;
const EMAIL_LABEL = /^e-mail do convidado$/i;
const ADD_EMAIL_LABEL = /e-mail do convidado \(opcional\)/i;
const GENERATE_LINK_ACTION = /gerar link/i;
const REMOVE_ACTION = /remover/i;
const REMOVE_CONFIRM_ACTION = /^remover$/i;
const NAME_LABEL = /^nome$/i;
const ADD_PARTICIPANT_ACTION = /\+ adicionar participante/i;
const SUBMIT_ADD_ACTION = /^adicionar$/i;
const INVITE_LINK_SUFFIX = /\/invites\/tok123$/;

const addParticipant = vi.fn().mockResolvedValue({ id: "p-new" });
const createInvite = vi.fn().mockResolvedValue({
  token: "tok123",
  expiresAt: "2026-07-01T00:00:00.000Z",
});
const removeParticipant = vi.fn().mockResolvedValue({ ok: true });
const updateRole = vi.fn().mockResolvedValue({ id: "p1", role: "buyer" });
vi.mock("../src/hooks/use-participant-mutations", () => ({
  useAddParticipantMutation: () => ({
    mutateAsync: addParticipant,
    isPending: false,
  }),
  useCreateInviteMutation: () => ({
    mutateAsync: createInvite,
    isPending: false,
  }),
  useRemoveParticipantMutation: () => ({
    mutateAsync: removeParticipant,
    isPending: false,
  }),
  useUpdateParticipantRoleMutation: () => ({
    mutateAsync: updateRole,
    isPending: false,
  }),
}));

import { ParticipantsDrawer } from "../src/components/participants-drawer";

const participants = [
  {
    id: "p1",
    displayName: "Maria",
    role: "seller",
    linked: false,
    isOwner: false,
  },
];

describe("ParticipantsDrawer", () => {
  beforeEach(() => {
    addParticipant.mockClear();
    createInvite.mockClear();
    removeParticipant.mockClear();
    updateRole.mockClear();
    Object.assign(navigator, {
      clipboard: { writeText: vi.fn().mockResolvedValue(undefined) },
    });
  });

  it("gera o link de convite para um slot não-vinculado", async () => {
    renderWithProviders(
      <ParticipantsDrawer
        contractId="c1"
        onClose={vi.fn()}
        open={true}
        participants={participants}
      />
    );

    await userEvent.click(screen.getByRole("button", { name: ACOES_MARIA }));
    await userEvent.click(
      screen.getByRole("menuitem", { name: INVITE_ACTION })
    );
    fireEvent.change(screen.getByLabelText(EMAIL_LABEL), {
      target: { value: "maria@example.com" },
    });
    fireEvent.click(screen.getByRole("button", { name: GENERATE_LINK_ACTION }));

    await waitFor(() => expect(createInvite).toHaveBeenCalled());
    expect(createInvite).toHaveBeenCalledWith(
      expect.objectContaining({
        participantId: "p1",
        body: { email: "maria@example.com" },
      })
    );
    await waitFor(() =>
      expect(screen.getByDisplayValue(INVITE_LINK_SUFFIX)).toBeInTheDocument()
    );
  });

  it("adicionar com e-mail gera convite e exibe o link no drawer", async () => {
    renderWithProviders(
      <ParticipantsDrawer
        contractId="c1"
        onClose={vi.fn()}
        open={true}
        participants={participants}
      />
    );

    fireEvent.click(
      screen.getByRole("button", { name: ADD_PARTICIPANT_ACTION })
    );
    fireEvent.change(screen.getByLabelText(NAME_LABEL), {
      target: { value: "João" },
    });
    fireEvent.change(screen.getByLabelText(ADD_EMAIL_LABEL), {
      target: { value: "joao@example.com" },
    });
    fireEvent.submit(screen.getByRole("button", { name: SUBMIT_ADD_ACTION }));

    await waitFor(() => expect(addParticipant).toHaveBeenCalled());
    expect(createInvite).toHaveBeenCalledWith({
      participantId: "p-new",
      body: { email: "joao@example.com" },
    });
    await waitFor(() =>
      expect(screen.getByDisplayValue(INVITE_LINK_SUFFIX)).toBeInTheDocument()
    );
  });

  it("adicionar sem e-mail não gera convite", async () => {
    renderWithProviders(
      <ParticipantsDrawer
        contractId="c1"
        onClose={vi.fn()}
        open={true}
        participants={participants}
      />
    );

    fireEvent.click(
      screen.getByRole("button", { name: ADD_PARTICIPANT_ACTION })
    );
    fireEvent.change(screen.getByLabelText(NAME_LABEL), {
      target: { value: "Sem Email" },
    });
    fireEvent.submit(screen.getByRole("button", { name: SUBMIT_ADD_ACTION }));

    await waitFor(() => expect(addParticipant).toHaveBeenCalled());
    expect(createInvite).not.toHaveBeenCalled();
  });

  it("remove participante após confirmação", async () => {
    renderWithProviders(
      <ParticipantsDrawer
        contractId="c1"
        onClose={vi.fn()}
        open={true}
        participants={participants}
      />
    );

    await userEvent.click(screen.getByRole("button", { name: ACOES_MARIA }));
    await userEvent.click(
      screen.getByRole("menuitem", { name: REMOVE_ACTION })
    );
    fireEvent.click(
      screen.getByRole("button", { name: REMOVE_CONFIRM_ACTION })
    );
    await waitFor(() => expect(removeParticipant).toHaveBeenCalledWith("p1"));
  });

  it("exibe o badge 'Dono' quando isOwner=true", () => {
    renderWithProviders(
      <ParticipantsDrawer
        contractId="c1"
        onClose={vi.fn()}
        open={true}
        participants={[
          {
            id: "p1",
            displayName: "Maria",
            role: "seller",
            linked: false,
            isOwner: true,
          },
        ]}
      />
    );
    expect(screen.getByText("Dono")).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: ACOES_MARIA })
    ).not.toBeInTheDocument();
  });

  it("renderiza um Select de papel editável para o participante", () => {
    renderWithProviders(
      <ParticipantsDrawer
        contractId="c1"
        onClose={vi.fn()}
        open={true}
        participants={participants}
      />
    );
    // Radix Select expõe o gatilho como combobox; o portal de opções não abre
    // de forma confiável no jsdom, então validamos só a presença do controle.
    const comboboxes = screen.getAllByRole("combobox");
    expect(comboboxes).toHaveLength(1);
  });

  it("não exibe o badge 'Dono' quando isOwner=false", () => {
    renderWithProviders(
      <ParticipantsDrawer
        contractId="c1"
        onClose={vi.fn()}
        open={true}
        participants={participants}
      />
    );
    expect(screen.queryByText("Dono")).not.toBeInTheDocument();
  });
});
