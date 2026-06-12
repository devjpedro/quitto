import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { ProofList } from "../src/components/proof-list";

const DOWNLOAD_LABEL = /baixar/i;
const EMPTY_TEXT = /nenhum comprovante/i;

const proof = {
  id: "p1",
  fileName: "comprovante.pdf",
  mimeType: "application/pdf",
  sizeBytes: 204_800,
  downloadUrl: "https://storage.example/c.pdf?sig=abc",
  createdAt: "2026-08-09T10:00:00.000Z",
};
const proofs = [proof];

describe("ProofList", () => {
  it("lists each proof with a download link", () => {
    render(<ProofList proofs={proofs} />);
    expect(screen.getByText("comprovante.pdf")).toBeInTheDocument();
    const link = screen.getByRole("link", { name: DOWNLOAD_LABEL });
    expect(link).toHaveAttribute("href", proof.downloadUrl);
  });

  it("renders an empty state with no proofs", () => {
    render(<ProofList proofs={[]} />);
    expect(screen.getByText(EMPTY_TEXT)).toBeInTheDocument();
  });
});
