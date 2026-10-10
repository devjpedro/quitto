import { describe, expect, it } from "vitest";
import {
  PROOF_MAX_BYTES,
  proofFileError,
} from "@/features/installments/lib/proof-file";

describe("proofFileError (validação antes do presign)", () => {
  it("PDF, JPG e PNG até 10 MB passam", () => {
    expect(
      proofFileError({ type: "application/pdf", size: 188_416 })
    ).toBeNull();
    expect(
      proofFileError({ type: "image/jpeg", size: PROOF_MAX_BYTES })
    ).toBeNull();
    expect(proofFileError({ type: "image/png", size: 1 })).toBeNull();
  });

  it("HEIC não é aceito; 14,2 MB passa do limite; vazio é vazio", () => {
    expect(proofFileError({ type: "image/heic", size: 1000 })).toBe("bad_type");
    expect(proofFileError({ type: "application/pdf", size: 14_889_779 })).toBe(
      "too_large"
    );
    expect(proofFileError({ type: "application/pdf", size: 0 })).toBe("empty");
  });
});
