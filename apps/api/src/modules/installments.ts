import { isPaidStatus } from "@quitto/shared";
import { desc, eq } from "drizzle-orm";
import { Elysia, t } from "elysia";
import { db } from "../db/client";
import {
  auditEvent,
  participant,
  proof,
  user as userTable,
} from "../db/schema";
import { env } from "../env";
import {
  pickRecebedor,
  receiverContactId,
  receiverUsers,
} from "../lib/contract-access";
import { loadInstallmentForUser } from "../lib/installment-access";
import { latestDispute, proofStates } from "../lib/installment-detail";
import { installmentPix } from "../lib/installment-pix";
import { findActiveShare } from "../lib/receipt-share";
import { requireAuth } from "../lib/session";
import { presignDownload } from "../lib/storage";

const nullable = <T extends Parameters<typeof t.Union>[0][number]>(schema: T) =>
  t.Union([schema, t.Null()]);

const detailSchema = t.Object({
  id: t.String(),
  sequence: t.Integer(),
  amountCents: t.Integer(),
  dueDate: t.String(),
  status: t.String(),
  paidAt: nullable(t.String()),
  confirmedAt: nullable(t.String()),
  receiver: t.Object({
    name: nullable(t.String()),
    hasAccount: t.Boolean(),
    contactParticipantId: nullable(t.String()),
  }),
  pix: nullable(
    t.Object({
      copiaECola: t.String(),
      key: t.String(),
      keyType: t.String(),
      payToName: t.String(),
      source: t.Union([t.Literal("account"), t.Literal("contact")]),
    })
  ),
  pixMissing: t.Boolean(),
  dispute: nullable(
    t.Object({
      reason: nullable(t.String()),
      byName: nullable(t.String()),
      byMe: t.Boolean(),
      at: t.String(),
    })
  ),
  receiptShare: nullable(t.Object({ url: t.String() })),
  proofs: t.Array(
    t.Object({
      id: t.String(),
      fileName: t.String(),
      mimeType: t.String(),
      sizeBytes: t.Integer(),
      downloadUrl: t.String(),
      createdAt: t.String(),
      uploadedByName: nullable(t.String()),
      uploadedByMe: t.Boolean(),
      state: t.Union([t.Literal("current"), t.Literal("disputed")]),
      disputeReason: nullable(t.String()),
    })
  ),
  events: t.Array(
    t.Object({
      id: t.String(),
      type: t.String(),
      actorUserId: nullable(t.String()),
      actorName: nullable(t.String()),
      isMe: t.Boolean(),
      metadata: t.Union([t.Record(t.String(), t.Unknown()), t.Null()]),
      createdAt: t.String(),
    })
  ),
});

/** What the installment panel draws (spec §4.1, mockup 14 §2): one request per open installment. */
export const installmentsModule = new Elysia({ prefix: "/api" }).get(
  "/installments/:installmentId",
  async ({ request, params }) => {
    const { user } = await requireAuth(request.headers);
    const {
      inst,
      contract: c,
      caps,
    } = await loadInstallmentForUser(user.id, params.installmentId); // 404 without access
    const paid = isPaidStatus(inst.status);
    const [proofRows, eventRows, people, share] = await Promise.all([
      db
        .select({
          id: proof.id,
          objectKey: proof.objectKey,
          fileName: proof.fileName,
          mimeType: proof.mimeType,
          sizeBytes: proof.sizeBytes,
          uploadedBy: proof.uploadedBy,
          uploadedByName: userTable.name,
          createdAt: proof.createdAt,
        })
        .from(proof)
        .leftJoin(userTable, eq(proof.uploadedBy, userTable.id))
        .where(eq(proof.installmentId, inst.id))
        .orderBy(desc(proof.createdAt)),
      db
        .select({
          id: auditEvent.id,
          type: auditEvent.type,
          actorUserId: auditEvent.actorUserId,
          actorName: userTable.name,
          metadata: auditEvent.metadata,
          createdAt: auditEvent.createdAt,
        })
        .from(auditEvent)
        .leftJoin(userTable, eq(auditEvent.actorUserId, userTable.id))
        .where(eq(auditEvent.installmentId, inst.id))
        .orderBy(desc(auditEvent.createdAt)),
      db
        .select({
          id: participant.id,
          displayName: participant.displayName,
          linkedUserId: participant.linkedUserId,
          pixKey: participant.pixKey,
          role: participant.role,
        })
        .from(participant)
        .where(eq(participant.contractId, c.id)),
      paid ? findActiveShare(inst.id) : Promise.resolve(null),
    ]);
    const recebedor = pickRecebedor(c, people, await receiverUsers(c, people));
    // Nobody pays a paid installment, and a viewer never pays (no key to them).
    const payable = !paid && caps.role !== "viewer";
    const built = payable ? installmentPix(recebedor, inst.amountCents) : null;
    const states = proofStates(proofRows, eventRows);
    return {
      id: inst.id,
      sequence: inst.sequence,
      amountCents: inst.amountCents,
      dueDate: inst.dueDate,
      status: inst.status,
      paidAt: inst.paidAt?.toISOString() ?? null,
      confirmedAt: inst.confirmedAt?.toISOString() ?? null,
      receiver: {
        name: recebedor.displayName,
        hasAccount: recebedor.hasAccount,
        contactParticipantId: receiverContactId(c, people),
      },
      pix: built
        ? {
            copiaECola: built.code,
            key: built.key,
            keyType: built.keyType,
            payToName: recebedor.displayName ?? "",
            source: built.source,
          }
        : null,
      pixMissing: payable && built === null,
      dispute: latestDispute(inst.status, eventRows, user.id),
      // Built here so the SSR can draw the link (planner's decision 7).
      receiptShare: share
        ? { url: `${env.WEB_ORIGIN}/r/${share.token}` }
        : null,
      proofs: await Promise.all(
        proofRows.map(async (p) => {
          const standing = states.get(p.id);
          return {
            id: p.id,
            fileName: p.fileName,
            mimeType: p.mimeType,
            sizeBytes: p.sizeBytes,
            downloadUrl: await presignDownload(p.objectKey),
            createdAt: p.createdAt.toISOString(),
            uploadedByName: p.uploadedByName ?? null,
            uploadedByMe: p.uploadedBy === user.id,
            state: standing?.state ?? "current",
            disputeReason: standing?.reason ?? null,
          };
        })
      ),
      events: eventRows.map((e) => ({
        id: e.id,
        type: e.type,
        actorUserId: e.actorUserId,
        actorName: e.actorName ?? null,
        isMe: e.actorUserId === user.id,
        metadata: e.metadata as Record<string, unknown> | null,
        createdAt: e.createdAt.toISOString(),
      })),
    };
  },
  {
    params: t.Object({ installmentId: t.String() }),
    response: detailSchema,
  }
);
