import {
  AUDIT_TYPE,
  INSTALLMENT_STATUS,
  isPaidStatus,
  NOTIFICATION_TYPE,
} from "@quitto/shared";
import { count, eq } from "drizzle-orm";
import { Elysia, t } from "elysia";
import { db } from "../db/client";
import { proof } from "../db/schema";
import { recordEvent } from "../lib/audit";
import {
  ForbiddenError,
  RateLimitedError,
  ValidationError,
} from "../lib/errors";
import {
  installmentEntitySchema,
  loadInstallmentForUser,
  toInstallmentEntity,
  transitionInstallment,
} from "../lib/installment-access";
import { type InstallmentStatus, nextStatus } from "../lib/installment-state";
import { notifyTarget } from "../lib/notifications";
import { createRateLimiter, rateLimitOn } from "../lib/rate-limit";
import { idParam } from "../lib/route-params";
import { requireAuth } from "../lib/session";
import {
  copyObject,
  deleteObject,
  headObject,
  presignUpload,
} from "../lib/storage";

const MAX_PROOF_BYTES = 10 * 1024 * 1024;
const MAX_PROOFS_PER_INSTALLMENT = 5;

/** Presigns per user: each one is a URL that can write to the bucket (cost). */
const presignLimiter = createRateLimiter({ max: 20, windowMs: 3_600_000 });

/**
 * Whether the installment still takes a proof, and the status it moves to. One
 * proof at most on an installment registered as paid at creation (it is only
 * attached); five on any other; and the state machine must accept the send.
 */
async function proofIntake(
  inst: { id: string; status: InstallmentStatus; registeredOnCreate: boolean },
  requiresConfirmation: boolean
): Promise<{ attachOnly: boolean; newStatus: InstallmentStatus }> {
  const attachOnly = inst.registeredOnCreate && isPaidStatus(inst.status);
  const [row] = await db
    .select({ n: count() })
    .from(proof)
    .where(eq(proof.installmentId, inst.id));
  const sent = row?.n ?? 0;
  if (sent >= (attachOnly ? 1 : MAX_PROOFS_PER_INSTALLMENT)) {
    throw new ValidationError("Limite de comprovantes da parcela atingido");
  }
  const newStatus = attachOnly
    ? inst.status
    : nextStatus(inst.status, "submit_proof", requiresConfirmation);
  return { attachOnly, newStatus };
}
const ALLOWED_MIME = ["application/pdf", "image/jpeg", "image/png"] as const;

// Explicit literal tuple (not `ALLOWED_MIME.map(...)`): a mapped array widens to
// `TSchema[]`, which makes Eden infer the body field as `never` cross-package.
const proofMimeSchema = t.Union([
  t.Literal("application/pdf"),
  t.Literal("image/jpeg"),
  t.Literal("image/png"),
]);

