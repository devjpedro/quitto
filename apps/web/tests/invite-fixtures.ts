import type { InviteView, PublicInvitePreview } from "@/features/invites/api";

export const FLORIPA: InviteView = {
  status: "pending",
  viewer: "invitee",
  contractId: "c-floripa",
  participantId: "p-joao",
  inviterName: "Bia Lopes",
  contract: {
    title: "Viagem para Floripa (dividida)",
    description: "Hospedagem e passagens",
    createdAt: "2026-10-04T15:58:00.000Z",
  },
  role: "buyer",
  requiresConfirmation: false,
  terms: {
    amountCents: 30_000,
    dayOfMonth: 10,
    firstDueDate: "2026-11-10",
    installmentsCount: 4,
    lastDueDate: "2027-02-10",
    maxCents: 30_000,
    minCents: 30_000,
    totalCents: 120_000,
  },
  schedulePreview: [
    { sequence: 1, dueDate: "2026-11-10", amountCents: 30_000 },
    { sequence: 2, dueDate: "2026-12-10", amountCents: 30_000 },
    { sequence: 3, dueDate: "2027-01-10", amountCents: 30_000 },
  ],
  sentAt: "2026-10-04T16:00:00.000Z",
  expiresAt: "2026-10-11T16:00:00.000Z",
  acceptedAt: null,
  declinedAt: null,
  email: "joao.souza@exemplo.com",
  emailMasked: "j•••@exemplo.com",
  inviteeName: null,
};

/** Monday, 5 Oct 2026, 12:00 in São Paulo: "a partir de 10/11" without the year. */
export const INVITE_NOW = new Date("2026-10-05T15:00:00.000Z");

/** What anyone with the link sees (Task 3): no schedule, no other parties, the e-mail masked. */
export const FLORIPA_PUBLIC: PublicInvitePreview = {
  status: "pending",
  inviterName: "Bia Lopes",
  contractTitle: "Viagem para Floripa (dividida)",
  role: "buyer",
  terms: {
    amountCents: 30_000,
    firstDueDate: "2026-11-10",
    installmentsCount: 4,
    totalCents: 120_000,
  },
  emailMasked: "j•••@exemplo.com",
  expiresAt: "2026-10-11T16:00:00.000Z",
};
