import { eq, inArray } from "drizzle-orm";
import { Elysia, t } from "elysia";
import { db } from "../db/client";
import {
  auditEvent,
  contract,
  installment,
  notification,
  participant,
  proof,
  user as userTable,
} from "../db/schema";
import { buildUserExport } from "../lib/account-export";
import { requireAuth } from "../lib/session";
import { deleteObjects } from "../lib/storage";

const nowISO = () => new Date().toISOString();
const isoDateTime = (d: Date) => d.toISOString();

export const accountModule = new Elysia({ prefix: "/api" })
  .get("/me/export", async ({ request }) => {
    const { user } = await requireAuth(request.headers);

    const owned = await db
      .select()
      .from(contract)
      .where(eq(contract.ownerId, user.id));
    const ownedIds = owned.map((c) => c.id);

    const linked = await db
      .select({ contractId: participant.contractId, role: participant.role })
      .from(participant)
      .where(eq(participant.linkedUserId, user.id));
    const participatingIds = linked
      .map((l) => l.contractId)
      .filter((id) => !ownedIds.includes(id));

    const allIds = [...ownedIds, ...participatingIds];
    const items = allIds.length
      ? await db
          .select()
          .from(installment)
          .where(inArray(installment.contractId, allIds))
      : [];
    const people = ownedIds.length
      ? await db
          .select()
          .from(participant)
          .where(inArray(participant.contractId, ownedIds))
      : [];
    const events = ownedIds.length
      ? await db
          .select()
          .from(auditEvent)
          .where(inArray(auditEvent.contractId, ownedIds))
      : [];
    const ownedInstallmentIds = items
      .filter((it) => ownedIds.includes(it.contractId))
      .map((it) => it.id);
    const proofs = ownedInstallmentIds.length
      ? await db
          .select()
          .from(proof)
          .where(inArray(proof.installmentId, ownedInstallmentIds))
      : [];
    const notifs = await db
      .select()
      .from(notification)
      .where(eq(notification.userId, user.id));
    const participating = participatingIds.length
      ? await db
          .select({ id: contract.id, title: contract.title })
          .from(contract)
          .where(inArray(contract.id, participatingIds))
      : [];
    const titleByContract = new Map(participating.map((c) => [c.id, c.title]));

    const instOf = (contractId: string) =>
      items
        .filter((it) => it.contractId === contractId)
        .map((it) => ({
          sequence: it.sequence,
          amountCents: it.amountCents,
          dueDate: it.dueDate,
          status: it.status,
        }));

    const payload = buildUserExport({
      exportedAt: nowISO(),
      profile: { id: user.id, name: user.name, email: user.email },
      ownedContracts: owned.map((c) => ({
        contract: { id: c.id, title: c.title },
        installments: instOf(c.id),
        participants: people
          .filter((p) => p.contractId === c.id)
          .map((p) => ({ displayName: p.displayName, role: p.role })),
        auditEvents: events
          .filter((e) => e.contractId === c.id)
          .map((e) => ({ type: e.type, createdAt: isoDateTime(e.createdAt) })),
        proofs: items
          .filter((it) => it.contractId === c.id)
          .flatMap((it) =>
            proofs
              .filter((pr) => pr.installmentId === it.id)
              .map((pr) => ({
                fileName: pr.fileName,
                createdAt: isoDateTime(pr.createdAt),
              }))
          ),
      })),
      participatingContracts: linked
        .filter((l) => participatingIds.includes(l.contractId))
        .map((l) => ({
          contract: {
            id: l.contractId,
            title: titleByContract.get(l.contractId) ?? "",
          },
          mySlot: l.role,
          installments: instOf(l.contractId),
        })),
      notifications: notifs.map((n) => ({
        type: n.type,
        contractId: n.contractId,
        installmentId: n.installmentId,
        readAt: n.readAt ? isoDateTime(n.readAt) : null,
        createdAt: isoDateTime(n.createdAt),
      })),
    });

    return new Response(JSON.stringify(payload, null, 2), {
      headers: {
        "content-type": "application/json; charset=utf-8",
        "content-disposition": 'attachment; filename="quitto-meus-dados.json"',
      },
    });
  })
  .delete(
    "/me",
    async ({ request }) => {
      const { user } = await requireAuth(request.headers);

      // chaves R2 dos comprovantes de contratos PRÓPRIOS (serão apagados pela cascata)
      const keys = await db
        .select({ objectKey: proof.objectKey })
        .from(proof)
        .innerJoin(installment, eq(proof.installmentId, installment.id))
        .innerJoin(contract, eq(installment.contractId, contract.id))
        .where(eq(contract.ownerId, user.id));

      await db.delete(userTable).where(eq(userTable.id, user.id)); // cascata cuida do resto

      try {
        await deleteObjects(keys.map((k) => k.objectKey));
      } catch (err) {
        // best-effort: objeto órfão no R2 é vazamento menor, não erro de exclusão
        console.error("[delete-account] falha ao purgar R2", err);
      }

      return { ok: true as const };
    },
    { response: t.Object({ ok: t.Literal(true) }) }
  );
