import { describe, expect, it } from "bun:test";
import {
  buildInviteView,
  buildPublicPreview,
  inviteStatus,
  inviteViewer,
  maskEmail,
} from "../src/lib/invite-view";

const NOW = new Date("2026-10-05T15:00:00.000Z");
const terms = {
  amountCents: 30_000,
  dayOfMonth: 10,
  firstDueDate: "2026-11-10",
  installmentsCount: 4,
  lastDueDate: "2027-02-10",
  maxCents: 30_000,
  minCents: 30_000,
  totalCents: 120_000,
};
const row = {
  acceptedAt: null,
  createdAt: new Date("2026-10-04T13:00:00.000Z"),
  declinedAt: null,
  email: "joao.souza@exemplo.com",
  expiresAt: new Date("2026-10-11T13:00:00.000Z"),
  participantId: "p-slot",
};
const input = {
  contract: {
    createdAt: new Date("2026-10-04T12:58:00.000Z"),
    description: "Hospedagem e passagens",
    id: "c-floripa",
    ownerId: "u-bia",
    requiresConfirmation: false,
    title: "Viagem para Floripa (dividida)",
  },
  inviterName: "Bia Lopes",
  now: NOW,
  participates: false,
  row,
  schedulePreview: [
    { sequence: 1, dueDate: "2026-11-10", amountCents: 30_000 },
    { sequence: 2, dueDate: "2026-12-10", amountCents: 30_000 },
    { sequence: 3, dueDate: "2027-01-10", amountCents: 30_000 },
  ],
  slot: { displayName: "João Souza", role: "buyer", taken: false },
  terms,
  user: { email: "Joao.Souza@exemplo.com", id: "u-joao" },
};

describe("inviteStatus", () => {
  it.each([
    [{ ...row, acceptedAt: NOW }, "accepted"],
    [{ ...row, declinedAt: NOW }, "declined"],
    [{ ...row, expiresAt: new Date("2026-10-05T14:59:59.000Z") }, "expired"],
    [row, "pending"],
    // Accepted wins over an expiry that came later: it was accepted in time.
    [
      { ...row, acceptedAt: NOW, expiresAt: new Date("2026-10-01T00:00:00Z") },
      "accepted",
    ],
  ] as const)("%o → %s", (r, expected) => {
    expect(inviteStatus(r, NOW)).toBe(expected);
  });

  it("uma cópia antiga cuja vaga outra cópia já ocupou: accepted (aceitar daria 422)", () => {
    expect(inviteStatus(row, NOW, true)).toBe("accepted");
  });
});

describe("inviteViewer", () => {
  const base = {
    inviteEmail: "joao.souza@exemplo.com",
    ownerId: "u-bia",
    participates: false,
    status: "pending" as const,
    userEmail: "joao.souza@exemplo.com",
    userId: "u-joao",
  };

  it("o dono é owner, mesmo que o e-mail seja o do convite", () => {
    expect(inviteViewer({ ...base, userId: "u-bia" })).toBe("owner");
  });

  it("o e-mail do convite (sem diferença de caixa) é invitee", () => {
    expect(inviteViewer({ ...base, userEmail: "JOAO.SOUZA@exemplo.com" })).toBe(
      "invitee"
    );
  });

  it("quem aceitou continua invitee", () => {
    expect(
      inviteViewer({ ...base, participates: true, status: "accepted" })
    ).toBe("invitee");
  });

  it("o convidado que já participa por outra vaga: alreadyParticipant (aceitar daria 403)", () => {
    expect(inviteViewer({ ...base, participates: true })).toBe(
      "alreadyParticipant"
    );
  });

  it("outra parte do contrato abrindo o link: alreadyParticipant", () => {
    expect(
      inviteViewer({
        ...base,
        participates: true,
        userEmail: "rafa@exemplo.com",
      })
    ).toBe("alreadyParticipant");
  });

  it("qualquer outra conta: otherAccount", () => {
    expect(inviteViewer({ ...base, userEmail: "renata@exemplo.com" })).toBe(
      "otherAccount"
    );
  });
});

describe("maskEmail", () => {
  it("mostra a primeira letra e o domínio", () => {
    expect(maskEmail("joao.souza@exemplo.com")).toBe("j•••@exemplo.com");
    expect(maskEmail("j@exemplo.com")).toBe("j•••@exemplo.com");
  });

  it("sem @: só os pontos", () => {
    expect(maskEmail("joao")).toBe("•••");
  });
});

describe("buildInviteView", () => {
  it("o convidado vê o e-mail completo; o nome da vaga não", () => {
    const view = buildInviteView(input);
    expect(view).toMatchObject({
      status: "pending",
      viewer: "invitee",
      contractId: "c-floripa",
      participantId: "p-slot",
      inviterName: "Bia Lopes",
      contract: {
        title: "Viagem para Floripa (dividida)",
        description: "Hospedagem e passagens",
        createdAt: "2026-10-04T12:58:00.000Z",
      },
      role: "buyer",
      requiresConfirmation: false,
      terms,
      sentAt: "2026-10-04T13:00:00.000Z",
      expiresAt: "2026-10-11T13:00:00.000Z",
      acceptedAt: null,
      declinedAt: null,
      email: "joao.souza@exemplo.com",
      emailMasked: "j•••@exemplo.com",
      inviteeName: null,
    });
    expect(view.schedulePreview).toHaveLength(3);
  });

  it("o dono vê o e-mail e o nome da vaga", () => {
    const view = buildInviteView({
      ...input,
      user: { email: "bia.lopes@exemplo.com", id: "u-bia" },
    });
    expect(view.viewer).toBe("owner");
    expect(view.email).toBe("joao.souza@exemplo.com");
    expect(view.inviteeName).toBe("João Souza");
  });

  it("outra conta: só o e-mail mascarado", () => {
    const view = buildInviteView({
      ...input,
      user: { email: "renata.campos@exemplo.com", id: "u-renata" },
    });
    expect(view.viewer).toBe("otherAccount");
    expect(view.email).toBeNull();
    expect(view.inviteeName).toBeNull();
  });

  it("outra conta: sem descrição", () => {
    const view = buildInviteView({
      ...input,
      user: { email: "renata.campos@exemplo.com", id: "u-renata" },
    });
    expect(view.contract.description).toBeNull();
  });
});

describe("buildPublicPreview", () => {
  it("o mínimo: sem descrição, sem partes, sem e-mail completo", () => {
    const preview = buildPublicPreview({
      contractTitle: input.contract.title,
      inviterName: "Bia Lopes",
      now: NOW,
      role: "buyer",
      row,
      slotTaken: false,
      terms,
    });
    expect(preview).toEqual({
      status: "pending",
      inviterName: "Bia Lopes",
      contractTitle: "Viagem para Floripa (dividida)",
      role: "buyer",
      terms: {
        installmentsCount: 4,
        amountCents: 30_000,
        totalCents: 120_000,
        firstDueDate: "2026-11-10",
      },
      emailMasked: "j•••@exemplo.com",
      expiresAt: "2026-10-11T13:00:00.000Z",
    });
  });

  it("prévia de convite aceito (ou recusado, ou expirado): sem condições", () => {
    for (const ended of [
      { ...row, acceptedAt: NOW },
      { ...row, declinedAt: NOW },
      { ...row, expiresAt: new Date("2026-10-01T00:00:00.000Z") },
    ]) {
      const preview = buildPublicPreview({
        contractTitle: input.contract.title,
        inviterName: "Bia Lopes",
        now: NOW,
        role: "buyer",
        row: ended,
        slotTaken: false,
        terms,
      });
      expect(preview.terms).toBeNull();
    }
  });
});
