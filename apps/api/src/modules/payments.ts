import { desc, eq } from "drizzle-orm";
import { Elysia, t } from "elysia";
import { db } from "../db/client";
import { auditEvent, contract, installment, proof } from "../db/schema";
import { recordEvent } from "../lib/audit";
import { getContractRole } from "../lib/contract-access";
import { ForbiddenError, NotFoundError, ValidationError } from "../lib/errors";
import { nextStatus } from "../lib/installment-state";
import { requireAuth } from "../lib/session";
import { headObject, presignDownload, presignUpload } from "../lib/storage";

const ALLOWED_MIME = ["application/pdf", "image/jpeg", "image/png"] as const;

// Explicit literal tuple (not `ALLOWED_MIME.map(...)`): a mapped array widens to
// `TSchema[]`, which makes Eden infer the body field as `never` cross-package.
const proofMimeSchema = t.Union([
  t.Literal("application/pdf"),
  t.Literal("image/jpeg"),
  t.Literal("image/png"),
]);

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
        mimeType: proofMimeSchema,
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
      // o tipo do objeto realmente armazenado manda — não confiar só no body
      const storedMime = head.ContentType;
      if (
        !(
          storedMime && (ALLOWED_MIME as readonly string[]).includes(storedMime)
        )
      ) {
        throw new ValidationError(
          "Tipo de arquivo do comprovante não permitido"
        );
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
          mimeType: storedMime,
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
        mimeType: proofMimeSchema,
      }),
      response: t.Object({ status: t.String() }),
    }
  )
  .post(
    "/installments/:installmentId/confirm",
    async ({ request, params }) => {
      const { user } = await requireAuth(request.headers);
      const {
        inst,
        contract: c,
        role,
      } = await loadInstallmentForUser(user.id, params.installmentId);
      if (role !== "owner" && role !== "seller") {
        throw new ForbiddenError("Apenas o vendedor/dono confirma");
      }
      const newStatus = nextStatus(
        inst.status,
        "confirm",
        c.requiresConfirmation
      );
      await db.transaction(async (tx) => {
        await tx
          .update(installment)
          .set({
            status: newStatus,
            confirmedAt: new Date(),
            paidAt: new Date(),
          })
          .where(eq(installment.id, inst.id));
        await recordEvent(tx, {
          contractId: inst.contractId,
          installmentId: inst.id,
          actorUserId: user.id,
          type: "payment_confirmed",
        });
      });
      return { status: newStatus };
    },
    {
      params: t.Object({ installmentId: t.String() }),
      response: t.Object({ status: t.String() }),
    }
  )
  .post(
    "/installments/:installmentId/dispute",
    async ({ request, params, body }) => {
      const { user } = await requireAuth(request.headers);
      const {
        inst,
        contract: c,
        role,
      } = await loadInstallmentForUser(user.id, params.installmentId);
      if (role !== "owner" && role !== "seller") {
        throw new ForbiddenError("Apenas o vendedor/dono contesta");
      }
      const newStatus = nextStatus(
        inst.status,
        "dispute",
        c.requiresConfirmation
      );
      await db.transaction(async (tx) => {
        await tx
          .update(installment)
          .set({ status: newStatus })
          .where(eq(installment.id, inst.id));
        await recordEvent(tx, {
          contractId: inst.contractId,
          installmentId: inst.id,
          actorUserId: user.id,
          type: "payment_disputed",
          metadata: body.reason ? { reason: body.reason } : undefined,
        });
      });
      return { status: newStatus };
    },
    {
      params: t.Object({ installmentId: t.String() }),
      body: t.Object({ reason: t.Optional(t.String({ maxLength: 500 })) }),
      response: t.Object({ status: t.String() }),
    }
  )
  .post(
    "/installments/:installmentId/mark-paid",
    async ({ request, params }) => {
      const { user } = await requireAuth(request.headers);
      const {
        inst,
        contract: c,
        role,
      } = await loadInstallmentForUser(user.id, params.installmentId);
      if (role !== "owner" && role !== "buyer") {
        throw new ForbiddenError("Apenas o comprador/dono marca como paga");
      }
      const newStatus = nextStatus(
        inst.status,
        "mark_paid",
        c.requiresConfirmation
      );
      await db.transaction(async (tx) => {
        await tx
          .update(installment)
          .set({ status: newStatus, paidAt: new Date() })
          .where(eq(installment.id, inst.id));
        await recordEvent(tx, {
          contractId: inst.contractId,
          installmentId: inst.id,
          actorUserId: user.id,
          type: "installment_paid",
        });
      });
      return { status: newStatus };
    },
    {
      params: t.Object({ installmentId: t.String() }),
      response: t.Object({ status: t.String() }),
    }
  )
  .get(
    "/installments/:installmentId",
    async ({ request, params }) => {
      const { user } = await requireAuth(request.headers);
      const { inst } = await loadInstallmentForUser(
        user.id,
        params.installmentId
      ); // 404 se sem acesso

      const proofs = await db
        .select()
        .from(proof)
        .where(eq(proof.installmentId, inst.id));
      const events = await db
        .select()
        .from(auditEvent)
        .where(eq(auditEvent.installmentId, inst.id))
        .orderBy(desc(auditEvent.createdAt));

      const proofsOut = await Promise.all(
        proofs.map(async (p) => ({
          id: p.id,
          fileName: p.fileName,
          mimeType: p.mimeType,
          sizeBytes: p.sizeBytes,
          downloadUrl: await presignDownload(p.objectKey),
          createdAt: p.createdAt.toISOString(),
        }))
      );

      return {
        id: inst.id,
        sequence: inst.sequence,
        amountCents: inst.amountCents,
        dueDate: inst.dueDate,
        status: inst.status,
        proofs: proofsOut,
        events: events.map((e) => ({
          id: e.id,
          type: e.type,
          actorUserId: e.actorUserId,
          metadata: e.metadata as Record<string, unknown> | null,
          createdAt: e.createdAt.toISOString(),
        })),
      };
    },
    {
      params: t.Object({ installmentId: t.String() }),
      response: t.Object({
        id: t.String(),
        sequence: t.Integer(),
        amountCents: t.Integer(),
        dueDate: t.String(),
        status: t.String(),
        proofs: t.Array(
          t.Object({
            id: t.String(),
            fileName: t.String(),
            mimeType: t.String(),
            sizeBytes: t.Integer(),
            downloadUrl: t.String(),
            createdAt: t.String(),
          })
        ),
        events: t.Array(
          t.Object({
            id: t.String(),
            type: t.String(),
            actorUserId: t.Union([t.String(), t.Null()]),
            metadata: t.Union([t.Record(t.String(), t.Unknown()), t.Null()]),
            createdAt: t.String(),
          })
        ),
      }),
    }
  );
