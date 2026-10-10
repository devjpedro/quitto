import { buildPixBrCode, normalizeMerchantName } from "@quitto/shared";

/** The receiver's static BR Code for one amount, built as the API builds it (planner's decision 12). */
export function pixCodeFor(
  pix: { key: string } | null,
  receiverName: string | null,
  amountCents: number
): string | null {
  if (!pix) {
    return null;
  }
  try {
    return buildPixBrCode({
      key: pix.key,
      amountCents,
      merchantName: normalizeMerchantName(receiverName ?? ""),
      merchantCity: "BRASIL",
    });
  } catch {
    return null;
  }
}
