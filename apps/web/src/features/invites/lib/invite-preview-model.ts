import type { PreviewModel, PreviewSide } from "@/components/preview/types";
import { summaryFromTerms } from "@/lib/schedule-summary";
import type { InviteView } from "../api";

/** The side of the slot the invite offers: the one who will read the contract. */
export function sideOfRole(role: string): PreviewSide {
  if (role === "seller") {
    return "receive";
  }
  return role === "buyer" ? "pay" : "follow";
}

/** The contract as the invited person will see it (mockup 15, G): their side, the inviter's face. */
export function invitePreviewModel(view: InviteView): PreviewModel {
  const { terms } = view;
  // Null terms (another account, invite ended): nothing to draw but who and what.
  if (!terms) {
    return {
      side: sideOfRole(view.role),
      title: view.contract.title,
      description: null,
      totalCents: null,
      summary: null,
      person: { kind: "other", name: view.inviterName },
      rows: [],
      count: 0,
      lastDueDate: null,
      statuses: null,
      overdueCount: 0,
      paidCount: 0,
    };
  }
  const count = terms.installmentsCount;
  return {
    side: sideOfRole(view.role),
    title: view.contract.title,
    description: view.contract.description,
    totalCents: terms.totalCents,
    summary: summaryFromTerms(terms),
    person: { kind: "other", name: view.inviterName },
    rows: view.schedulePreview.map((row) => ({ ...row, adjusted: false })),
    count,
    lastDueDate: terms.lastDueDate,
    statuses:
      count > 0 && count <= 24
        ? Array.from({ length: count }, () => "open" as const)
        : null,
    overdueCount: 0,
    paidCount: 0,
  };
}
