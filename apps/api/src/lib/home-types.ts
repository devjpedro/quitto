import type { Direction } from "@quitto/shared";
import type { ContractSummary } from "./home-progress";

export type InstallmentActionKind =
  | "overdue"
  | "review"
  | "disputed"
  | "due_soon";

export interface UpcomingItem {
  amountCents: number;
  contractId: string;
  contractTitle: string;
  direction: Direction;
  dueDate: string;
  installmentId: string;
  installmentsCount: number;
  sequence: number;
  status: string;
}

export interface InstallmentAction extends UpcomingItem {
  canConfirm: boolean;
  canMarkPaid: boolean;
  /** The approver may mark it received (POST …/mark-received): pending or disputed. */
  canMarkReceived: boolean;
  /** The whole contract: the card's bar and legend. */
  contract: ContractSummary;
  /** How many overdue installments the card stands for; 1 on every other card. */
  count: number;
  counterpartyName: string | null;
  id: string;
  /** The installments behind the card, oldest first; the base fields are the first one's. */
  installmentIds: string[];
  kind: InstallmentActionKind;
  pixCode: string | null;
  sequences: number[];
  /** The amount the card shows: the group's sum, or the installment's own. */
  totalCents: number;
}

export interface InviteAction {
  /** null when the installments have different amounts: the card shows the total instead. */
  amountCents: number | null;
  contractTitle: string;
  firstDueDate: string | null;
  id: string;
  installmentsCount: number;
  inviterName: string;
  kind: "invite";
  role: string;
  token: string;
  totalCents: number;
}

export type HomeAction = InstallmentAction | InviteAction;

export interface HomeInviteRow {
  /** null when the installments have different amounts: the card shows the total instead. */
  amountCents: number | null;
  contractId: string;
  contractTitle: string;
  createdAt: Date;
  firstDueDate: string | null;
  installmentsCount: number;
  inviterName: string;
  role: string;
  token: string;
  totalCents: number;
}

/**
 * Overdue money by direction, never summed together (the chips, owner's
 * decision 8). A disputed installment past due is not here for the payer:
 * for them it is the "Contestada" card, another decision. The card's bar
 * and the sidebar ring still draw it as overdue (planner's decision 21).
 */
export interface OverdueTotals {
  toPayCents: number;
  toReceiveCents: number;
}

export interface HomeAgenda {
  actions: HomeAction[];
  nextDue: UpcomingItem | null;
  overdue: OverdueTotals;
  upcoming: {
    items: UpcomingItem[];
    moreCount: number;
    toPayCents: number;
    toReceiveCents: number;
  };
}
