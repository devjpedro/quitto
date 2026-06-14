/** Structured query keys — no global invalidation; target the affected key. */
export const queryKeys = {
  dashboard: ["dashboard"] as const,
  contracts: ["contracts"] as const,
  contract: (id: string) => ["contract", id] as const,
  installment: (id: string) => ["installment", id] as const,
  invite: (token: string) => ["invite", token] as const,
  myInvites: ["my-invites"] as const,
  notifications: ["notifications"] as const,
  notificationsUnread: ["notifications", "unread-count"] as const,
};
