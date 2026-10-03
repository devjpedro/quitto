import {
  buildPixBrCode,
  normalizeMerchantName,
  type PixKeyType,
  parsePixKey,
} from "@quitto/shared";
import type { Recebedor } from "./contract-access";

export interface InstallmentPix {
  code: string;
  keyType: PixKeyType;
}

/**
 * The installment's static BR Code. The contract's key wins over the receiver's
 * profile key. null when there is no key, or when the stored one is no longer
 * valid, so a stale key never breaks the screen. One source for the installment
 * detail and the home, so both show the same code for the same installment.
 */
export function installmentPix(
  contractPixKey: string | null,
  recebedor: Recebedor,
  amountCents: number
): InstallmentPix | null {
  const key = contractPixKey ?? recebedor.profileKey;
  if (!key) {
    return null;
  }
  try {
    const { type } = parsePixKey(key);
    return {
      code: buildPixBrCode({
        key,
        amountCents,
        merchantName: normalizeMerchantName(recebedor.displayName ?? ""),
        merchantCity: "BRASIL",
      }),
      keyType: type,
    };
  } catch {
    return null;
  }
}
