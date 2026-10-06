import type { ContractDetail } from "@/features/contracts/types";

const DUE = [
  "2026-06-30",
  "2026-07-30",
  "2026-08-30",
  "2026-09-30",
  "2026-10-30",
  "2026-11-30",
  "2026-12-30",
  "2027-01-30",
  "2027-02-28",
  "2027-03-30",
];
const STATUS = [
  "confirmed",
  "confirmed",
  "pending",
  "awaiting_confirmation",
  "pending",
  "pending",
  "pending",
  "pending",
  "pending",
  "pending",
];
const PAID_AT = ["2026-06-30T23:47:00.000Z", "2026-07-31T12:12:00.000Z"];

/** Moto do Rafa on 05/10/2026 (mockup 14, frame A), as João (owner, receives) reads it. */
export function motoDetail(over: Partial<ContractDetail> = {}): ContractDetail {
  return {
    role: "seller",
    isOwner: true,
    isPayer: false,
    isApprover: true,
    contract: {
      id: "c-moto",
      title: "Moto do Rafa",
      description: null,
      ownerRole: "seller",
      requiresConfirmation: true,
      status: "active",
      monthlyAmountCents: 48_000,
      pixKey: null,
      recebedor: { name: "João Souza", hasKey: true },
      createdAt: "2026-06-28T19:40:00.000Z",
      ownerName: "João Souza",
    },
    receiver: {
      name: "João Souza",
      hasAccount: true,
      contactParticipantId: null,
      pix: {
        key: "joao.souza@exemplo.com",
        keyType: "email",
        source: "account",
      },
    },
    progress: {
      totalCents: 480_000,
      paidCents: 96_000,
      remainingCents: 384_000,
      percent: 20,
      overdueCount: 1,
    },
    installments: DUE.map((dueDate, i) => ({
      id: `i${i + 1}`,
      sequence: i + 1,
      amountCents: 48_000,
      dueDate,
      status: STATUS[i] as string,
      paidAt: PAID_AT[i] ?? null,
    })),
    participants: [
      {
        id: "p-joao",
        displayName: "João Souza",
        role: "seller",
        linked: true,
        isOwner: true,
        isMe: true,
        email: "joao.souza@exemplo.com",
        invite: null,
        joinedAt: "2026-06-28T19:40:00.000Z",
      },
      {
        id: "p-rafa",
        displayName: "Rafael Prado",
        role: "buyer",
        linked: true,
        isOwner: false,
        isMe: false,
        email: "rafa@demo.quitto.dev",
        invite: null,
        joinedAt: "2026-06-29T13:00:00.000Z",
      },
      {
        id: "p-silvia",
        displayName: "Sílvia Souza",
        role: "viewer",
        linked: false,
        isOwner: false,
        isMe: false,
        email: "silvia@demo.quitto.dev",
        invite: {
          status: "pending",
          sentAt: "2026-10-01T12:00:00.000Z",
          url: "http://localhost:3001/invites/t-silvia",
        },
        joinedAt: null,
      },
    ],
    recentEvents: [],
    ...over,
  };
}
