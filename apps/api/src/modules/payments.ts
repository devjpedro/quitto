import { eq } from "drizzle-orm";
import { Elysia, t } from "elysia";
import { db } from "../db/client";
import { contract, installment, proof } from "../db/schema";
import { recordEvent } from "../lib/audit";
import { getContractRole } from "../lib/contract-access";
import { ForbiddenError, NotFoundError, ValidationError } from "../lib/errors";
import { nextStatus } from "../lib/installment-state";
import { requireAuth } from "../lib/session";
import { headObject, presignUpload } from "../lib/storage";

const ALLOWED_MIME = ["application/pdf", "image/jpeg", "image/png"] as const;

/** Loads installment + parent contract and the caller's role. Throws 404 if no access. */
async function loadInstallmentForUser(userId: string, installmentId: string) {
  const [inst] = await db
    .select()
    .from(installment)
    .where(eq(installment.id, installmentId))
    .limit(1);
  if (!inst) {
    throw new NotFoundError("Parcela não encontrada");
  }
  const role = await getContractRole(userId, inst.contractId); // 404 se sem acesso
  const [c] = await db
    .select()
    .from(contract)
    .where(eq(contract.id, inst.contractId))
    .limit(1);
  if (!c) {
    throw new NotFoundError("Contrato não encontrado");
  }
  return { inst, contract: c, role };
}

export const paymentsModule = new Elysia({ prefix: "/api" })
  .post(
    "/installments/:installmentId/proofs/presign",
    async ({ request, params, body }) => {
      const { user } = await requireAuth(request.headers);
      const { inst, role } = await loadInstallmentForUser(
        user.id,
        params.installmentId
      );
      if (role !== "owner" && role !== "buyer") {
        throw new ForbiddenError("Apenas o comprador/dono anexa comprovante");
      }
      const safeName = body.fileName.replace(/[^\w.-]/g, "_").slice(0, 120);
      const objectKey = `proofs/${inst.contractId}/${inst.id}/${crypto.randomUUID()}-${safeName}`;
      const uploadUrl = await presignUpload(objectKey, body.mimeType);
      return { uploadUrl, objectKey };
    },
    {
      params: t.Object({ installmentId: t.String() }),
      body: t.Object({
        fileName: t.String({ minLength: 1, maxLength: 200 }),
        mimeType: t.Union(ALLOWED_MIME.map((m) => t.Literal(m))),
      }),
      response: t.Object({ uploadUrl: t.String(), objectKey: t.String() }),
    }
  )
  .post(
    "/installments/:installmentId/proofs",
    async ({ request, params, body }) => {
      const { user } = await requireAuth(request.headers);
      const {
        inst,
        contract: c,
        role,
      } = await loadInstallmentForUser(user.id, params.installmentId);
      if (role !== "owner" && role !== "buyer") {
        throw new ForbiddenError("Apenas o comprador/dono anexa comprovante");
      }

      // valida que o objeto realmente subiu (e tamanho/tipo coerentes)
      const head = await headObject(body.objectKey).catch(() => null);
      if (!head) {
        throw new ValidationError("Comprovante não encontrado no storage");
      }
      const sizeBytes = head.ContentLength ?? 0;
      if (sizeBytes <= 0 || sizeBytes > 10 * 1024 * 1024) {
        throw new ValidationError("Arquivo inválido (vazio ou maior que 10MB)");
      }

      const newStatus = nextStatus(
        inst.status,
        "submit_proof",
        c.requiresConfirmation
      );

      await db.transaction(async (tx) => {
        await tx.insert(proof).values({
          installmentId: inst.id,
          objectKey: body.objectKey,
          fileName: body.fileName,
          mimeType: body.mimeType,
          sizeBytes,
          uploadedBy: user.id,
        });
        await tx
          .update(installment)
          .set({
            status: newStatus,
            ...(newStatus === "paid" ? { paidAt: new Date() } : {}),
          })
          .where(eq(installment.id, inst.id));
        await recordEvent(tx, {
          contractId: inst.contractId,
          installmentId: inst.id,
          actorUserId: user.id,
          type: c.requiresConfirmation ? "proof_submitted" : "installment_paid",
          metadata: { fileName: body.fileName },
        });
      });

      return { status: newStatus };
    },
    {
      params: t.Object({ installmentId: t.String() }),
      body: t.Object({
        objectKey: t.String({ minLength: 1 }),
        fileName: t.String({ minLength: 1, maxLength: 200 }),
        mimeType: t.Union(ALLOWED_MIME.map((m) => t.Literal(m))),
      }),
      response: t.Object({ status: t.String() }),
    }
  );
