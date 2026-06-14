export interface ExportProfile {
  email: string;
  id: string;
  name: string;
}
export interface ExportOwnedContract {
  auditEvents: { type: string; createdAt: string }[];
  contract: { id: string; title: string };
  installments: {
    sequence: number;
    amountCents: number;
    dueDate: string;
    status: string;
  }[];
  participants: { displayName: string; role: string }[];
  proofs: { fileName: string; createdAt: string }[];
}
export interface ExportParticipatingContract {
  contract: { id: string; title: string };
  installments: {
    sequence: number;
    amountCents: number;
    dueDate: string;
    status: string;
  }[];
  mySlot: string;
}
export interface ExportNotification {
  contractId: string;
  createdAt: string;
  installmentId: string | null;
  readAt: string | null;
  type: string;
}
export interface ExportInput {
  exportedAt: string;
  notifications: ExportNotification[];
  ownedContracts: ExportOwnedContract[];
  participatingContracts: ExportParticipatingContract[];
  profile: ExportProfile;
}
export type UserExport = ExportInput;

/** Assembles the user data export payload (pure: receives already-loaded data). */
export function buildUserExport(input: ExportInput): UserExport {
  return {
    exportedAt: input.exportedAt,
    profile: input.profile,
    ownedContracts: input.ownedContracts,
    participatingContracts: input.participatingContracts,
    notifications: input.notifications,
  };
}
