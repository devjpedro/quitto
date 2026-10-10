import { describe, expect, it } from "bun:test";
import {
  groupNotifications,
  type NotificationRow,
} from "../src/lib/notification-groups";

let seq = 0;
function row(over: Partial<NotificationRow> = {}): NotificationRow {
  seq += 1;
  return {
    id: `n${seq}`,
    type: "installment_overdue_receivable",
    contractId: "terreno",
    contractTitle: "Venda do terreno",
    installmentsCount: 60,
    installmentId: `i${seq}`,
    installmentSequence: seq,
    metadata: null,
    readAt: null,
    createdAt: new Date(Date.UTC(2026, 9, 1, 12, 0, 60 - seq)),
    ...over,
  };
}

describe("groupNotifications", () => {
  it("avisos seguidos do mesmo tipo e contrato viram uma linha, a do mais novo", () => {
    const rows = [
      row({ id: "a", installmentSequence: 28 }),
      row({ id: "b", installmentSequence: 27 }),
      row({ id: "c", installmentSequence: 26 }),
    ];
    const [line] = groupNotifications(rows);
    expect(line).toMatchObject({
      id: "a",
      ids: ["a", "b", "c"],
      count: 3,
      groupKey: "installment_overdue_receivable:terreno:c",
      installmentSequence: 28,
      sequences: [26, 27, 28],
      unreadCount: 3,
      readAt: null,
      createdAt: rows[0]?.createdAt.toISOString(),
    });
  });

  it("um aviso diferente no meio quebra a sequência", () => {
    const lines = groupNotifications([
      row({ id: "a" }),
      row({ id: "b", type: "proof_submitted" }),
      row({ id: "c" }),
    ]);
    expect(lines.map((l) => l.ids)).toEqual([["a"], ["b"], ["c"]]);
  });

  it("o mesmo tipo em outro contrato não junta", () => {
    const lines = groupNotifications([
      row({ id: "a" }),
      row({
        id: "b",
        contractId: "notebook",
        contractTitle: "Notebook da Marina",
      }),
    ]);
    expect(lines.map((l) => l.count)).toEqual([1, 1]);
  });

  it("não lida enquanto algum aviso for; lida, leva a leitura mais recente", () => {
    const early = new Date("2026-10-02T09:00:00Z");
    const late = new Date("2026-10-02T10:00:00Z");
    const [mixed] = groupNotifications([
      row({ id: "a", readAt: early }),
      row({ id: "b" }),
    ]);
    expect(mixed).toMatchObject({ readAt: null, unreadCount: 1 });
    const [read] = groupNotifications([
      row({ id: "c", readAt: early }),
      row({ id: "d", readAt: late }),
    ]);
    expect(read).toMatchObject({ readAt: late.toISOString(), unreadCount: 0 });
  });

  it("aviso sem parcela não entra nas sequências, e repetida conta uma vez", () => {
    const [line] = groupNotifications([
      row({ id: "a", installmentSequence: 5 }),
      row({ id: "b", installmentSequence: 5 }),
      row({ id: "c", installmentSequence: null, installmentId: null }),
    ]);
    expect(line?.sequences).toEqual([5]);
  });

  it("o limite é de linhas, não de avisos", () => {
    const rows = [
      ...Array.from({ length: 30 }, () => row()),
      row({ type: "proof_submitted" }),
      row(),
    ];
    const lines = groupNotifications(rows, 2);
    expect(lines).toHaveLength(2);
    expect(lines[0]?.count).toBe(30);
  });
});
