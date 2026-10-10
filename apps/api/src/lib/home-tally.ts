import { isPaidStatus } from "@quitto/shared";
import type { HomeInstallmentRow } from "./home-parties";

export interface Tally {
  paidCents: number;
  paidCount: number;
  totalCents: number;
  totalCount: number;
}

/** What is paid of a contract, and its whole, in count and in cents. */
export function tally(installments: HomeInstallmentRow[]): Tally {
  const out: Tally = {
    paidCents: 0,
    paidCount: 0,
    totalCents: 0,
    totalCount: installments.length,
  };
  for (const it of installments) {
    out.totalCents += it.amountCents;
    if (isPaidStatus(it.status)) {
      out.paidCents += it.amountCents;
      out.paidCount += 1;
    }
  }
  return out;
}
