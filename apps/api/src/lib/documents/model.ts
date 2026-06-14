import { type InstallmentStatus, isPaidStatus } from "@quitto/shared";
import { type ContractProgress, computeProgress } from "../contract-progress";

export interface ModelContract {
  installmentsCount: number;
  title: string;
}
export interface ModelInstallment {
  amountCents: number;
  dueDate: string;
  paidAt: string | null;
  sequence: number;
  status: InstallmentStatus;
}
export interface ModelParticipant {
  displayName: string;
  role: string;
}
export interface DocumentParties {
  payerName: string | null;
  receiverName: string | null;
}

export interface StatementModel {
  contractTitle: string;
  fullyPaidAt: string | null;
  isFullyPaid: boolean;
  parties: DocumentParties;
  progress: ContractProgress;
  rows: {
    sequence: number;
    amountCents: number;
    dueDate: string;
    status: InstallmentStatus;
    paidAt: string | null;
  }[];
}

export interface ReceiptModel {
  amountCents: number;
  contractTitle: string;
  dueDate: string;
  installmentsCount: number;
  paidAt: string;
  parties: DocumentParties;
  sequence: number;
}

function partiesOf(participants: ModelParticipant[]): DocumentParties {
  const byRole = (role: string) =>
    participants.find((p) => p.role === role)?.displayName ?? null;
  return { payerName: byRole("buyer"), receiverName: byRole("seller") };
}

export function buildStatementModel(
  contract: ModelContract,
  installments: ModelInstallment[],
  participants: ModelParticipant[],
  todayISO: string
): StatementModel {
  const progress = computeProgress(installments, todayISO);
  const rows = [...installments].sort((a, b) => a.sequence - b.sequence);
  const isFullyPaid =
    rows.length > 0 && rows.every((r) => isPaidStatus(r.status));
  const paidDates = rows
    .filter((r) => isPaidStatus(r.status) && r.paidAt)
    .map((r) => r.paidAt as string);
  const fullyPaidAt =
    isFullyPaid && paidDates.length > 0
      ? paidDates.reduce((a, b) => (a > b ? a : b))
      : null;
  return {
    contractTitle: contract.title,
    parties: partiesOf(participants),
    progress,
    isFullyPaid,
    fullyPaidAt,
    rows: rows.map((r) => ({
      sequence: r.sequence,
      amountCents: r.amountCents,
      dueDate: r.dueDate,
      status: r.status,
      paidAt: r.paidAt,
    })),
  };
}

export function buildReceiptModel(
  contract: ModelContract,
  installment: ModelInstallment,
  participants: ModelParticipant[]
): ReceiptModel {
  return {
    contractTitle: contract.title,
    parties: partiesOf(participants),
    sequence: installment.sequence,
    installmentsCount: contract.installmentsCount,
    amountCents: installment.amountCents,
    dueDate: installment.dueDate,
    paidAt: installment.paidAt ?? "",
  };
}
