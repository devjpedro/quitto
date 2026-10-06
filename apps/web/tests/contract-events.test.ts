import { describe, expect, it } from "vitest";
import { groupEvents } from "@/features/contracts/lib/contract-events";
import type { ContractEvent } from "@/features/contracts/types";

const ev = (over: Partial<ContractEvent>): ContractEvent => ({
  id: over.id ?? Math.random().toString(36),
  type: "proof_submitted",
  installmentId: "i4",
  installmentSequence: 4,
  actorName: "Rafael Prado",
  isMe: false,
  metadata: null,
  createdAt: "2026-10-04T13:00:00.000Z",
  ...over,
});
const ctx = { today: "2026-10-05", locale: "pt-BR" as const };

describe("groupEvents (Histórico: um bloco por dia, os iguais seguidos numa linha)", () => {
  it("ontem: o comprovante do Rafael com o arquivo e o tamanho, às 10:00 de Brasília", () => {
    const [day] = groupEvents(
      [
        ev({
          metadata: { fileName: "pix-moto-outubro.pdf", sizeBytes: 188_416 },
        }),
      ],
      ctx
    );
    expect(day?.label).toBe("Ontem · domingo, 4 de outubro");
    expect(day?.rows[0]).toMatchObject({
      tone: "warning",
      actor: "Rafael Prado",
      text: "enviou o comprovante da parcela 4",
      meta: "pix-moto-outubro.pdf · 184 KB",
      time: "10:00",
      when: "ontem",
    });
  });

  it("dois recibos compartilhados seguidos: uma linha, com a contagem e as parcelas", () => {
    const shared = (sequence: number) =>
      ev({
        type: "receipt_share_created",
        installmentSequence: sequence,
        actorName: "João Souza",
        isMe: true,
        createdAt: "2026-09-14T21:22:00.000Z",
        metadata: null,
      });
    const [day] = groupEvents([shared(2), shared(1)], ctx);
    expect(day?.label).toBe("Segunda-feira, 14 de setembro");
    expect(day?.rows).toHaveLength(1);
    expect(day?.rows[0]).toMatchObject({
      count: 2,
      actor: null,
      text: "Você compartilhou 2 recibos",
      meta: "parcelas 1 e 2",
      when: "14/09",
    });
  });

  it("o reenvio: um comprovante depois de uma contestação da mesma parcela", () => {
    const days = groupEvents(
      [
        ev({
          id: "c",
          type: "payment_confirmed",
          installmentSequence: 2,
          installmentId: "i2",
          actorName: "João Souza",
          isMe: true,
          createdAt: "2026-07-31T12:12:00.000Z",
        }),
        ev({
          id: "r",
          installmentSequence: 2,
          installmentId: "i2",
          createdAt: "2026-07-31T11:40:00.000Z",
          metadata: { fileName: "pix-julho-rafael.pdf" },
        }),
        ev({
          id: "d",
          type: "payment_disputed",
          installmentSequence: 2,
          installmentId: "i2",
          actorName: "João Souza",
          isMe: true,
          createdAt: "2026-07-31T00:05:00.000Z",
          metadata: { reason: "Esse comprovante é o da parcela 1." },
        }),
      ],
      ctx
    );
    const lines = days.flatMap((d) => d.rows);
    expect(lines.map((l) => l.text)).toEqual([
      "Você confirmou o pagamento da parcela 2",
      "reenviou o comprovante da parcela 2",
      "Você contestou o comprovante da parcela 2",
    ]);
    expect(lines[2]?.meta).toBe("“Esse comprovante é o da parcela 1.”");
    expect(lines[2]?.tone).toBe("danger");
    expect(days.map((d) => d.label)).toEqual([
      "Sexta-feira, 31 de julho",
      "Quinta-feira, 30 de julho",
    ]);
  });

  it("quem saiu sem conta mais: o nome vem do metadado; a criação fecha a lista", () => {
    const days = groupEvents(
      [
        ev({
          type: "participant_left",
          installmentSequence: null,
          installmentId: null,
          actorName: null,
          metadata: { participantName: "Marcos Prado" },
          createdAt: "2026-09-02T11:15:00.000Z",
        }),
        ev({
          id: "created:c",
          type: "contract_created",
          installmentSequence: null,
          installmentId: null,
          actorName: "João Souza",
          isMe: true,
          createdAt: "2026-06-28T19:40:00.000Z",
        }),
      ],
      ctx
    );
    expect(days[0]?.rows[0]).toMatchObject({
      actor: "Marcos Prado",
      text: "saiu do contrato",
      tone: "neutral",
    });
    expect(days[1]?.rows[0]).toMatchObject({
      actor: null,
      text: "Você criou o contrato",
    });
  });

  it("um dia de outro ano diz o ano no rótulo (senão lê como mês que vem)", () => {
    const [other, same] = groupEvents(
      [
        ev({ id: "a", createdAt: "2026-09-14T15:00:00.000Z" }),
        ev({ id: "b", createdAt: "2025-11-10T15:00:00.000Z" }),
      ],
      ctx
    );
    expect(other?.label).toBe("Segunda-feira, 14 de setembro");
    expect(same?.label).toBe("Segunda-feira, 10 de novembro de 2025");
  });
});
