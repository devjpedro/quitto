import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { renderWithProviders } from "./test-utils";

const COMPROVANTE_LABEL = /comprovante/i;
const ALLOWED_FORMATS_MSG = /PDF, JPG ou PNG/i;
const SUBMIT_LABEL = /enviar comprovante/i;

const submit = vi.fn();
vi.mock("../src/hooks/use-payment-mutations", () => ({
  useSubmitProofMutation: () => ({ mutateAsync: submit, isPending: false }),
}));

import { ProofUpload } from "../src/components/proof-upload";

function file(name: string, type: string, size = 1024): File {
  const f = new File(["x"], name, { type });
  Object.defineProperty(f, "size", { value: size });
  return f;
}

describe("ProofUpload", () => {
  beforeEach(() => {
    submit.mockReset();
    submit.mockResolvedValue({ status: "awaiting_confirmation" });
  });

  it("rejects an invalid file type locally without calling the mutation", async () => {
    renderWithProviders(<ProofUpload contractId="c1" installmentId="i1" />);
    // applyAccept: false bypasses the input's `accept` hint so the file reaches
    // onChange — `accept` is only a hint (users can pick "all files"), so the
    // local validateProofFile guard is what we exercise here.
    await userEvent.upload(
      screen.getByLabelText(COMPROVANTE_LABEL),
      file("a.txt", "text/plain"),
      { applyAccept: false }
    );
    expect(screen.getByText(ALLOWED_FORMATS_MSG)).toBeInTheDocument();
    expect(submit).not.toHaveBeenCalled();
  });

  it("reviews a valid file then submits it", async () => {
    renderWithProviders(<ProofUpload contractId="c1" installmentId="i1" />);
    const picked = file("c.pdf", "application/pdf");
    await userEvent.upload(screen.getByLabelText(COMPROVANTE_LABEL), picked);
    expect(screen.getByText("c.pdf")).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: SUBMIT_LABEL }));
    await waitFor(() => expect(submit).toHaveBeenCalledOnce());
    expect(submit).toHaveBeenCalledWith(picked);
  });
});
