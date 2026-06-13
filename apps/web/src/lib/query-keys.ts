/** Structured query keys — no global invalidation; target the affected key. */
export const queryKeys = {
  contracts: ["contracts"] as const,
  contract: (id: string) => ["contract", id] as const,
  installment: (id: string) => ["installment", id] as const,
  invite: (token: string) => ["invite", token] as const,
  myInvites: ["my-invites"] as const,
};
