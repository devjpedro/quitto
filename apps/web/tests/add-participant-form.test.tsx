import { fireEvent, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { renderWithProviders } from "./test-utils";

const NAME_LABEL = /nome/i;
const SUBMIT_ACTION = /adicionar/i;
const EMPTY_NAME_ERROR = /informe um nome/i;

const mutateAsync = vi.fn().mockResolvedValue({ id: "p9" });
vi.mock("../src/hooks/use-participant-mutations", () => ({
  useAddParticipantMutation: () => ({ mutateAsync, isPending: false }),
}));

import { AddParticipantForm } from "../src/components/add-participant-form";

describe("AddParticipantForm", () => {
  beforeEach(() => mutateAsync.mockClear());

  it("envia nome + papel e chama onDone", async () => {
    const onDone = vi.fn();
    renderWithProviders(<AddParticipantForm contractId="c1" onDone={onDone} />);

    fireEvent.change(screen.getByLabelText(NAME_LABEL), {
      target: { value: "Irmão" },
    });
    fireEvent.submit(screen.getByRole("button", { name: SUBMIT_ACTION }));

    await waitFor(() => expect(mutateAsync).toHaveBeenCalled());
    expect(mutateAsync).toHaveBeenCalledWith(
      expect.objectContaining({ displayName: "Irmão" })
    );
    await waitFor(() => expect(onDone).toHaveBeenCalled());
  });

  it("bloqueia envio com nome vazio", async () => {
    renderWithProviders(
      <AddParticipantForm contractId="c1" onDone={vi.fn()} />
    );
    fireEvent.submit(screen.getByRole("button", { name: SUBMIT_ACTION }));
    await waitFor(() =>
      expect(screen.getByText(EMPTY_NAME_ERROR)).toBeInTheDocument()
    );
    expect(mutateAsync).not.toHaveBeenCalled();
  });
});
