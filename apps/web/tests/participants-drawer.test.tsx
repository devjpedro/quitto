import { fireEvent, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { renderWithProviders } from "./test-utils";

const INVITE_ACTION = /convidar/i;
const EMAIL_LABEL = /e-mail/i;
const GENERATE_LINK_ACTION = /gerar link/i;
const REMOVE_ACTION = /remover/i;
const REMOVE_CONFIRM_ACTION = /^remover$/i;
const INVITE_LINK_SUFFIX = /\/invites\/tok123$/;

const createInvite = vi.fn().mockResolvedValue({
  token: "tok123",
  expiresAt: "2026-07-01T00:00:00.000Z",
});
const removeParticipant = vi.fn().mockResolvedValue({ ok: true });
vi.mock("../src/hooks/use-participant-mutations", () => ({
  useAddParticipantMutation: () => ({ mutateAsync: vi.fn(), isPending: false }),
  useCreateInviteMutation: () => ({
    mutateAsync: createInvite,
    isPending: false,
  }),
  useRemoveParticipantMutation: () => ({
    mutateAsync: removeParticipant,
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
    createInvite.mockClear();
    removeParticipant.mockClear();
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

    fireEvent.click(screen.getByRole("button", { name: INVITE_ACTION }));
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

  it("remove participante após confirmação", async () => {
    renderWithProviders(
      <ParticipantsDrawer
        contractId="c1"
        onClose={vi.fn()}
        open={true}
        participants={participants}
      />
    );

    fireEvent.click(screen.getByRole("button", { name: REMOVE_ACTION }));
    fireEvent.click(
      screen.getByRole("button", { name: REMOVE_CONFIRM_ACTION })
    );
    await waitFor(() => expect(removeParticipant).toHaveBeenCalledWith("p1"));
  });
});
