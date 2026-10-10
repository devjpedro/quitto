import {
  buildPixBrCode,
  normalizeMerchantName,
  type PixKeyType,
  parsePixKey,
} from "@quitto/shared";
import type { Recebedor } from "./contract-access";

export interface InstallmentPix {
  code: string;
  key: string;
  keyType: PixKeyType;
  source: "account" | "contact";
}

/** The receiver's key when it parses; a stale one is no key (planner's decision 12). */
export function usableKey(
  recebedor: Recebedor
): { key: string; keyType: PixKeyType; source: "account" | "contact" } | null {
  const { key, keySource } = recebedor;
  if (!(key && keySource)) {
    return null;
  }
  try {
    return { key, keyType: parsePixKey(key).type, source: keySource };
  } catch {
    return null;
  }
}

/**
 * The installment's static BR Code, with the key and where it came from (the
 * account, or the contact without one). null without a key, or when the
 * stored one is no longer valid, so a stale key never breaks the screen. One
 * source for the installment detail and the home.
 */
export function installmentPix(
  recebedor: Recebedor,
  amountCents: number
): InstallmentPix | null {
  const usable = usableKey(recebedor);
  return usable
    ? {
        ...usable,
        code: buildPixBrCode({
          key: usable.key,
          amountCents,
          merchantName: normalizeMerchantName(recebedor.displayName ?? ""),
          merchantCity: "BRASIL",
        }),
      }
    : null;
}