export const paymentsModule = new Elysia({ prefix: "/api" })
  .post(
    "/installments/:installmentId/proofs/presign",
    async ({ request, params, body }) => {
      const { user } = await requireAuth(request.headers);
      if (rateLimitOn() && !presignLimiter.hit(user.id)) {
        throw new RateLimitedError(
          "Muitos envios de comprovante. Tente mais tarde."
        );
      }
      const {
        inst,
        contract: c,
        caps,
      } = await loadInstallmentForUser(user.id, params.installmentId);
      if (!caps.isPayer) {
        throw new ForbiddenError("Apenas o comprador/dono anexa comprovante");
      }
      await proofIntake(inst, c.requiresConfirmation);
      const safeName = body.fileName.replace(/[^\w.-]/g, "_").slice(0, 120);
      const objectKey = `incoming/${inst.contractId}/${inst.id}/${crypto.randomUUID()}-${safeName}`;
      const uploadUrl = await presignUpload(
        objectKey,
        body.mimeType,
        body.sizeBytes
      );
      return { uploadUrl, objectKey };
    },
    {
      params: t.Object({ installmentId: idParam }),
      body: t.Object({
        fileName: t.String({ minLength: 1, maxLength: 200 }),
        mimeType: proofMimeSchema,
        sizeBytes: t.Integer({ minimum: 1, maximum: MAX_PROOF_BYTES }),
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
        caps,
      } = await loadInstallmentForUser(user.id, params.installmentId);
      if (!caps.isPayer) {
        throw new ForbiddenError("Apenas o comprador/dono anexa comprovante");
      }

      // a chave tem de ser da própria parcela, no formato exato que o presign gera
      const incomingKey = new RegExp(
        `^incoming/${inst.contractId}/${inst.id}/([0-9a-f-]{36}-[\\w.-]{1,120})$`
      ).exec(body.objectKey);
      if (!incomingKey) {
        throw new ValidationError("Comprovante não pertence à parcela");
      }

      // a parcela ainda aceita comprovante (teto e estado), antes de mexer no storage
      const { attachOnly, newStatus } = await proofIntake(
        inst,
        c.requiresConfirmation
      );

      // valida que o objeto realmente subiu (e tamanho/tipo coerentes)
      const head = await headObject(body.objectKey).catch(() => null);
      if (!head) {
        throw new ValidationError("Comprovante não encontrado no storage");
      }
      const sizeBytes = head.ContentLength ?? 0;
      // o tipo do objeto realmente armazenado manda — não confiar só no body
      const storedMime = head.ContentType;
      const badSize = sizeBytes <= 0 || sizeBytes > MAX_PROOF_BYTES;
      const badMime = !(
        storedMime && (ALLOWED_MIME as readonly string[]).includes(storedMime)
      );
      if (badSize || badMime) {
        // rejeitado não fica no bucket
        await deleteObject(body.objectKey).catch(() => undefined);
        throw new ValidationError(
          badSize
            ? "Arquivo inválido (vazio ou maior que 10MB)"
            : "Tipo de arquivo do comprovante não permitido"
        );
      }

      // só o que passou na checagem sai de incoming/ para proofs/
      const finalKey = `proofs/${inst.contractId}/${inst.id}/${incomingKey[1]}`;
      await copyObject(body.objectKey, finalKey);
      await deleteObject(body.objectKey).catch(() => undefined);

      const updated = await db.transaction(async (tx) => {
        await tx.insert(proof).values({
          installmentId: inst.id,
          objectKey: finalKey,
          fileName: body.fileName,
          mimeType: storedMime,
          sizeBytes,
          uploadedBy: user.id,
        });
        if (attachOnly) {
          return inst;
        }
        const row = await transitionInstallment(tx, inst, {
          status: newStatus,
          ...(newStatus === "paid" ? { paidAt: new Date() } : {}),
        });
        await recordEvent(tx, {
          contractId: inst.contractId,
          installmentId: inst.id,
          actorUserId: user.id,
          type: c.requiresConfirmation ? "proof_submitted" : "installment_paid",
          metadata: { fileName: body.fileName, sizeBytes },
        });
        await notifyTarget(tx, {
          contractId: inst.contractId,
          installmentId: inst.id,
          actorUserId: user.id,
          target: "approver",
          type: c.requiresConfirmation
            ? NOTIFICATION_TYPE.proofSubmitted
            : NOTIFICATION_TYPE.installmentPaid,
          metadata: { fileName: body.fileName },
        });
        return row;
      });

      return toInstallmentEntity(updated);
    },
    {
      params: t.Object({ installmentId: idParam }),
      body: t.Object({
        objectKey: t.String({ minLength: 1 }),
        fileName: t.String({ minLength: 1, maxLength: 200 }),
        mimeType: proofMimeSchema,
      }),
      response: installmentEntitySchema,
    }
  )
  .post(
    "/installments/:installmentId/confirm",
    async ({ request, params }) => {
      const { user } = await requireAuth(request.headers);
      const {
        inst,
        contract: c,
        caps,
      } = await loadInstallmentForUser(user.id, params.installmentId);
      if (!caps.isApprover) {
        throw new ForbiddenError("Apenas o vendedor/dono confirma");
      }
      const newStatus = nextStatus(
        inst.status,
        "confirm",
        c.requiresConfirmation
      );
      const updated = await db.transaction(async (tx) => {
        const row = await transitionInstallment(tx, inst, {
          status: newStatus,
          confirmedAt: new Date(),
          paidAt: new Date(),
        });
        await recordEvent(tx, {
          contractId: inst.contractId,
          installmentId: inst.id,
          actorUserId: user.id,
          type: "payment_confirmed",
        });
        await notifyTarget(tx, {
          contractId: inst.contractId,
          installmentId: inst.id,
          actorUserId: user.id,
          target: "payer",
          type: NOTIFICATION_TYPE.paymentConfirmed,
        });
        return row;
      });
      return toInstallmentEntity(updated);
    },
    {
      params: t.Object({ installmentId: idParam }),
      response: installmentEntitySchema,
    }
  )
  .post(
    "/installments/:installmentId/dispute",
    async ({ request, params, body }) => {
      const { user } = await requireAuth(request.headers);
      const {
        inst,
        contract: c,
        caps,
      } = await loadInstallmentForUser(user.id, params.installmentId);
      if (!caps.isApprover) {
        throw new ForbiddenError("Apenas o vendedor/dono contesta");
      }
      const newStatus = nextStatus(
        inst.status,
        "dispute",
        c.requiresConfirmation
      );
      const updated = await db.transaction(async (tx) => {
        const row = await transitionInstallment(tx, inst, {
          status: newStatus,
        });
        await recordEvent(tx, {
          contractId: inst.contractId,
          installmentId: inst.id,
          actorUserId: user.id,
          type: "payment_disputed",
          metadata: body.reason ? { reason: body.reason } : undefined,
        });
        await notifyTarget(tx, {
          contractId: inst.contractId,
          installmentId: inst.id,
          actorUserId: user.id,
          target: "payer",
          type: NOTIFICATION_TYPE.paymentDisputed,
          metadata: body.reason ? { reason: body.reason } : null,
        });
        return row;
      });
      return toInstallmentEntity(updated);
    },
    {
      params: t.Object({ installmentId: idParam }),
      body: t.Object({ reason: t.Optional(t.String({ maxLength: 500 })) }),
      response: installmentEntitySchema,
    }
  )
  .post(
    "/installments/:installmentId/mark-paid",
    async ({ request, params }) => {
      const { user } = await requireAuth(request.headers);
      const {
        inst,
        contract: c,
        caps,
      } = await loadInstallmentForUser(user.id, params.installmentId);
      if (!caps.isPayer) {
        throw new ForbiddenError("Apenas o comprador/dono marca como paga");
      }
      const newStatus = nextStatus(
        inst.status,
        "mark_paid",
        c.requiresConfirmation
      );
      const updated = await db.transaction(async (tx) => {
        const row = await transitionInstallment(tx, inst, {
          status: newStatus,
          paidAt: new Date(),
        });
        await recordEvent(tx, {
          contractId: inst.contractId,
          installmentId: inst.id,
          actorUserId: user.id,
          type: "installment_paid",
        });
        await notifyTarget(tx, {
          contractId: inst.contractId,
          installmentId: inst.id,
          actorUserId: user.id,
          target: "approver",
          type: NOTIFICATION_TYPE.installmentPaid,
        });
        return row;
      });
      return toInstallmentEntity(updated);
    },
    {
      params: t.Object({ installmentId: idParam }),
      response: installmentEntitySchema,
    }
  )
  .post(
    "/installments/:installmentId/mark-received",
    async ({ request, params }) => {
      const { user } = await requireAuth(request.headers);
      const {
        inst,
        contract: c,
        caps,
      } = await loadInstallmentForUser(user.id, params.installmentId);
      if (!caps.isApprover) {
        throw new ForbiddenError("Apenas quem recebe marca como recebida");
      }
      const newStatus = nextStatus(
        inst.status,
        "mark_received",
        c.requiresConfirmation
      );
      const now = new Date();
      const updated = await db.transaction(async (tx) => {
        const row = await transitionInstallment(tx, inst, {
          status: newStatus,
          paidAt: now,
          ...(newStatus === INSTALLMENT_STATUS.confirmed
            ? { confirmedAt: now }
            : {}),
        });
        await recordEvent(tx, {
          contractId: inst.contractId,
          installmentId: inst.id,
          actorUserId: user.id,
          type: AUDIT_TYPE.installmentReceived,
        });
        // The payer reads it as "payment confirmed" (planner's decision 4).
        await notifyTarget(tx, {
          contractId: inst.contractId,
          installmentId: inst.id,
          actorUserId: user.id,
          target: "payer",
          type: NOTIFICATION_TYPE.paymentConfirmed,
          metadata: { markedReceived: true },
        });
        return row;
      });
      return toInstallmentEntity(updated);
    },
    {
      params: t.Object({ installmentId: idParam }),
      response: installmentEntitySchema,
    }
  );
