import { AUDIT_TYPE, isPaidStatus } from "@quitto/shared";
import { and, eq, isNull } from "drizzle-orm";
import { Elysia, t } from "elysia";
import { db } from "../db/client";
import { installment, receiptShare } from "../db/schema";
import { recordEvent } from "../lib/audit";
import { getContractRole } from "../lib/contract-access";
import { documentFilename } from "../lib/documents/labels";
import { renderReceiptPdf } from "../lib/documents/pdf";
import { ConflictError, NotFoundError } from "../lib/errors";
import { pickLocale, userLocale } from "../lib/locale";
import { PUBLIC_HEADERS } from "../lib/public-headers";
import {
  findActiveShare,
  newShareToken,
  resolvePublicReceipt,
  toPublicReceipt,
} from "../lib/receipt-share";
import { idParam } from "../lib/route-params";
import { requireAuth } from "../lib/session";
import { pdfResponse } from "./documents";

const UNIQUE_VIOLATION = "23505";

/** Carrega a parcela e exige que o usuário seja o DONO (404 caso contrário). */
async function loadOwnedInstallment(userId: string, installmentId: string) {
  const [inst] = await db
    .select()
    .from(installment)
    .where(eq(installment.id, installmentId))
    .limit(1);
  if (!inst) {
    throw new NotFoundError("Parcela não encontrada");
  }
  const access = await getContractRole(userId, inst.contractId); // 404 sem acesso
  if (!access.isOwner) {
    throw new NotFoundError("Parcela não encontrada");
  }
  return inst;
}

function isUniqueViolation(error: unknown): boolean {
  const e = error as { code?: string; cause?: { code?: string } };
  return e?.code === UNIQUE_VIOLATION || e?.cause?.code === UNIQUE_VIOLATION;
}

const shareView = (s: { token: string; createdAt: Date }) => ({
  token: s.token,
  createdAt: s.createdAt.toISOString(),
});

const shareSchema = t.Object({ token: t.String(), createdAt: t.String() });

const params = t.Object({ installmentId: idParam });

/** Resolve o recibo público; nos 404 também aplica os cabeçalhos públicos. */
async function resolveOrNoStore(
  token: string,
  set: { headers: Record<string, string | number | undefined> }
) {
  Object.assign(set.headers, PUBLIC_HEADERS);
  return await resolvePublicReceipt(token);
}

export const receiptSharesModule = new Elysia({ prefix: "/api" })
  .get(
    "/installments/:installmentId/receipt-share",
    async ({ request, params }) => {
      const { user } = await requireAuth(request.headers);
      await loadOwnedInstallment(user.id, params.installmentId);
      const active = await findActiveShare(params.installmentId);
      if (active) {
        return shareView(active);
      }
      // Elysia serializa `null` como corpo vazio; enviamos o JSON `null` literal
      // e mantemos o tipo (Eden) como `null` via o schema de resposta.
      return Response.json(null) as unknown as null;
    },
    { params, response: t.Union([shareSchema, t.Null()]) }
  )
  .post(
    "/installments/:installmentId/receipt-share",
    async ({ request, params }) => {
      const { user } = await requireAuth(request.headers);
      const inst = await loadOwnedInstallment(user.id, params.installmentId);
      if (!isPaidStatus(inst.status)) {
        throw new ConflictError("A parcela ainda não foi paga");
      }
      const existing = await findActiveShare(inst.id);
      if (existing) {
        return shareView(existing);
      }
      try {
        const created = await db.transaction(async (tx) => {
          const [row] = await tx
            .insert(receiptShare)
            .values({
              installmentId: inst.id,
              token: newShareToken(),
              createdByUserId: user.id,
            })
            .returning({
              token: receiptShare.token,
              createdAt: receiptShare.createdAt,
            });
          await recordEvent(tx, {
            contractId: inst.contractId,
            installmentId: inst.id,
            actorUserId: user.id,
            type: AUDIT_TYPE.receiptShareCreated,
          });
          return row;
        });
        if (!created) {
          throw new Error("insert receipt_share não retornou linha");
        }
        return shareView(created);
      } catch (error) {
        // Corrida: outro POST criou o ativo entre o find e o insert.
        if (isUniqueViolation(error)) {
          const winner = await findActiveShare(inst.id);
          if (winner) {
            return shareView(winner);
          }
        }
        throw error;
      }
    },
    { params }
  )
  .delete(
    "/installments/:installmentId/receipt-share",
    async ({ request, params }) => {
      const { user } = await requireAuth(request.headers);
      const inst = await loadOwnedInstallment(user.id, params.installmentId);
      await db.transaction(async (tx) => {
        const revoked = await tx
          .update(receiptShare)
          .set({ revokedAt: new Date() })
          .where(
            and(
              eq(receiptShare.installmentId, inst.id),
              isNull(receiptShare.revokedAt)
            )
          )
          .returning({ id: receiptShare.id });
        if (revoked.length > 0) {
          await recordEvent(tx, {
            contractId: inst.contractId,
            installmentId: inst.id,
            actorUserId: user.id,
            type: AUDIT_TYPE.receiptShareRevoked,
          });
        }
      });
      return new Response(null, { status: 204 });
    },
    { params }
  )
  .get(
    "/public/receipts/:token",
    async ({ params, set }) => {
      const { model } = await resolveOrNoStore(params.token, set);
      return toPublicReceipt(model);
    },
    { params: t.Object({ token: t.String() }) }
  )
  .get(
    "/public/receipts/:token/receipt.pdf",
    async ({ params, set }) => {
      const { model, ownerId } = await resolveOrNoStore(params.token, set);
      // The page speaks the visitor's language; the PDF the owner's.
      const locale = pickLocale(await userLocale(ownerId));
      const res = pdfResponse(
        await renderReceiptPdf(model, locale),
        documentFilename({
          ext: "pdf",
          kind: "receipt",
          locale,
          sequence: model.sequence,
          title: model.contractTitle,
        })
      );
      for (const [k, v] of Object.entries(PUBLIC_HEADERS)) {
        res.headers.set(k, v);
      }
      return res;
    },
    { params: t.Object({ token: t.String() }) }
  );
