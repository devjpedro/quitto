/** Structured query keys — no global invalidation; target the affected key. */
export const queryKeys = {
  me: ["me"] as const,
  deletionSummary: ["me", "deletion-summary"] as const,
  session: ["session"] as const,
  home: ["home"] as const,
  contracts: ["contracts"] as const,
  people: ["people"] as const,
  contract: (id: string) => ["contract", id] as const,
  installment: (id: string) => ["installment", id] as const,
  installmentsList: (q: { from: string; pastDue: boolean; to: string }) =>
    ["installments", q] as const,
  invite: (token: string) => ["invite", token] as const,
  notifications: ["notifications"] as const,
  receiptShare: (installmentId: string) =>
    ["receipt-share", installmentId] as const,
};
