import { describe, expect, it } from "bun:test";
import {
  createdEvent,
  eventsPage,
  parseCursor,
  toContractEvent,
} from "../src/lib/contract-events";

const row = (
  id: string,
  iso: string,
  actorUserId: string | null = "u-joao"
) => ({
  id,
  type: "payment_confirmed",
  installmentId: "i-1",
  installmentSequence: 1,
  actorUserId,
  actorName: actorUserId ? "João Souza" : null,
  metadata: null,
  createdAt: new Date(iso),
});
const UUID_A = "11111111-1111-4111-8111-111111111111";
const UUID_B = "22222222-2222-4222-8222-222222222222";
const UUID_C = "33333333-3333-4333-8333-333333333333";
const created = createdEvent(
  {
    id: "c-moto",
    createdAt: new Date("2026-06-28T19:40:00Z"),
    ownerId: "u-joao",
  },
  "João Souza",
  "u-joao"
);

describe("contract events", () => {
  it("toContractEvent diz se o ator é quem pede e achata a data", () => {
    expect(
      toContractEvent(row("e1", "2026-07-31T12:12:00Z"), "u-joao")
    ).toEqual({
      id: "e1",
      type: "payment_confirmed",
      installmentId: "i-1",
      installmentSequence: 1,
      actorName: "João Souza",
      isMe: true,
      metadata: null,
      createdAt: "2026-07-31T12:12:00.000Z",
    });
    expect(
      toContractEvent(row("e2", "2026-07-31T12:12:00Z", null), "u-joao").isMe
    ).toBe(false);
  });

  it("a criação é um evento sintético, do dono", () => {
    expect(created).toEqual({
      id: "created:c-moto",
      type: "contract_created",
      installmentId: null,
      installmentSequence: null,
      actorName: "João Souza",
      isMe: true,
      metadata: null,
      createdAt: "2026-06-28T19:40:00.000Z",
    });
  });

  it("página cheia (veio limit + 1): corta, e o cursor é a data e o id do último", () => {
    const rows = [
      row(UUID_A, "2026-10-04T13:00:00Z"),
      row(UUID_B, "2026-09-14T21:22:00Z"),
      row(UUID_C, "2026-09-02T11:15:00Z"),
    ];
    const page = eventsPage(rows, 2, created, "u-joao");
    expect(page.items.map((e) => e.id)).toEqual([UUID_A, UUID_B]);
    expect(page.nextBefore).toBe(`2026-09-14T21:22:00.000Z|${UUID_B}`);
    expect(parseCursor(page.nextBefore as string)).toEqual({
      at: "2026-09-14T21:22:00.000Z",
      id: UUID_B,
    });
  });

  it("uma página que cabe no limite exato não tem cursor (a fronteira é > e não >=)", () => {
    const page = eventsPage(
      [row("a", "2026-10-04T13:00:00Z"), row("b", "2026-09-14T21:22:00Z")],
      2,
      created,
      "u-joao"
    );
    expect(page.items.map((e) => e.id)).toEqual(["a", "b", "created:c-moto"]);
    expect(page.nextBefore).toBeNull();
  });

  it("cursor meio válido é recusado (o Postgres não aceita), não vira consulta", () => {
    expect(parseCursor("lixo")).toBeNull();
    expect(parseCursor("2026-10-05T12:00:00.000Z|lixo")).toBeNull();
    expect(parseCursor("2026|x")).toBeNull();
    expect(parseCursor(`lixo|${UUID_A}`)).toBeNull();
  });

  it("cursor com a forma certa e a data impossível (mês 13, 25 h, 30/02) é recusado", () => {
    expect(parseCursor(`2026-13-01T00:00:00.000Z|${UUID_A}`)).toBeNull();
    expect(parseCursor(`2026-10-05T25:00:00.000Z|${UUID_A}`)).toBeNull();
    expect(parseCursor(`2026-02-30T12:00:00.000Z|${UUID_A}`)).toBeNull();
    expect(parseCursor(`2026-10-05T12:00:00.000Z|${UUID_A}`)).toEqual({
      at: "2026-10-05T12:00:00.000Z",
      id: UUID_A,
    });
  });

  it("última página: tudo e a criação no fim, sem cursor", () => {
    const page = eventsPage(
      [row("a", "2026-10-04T13:00:00Z")],
      2,
      created,
      "u-joao"
    );
    expect(page.items.map((e) => e.id)).toEqual(["a", "created:c-moto"]);
    expect(page.nextBefore).toBeNull();
  });
});
