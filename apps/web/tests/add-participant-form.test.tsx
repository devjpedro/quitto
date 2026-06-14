import { fireEvent, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { PLACEHOLDER } from "../src/lib/labels";
import { renderWithProviders } from "./test-utils";

const NAME_LABEL = /nome/i;
const EMAIL_LABEL = /e-mail do convidado/i;
const SUBMIT_ACTION = /adicionar/i;
const EMPTY_NAME_ERROR = /informe um nome/i;

const addMutateAsync = vi.fn().mockResolvedValue({ id: "p9" });
const inviteMutateAsync = vi
  .fn()
  .mockResolvedValue({ token: "tok-new", expiresAt: "2026-07-01T00:00:00Z" });
vi.mock("../src/hooks/use-participant-mutations", () => ({
  useAddParticipantMutation: () => ({
    mutateAsync: addMutateAsync,
    isPending: false,
  }),
  useCreateInviteMutation: () => ({
    mutateAsync: inviteMutateAsync,
    isPending: false,
  }),
}));

import { AddParticipantForm } from "../src/components/add-participant-form";

const DEFAULT_PROPS = {
  contractId: "c1",
  availableRoles: ["seller", "viewer"] as const,
};

describe("AddParticipantForm", () => {
  beforeEach(() => {
    addMutateAsync.mockClear();
    inviteMutateAsync.mockClear();
  });

  it("com e-mail vazio: só adiciona, não gera convite", async () => {
    const onDone = vi.fn();
    const onCreated = vi.fn();
    renderWithProviders(
      <AddParticipantForm
        {...DEFAULT_PROPS}
        onCreated={onCreated}
        onDone={onDone}
      />
    );

    fireEvent.change(screen.getByLabelText(NAME_LABEL), {
      target: { value: "Irmão" },
    });
    fireEvent.submit(screen.getByRole("button", { name: SUBMIT_ACTION }));

    await waitFor(() => expect(addMutateAsync).toHaveBeenCalled());
    expect(addMutateAsync).toHaveBeenCalledWith(
      expect.objectContaining({ displayName: "Irmão", role: "seller" })
    );
    expect(inviteMutateAsync).not.toHaveBeenCalled();
    expect(onCreated).not.toHaveBeenCalled();
    await waitFor(() => expect(onDone).toHaveBeenCalled());
  });

  it("com e-mail preenchido: adiciona + gera convite e expõe o token", async () => {
    const onCreated = vi.fn();
    renderWithProviders(
      <AddParticipantForm
        {...DEFAULT_PROPS}
        onCreated={onCreated}
        onDone={vi.fn()}
      />
    );

    fireEvent.change(screen.getByLabelText(NAME_LABEL), {
      target: { value: "Maria" },
    });
    fireEvent.change(screen.getByLabelText(EMAIL_LABEL), {
      target: { value: "maria@example.com" },
    });
    fireEvent.submit(screen.getByRole("button", { name: SUBMIT_ACTION }));

    await waitFor(() => expect(inviteMutateAsync).toHaveBeenCalled());
    expect(addMutateAsync).toHaveBeenCalled();
    expect(inviteMutateAsync).toHaveBeenCalledWith({
      participantId: "p9",
      body: { email: "maria@example.com" },
    });
    await waitFor(() => expect(onCreated).toHaveBeenCalledWith("tok-new"));
  });

  it("usa um placeholder de nome genérico", () => {
    renderWithProviders(
      <AddParticipantForm {...DEFAULT_PROPS} onDone={vi.fn()} />
    );
    expect(screen.getByLabelText(NAME_LABEL)).toHaveAttribute(
      "placeholder",
      PLACEHOLDER.participantName
    );
  });

  it("bloqueia envio com nome vazio", async () => {
    renderWithProviders(
      <AddParticipantForm {...DEFAULT_PROPS} onDone={vi.fn()} />
    );
    fireEvent.submit(screen.getByRole("button", { name: SUBMIT_ACTION }));
    await waitFor(() =>
      expect(screen.getByText(EMPTY_NAME_ERROR)).toBeInTheDocument()
    );
    expect(addMutateAsync).not.toHaveBeenCalled();
  });
});
