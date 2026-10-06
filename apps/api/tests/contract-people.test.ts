import { describe, expect, it } from "bun:test";
import { peopleView } from "../src/lib/contract-people";

const OWNER = "u-joao";
const PAYER = "u-rafa";
const CREATED = new Date("2026-06-28T19:40:00Z");
const NOW = new Date("2026-10-05T12:00:00Z");

const people = [
  {
    id: "p-silvia",
    displayName: "Sílvia Souza",
    role: "viewer",
    linkedUserId: null,
    createdAt: new Date("2026-10-01T12:00:00Z"),
  },
  {
    id: "p-rafa",
    displayName: "Rafael Prado",
    role: "buyer",
    linkedUserId: PAYER,
    createdAt: new Date("2026-06-28T19:41:00Z"),
  },
  {
    id: "p-joao",
    displayName: "João Souza",
    role: "seller",
    linkedUserId: OWNER,
    // Not the contract's own instant: the owner's joinedAt is the contract's createdAt (M3).
    createdAt: new Date("2026-06-28T19:40:01Z"),
  },
];
const invites = [
  {
    participantId: "p-rafa",
    email: "rafael.prado@exemplo.com",
    token: "t-rafa",
    createdAt: new Date("2026-06-28T19:42:00Z"),
    expiresAt: new Date("2026-07-05T19:42:00Z"),
    acceptedAt: new Date("2026-06-29T13:00:00Z"),
    declinedAt: null,
  },
  {
    participantId: "p-silvia",
    email: "silvia.souza@exemplo.com",
    token: "t-silvia",
    createdAt: new Date("2026-10-01T12:00:00Z"),
    expiresAt: new Date("2026-10-15T12:00:00Z"),
    acceptedAt: null,
    declinedAt: null,
  },
];
const emails = new Map([
  [OWNER, "joao.souza@exemplo.com"],
  [PAYER, "rafael.prado@exemplo.com"],
]);

function view(viewerId: string) {
  return peopleView({
    people,
    invites,
    emails,
    ownerId: OWNER,
    contractCreatedAt: CREATED,
    viewerId,
    now: NOW,
    webOrigin: "https://app.quitto.dev",
  });
}

describe("peopleView", () => {
  it("o dono primeiro, depois quem paga ou recebe, depois quem acompanha", () => {
    expect(view(OWNER).map((p) => p.id)).toEqual([
      "p-joao",
      "p-rafa",
      "p-silvia",
    ]);
  });

  it("o dono vê os e-mails e o link do convite pendente", () => {
    const [joao, rafa, silvia] = view(OWNER);
    expect(joao).toMatchObject({
      isOwner: true,
      isMe: true,
      email: "joao.souza@exemplo.com",
      invite: null,
      joinedAt: CREATED.toISOString(),
    });
    expect(rafa).toMatchObject({
      linked: true,
      email: "rafael.prado@exemplo.com",
      invite: null,
      joinedAt: "2026-06-29T13:00:00.000Z",
    });
    expect(silvia).toMatchObject({
      linked: false,
      email: "silvia.souza@exemplo.com",
      invite: {
        status: "pending",
        sentAt: "2026-10-01T12:00:00.000Z",
        url: "https://app.quitto.dev/invites/t-silvia",
      },
      joinedAt: null,
    });
  });

  it("não dono: e-mail só o próprio, e nenhum link de convite", () => {
    const [joao, rafa, silvia] = view(PAYER);
    expect(joao?.email).toBeNull();
    expect(rafa).toMatchObject({
      isMe: true,
      email: "rafael.prado@exemplo.com",
    });
    expect(silvia?.email).toBeNull();
    expect(silvia?.invite).toEqual({
      status: "pending",
      sentAt: "2026-10-01T12:00:00.000Z",
      url: null,
    });
  });

  it("convite vencido é 'expired' e recusado é 'declined' (sem link)", () => {
    const expired = peopleView({
      people: [people[0] as (typeof people)[number]],
      invites: [
        {
          ...(invites[1] as (typeof invites)[number]),
          expiresAt: new Date("2026-10-04T12:00:00Z"),
        },
      ],
      emails,
      ownerId: OWNER,
      contractCreatedAt: CREATED,
      viewerId: OWNER,
      now: NOW,
      webOrigin: "https://app.quitto.dev",
    });
    expect(expired[0]?.invite?.status).toBe("expired");
    const declined = peopleView({
      people: [people[0] as (typeof people)[number]],
      invites: [
        {
          ...(invites[1] as (typeof invites)[number]),
          declinedAt: new Date("2026-10-02T12:00:00Z"),
        },
      ],
      emails,
      ownerId: OWNER,
      contractCreatedAt: CREATED,
      viewerId: OWNER,
      now: NOW,
      webOrigin: "https://app.quitto.dev",
    });
    expect(declined[0]?.invite).toEqual({
      status: "declined",
      sentAt: "2026-10-01T12:00:00.000Z",
      url: null,
    });
    // Declined wins over expired: the person said no, the clock does not matter.
    const both = peopleView({
      people: [people[0] as (typeof people)[number]],
      invites: [
        {
          ...(invites[1] as (typeof invites)[number]),
          expiresAt: new Date("2026-10-04T12:00:00Z"),
          declinedAt: new Date("2026-10-02T12:00:00Z"),
        },
      ],
      emails,
      ownerId: OWNER,
      contractCreatedAt: CREATED,
      viewerId: OWNER,
      now: NOW,
      webOrigin: "https://app.quitto.dev",
    });
    expect(both[0]?.invite?.status).toBe("declined");
  });

  it("só o nome (sem convite): sem e-mail, sem convite, sem data de entrada", () => {
    const [marina] = peopleView({
      people: [
        {
          id: "p-marina",
          displayName: "Marina Pires",
          role: "buyer",
          linkedUserId: null,
          createdAt: CREATED,
        },
      ],
      invites: [],
      emails,
      ownerId: OWNER,
      contractCreatedAt: CREATED,
      viewerId: OWNER,
      now: NOW,
      webOrigin: "https://app.quitto.dev",
    });
    expect(marina).toMatchObject({
      email: null,
      invite: null,
      joinedAt: null,
      linked: false,
    });
  });
});
