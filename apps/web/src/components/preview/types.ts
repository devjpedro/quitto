import type { BarStatus } from "@/components/ui/installment-bar";
import type { ScheduleSummary } from "@/lib/schedule-summary";

/** Which side the person viewing is on: the tag at the top of the card. */
export type PreviewSide = "pay" | "receive" | "follow";

export interface PreviewRow {
  /** Changed one by one by the person (the lime "ajustada" tag). */
  adjusted: boolean;
  amountCents: number;
  dueDate: string;
  sequence: number;
}

/**
 * The contract as it will look (mockup 15 §1.1), for the wizard and the
 * invite. A null part is drawn as a dashed outline, labeled with the step
 * that fills it.
 */
export interface PreviewModel {
  count: number;
  description: string | null;
  lastDueDate: string | null;
  overdueCount: number;
  /** Installments that enter the contract already paid (the bar and the legend count them). */
  paidCount: number;
  person: { kind: "other"; name: string } | { kind: "solo" } | null;
  /** The first 3; empty draws the dashed rows. */
  rows: PreviewRow[];
  side: PreviewSide | null;
  /** One per installment up to 24, null above (the bar goes by zones). */
  statuses: BarStatus[] | null;
  summary: ScheduleSummary | null;
  title: string | null;
  totalCents: number | null;
}
