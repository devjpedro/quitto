export const PROOF_ALLOWED_MIME = [
  "application/pdf",
  "image/jpeg",
  "image/png",
] as const;
export type ProofMime = (typeof PROOF_ALLOWED_MIME)[number];
export const PROOF_MAX_BYTES = 10 * 1024 * 1024;

export type ProofValidation = { ok: true } | { ok: false; message: string };

/** Local guardrails mirroring the API (spec §7): whitelist MIME + 0 < size <= 10MB. */
export function validateProofFile(file: File): ProofValidation {
  if (!(PROOF_ALLOWED_MIME as readonly string[]).includes(file.type)) {
    return {
      ok: false,
      message: "Formato não suportado. Envie PDF, JPG ou PNG.",
    };
  }
  if (file.size <= 0 || file.size > PROOF_MAX_BYTES) {
    return {
      ok: false,
      message: "Arquivo inválido (vazio ou maior que 10MB).",
    };
  }
  return { ok: true };
}
