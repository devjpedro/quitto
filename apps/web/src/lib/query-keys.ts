/** Structured query keys — no global invalidation; target the affected key. */
export const queryKeys = {
  contracts: ["contracts"] as const,
  contract: (id: string) => ["contract", id] as const,
};
