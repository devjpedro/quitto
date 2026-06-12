import { describe, expect, it } from "vitest";
import { validateProofFile } from "../src/lib/proof";

const ALLOWED_FORMATS_MSG = /PDF, JPG ou PNG/;

function makeFile(type: string, size: number): File {
  const f = new File(["x"], "c.bin", { type });
  Object.defineProperty(f, "size", { value: size });
  return f;
}

describe("validateProofFile", () => {
  it("accepts pdf/jpeg/png within size", () => {
    expect(validateProofFile(makeFile("application/pdf", 1024)).ok).toBe(true);
    expect(validateProofFile(makeFile("image/jpeg", 1024)).ok).toBe(true);
    expect(validateProofFile(makeFile("image/png", 1024)).ok).toBe(true);
  });

  it("rejects non-whitelisted mime", () => {
    const r = validateProofFile(makeFile("text/plain", 1024));
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.message).toMatch(ALLOWED_FORMATS_MSG);
    }
  });

  it("rejects empty file", () => {
    expect(validateProofFile(makeFile("application/pdf", 0)).ok).toBe(false);
  });

  it("rejects file bigger than 10MB", () => {
    expect(
      validateProofFile(makeFile("application/pdf", 10 * 1024 * 1024 + 1)).ok
    ).toBe(false);
  });
});
