const PROOF_TYPES: readonly string[] = [
  "application/pdf",
  "image/jpeg",
  "image/png",
];
export const PROOF_MAX_BYTES = 10 * 1024 * 1024;
/** The file chooser's filter: the same three types the API takes (proofMimeSchema). */
export const PROOF_ACCEPT =
  ".pdf,.jpg,.jpeg,.png,application/pdf,image/jpeg,image/png";

export type ProofFileError = "bad_type" | "too_large" | "empty";

/** Checked before the presign (mockup 14, P7); the API checks again from the stored object. */
export function proofFileError(file: {
  size: number;
  type: string;
}): ProofFileError | null {
  if (!PROOF_TYPES.includes(file.type)) {
    return "bad_type";
  }
  if (file.size <= 0) {
    return "empty";
  }
  return file.size > PROOF_MAX_BYTES ? "too_large" : null;
}
