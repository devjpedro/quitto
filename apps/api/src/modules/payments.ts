import {
  AUDIT_TYPE,
  INSTALLMENT_STATUS,
  NOTIFICATION_TYPE,
} from "@quitto/shared";
import { Elysia, t } from "elysia";
import { db } from "../db/client";
import { proof } from "../db/schema";
import { recordEvent } from "../lib/audit";
import { ForbiddenError, ValidationError } from "../lib/errors";
import {
  installmentEntitySchema,
  loadInstallmentForUser,
  toInstallmentEntity,
  transitionInstallment,
} from "../lib/installment-access";
import { nextStatus } from "../lib/installment-state";
import { notifyTarget } from "../lib/notifications";
import { idParam } from "../lib/route-params";
import { requireAuth } from "../lib/session";
import { headObject, presignUpload } from "../lib/storage";

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
      const { inst, caps } = await loadInstallmentForUser(
        user.id,
        params.installmentId
      );
      if (!caps.isPayer) {
        throw new ForbiddenError("Apenas o comprador/dono anexa comprovante");
      }
      const safeName = body.fileName.replace(/[^\w.-]/g, "_").slice(0, 120);
      const objectKey = `proofs/${inst.contractId}/${inst.id}/${crypto.randomUUID()}-${safeName}`;
      const uploadUrl = await presignUpload(objectKey, body.mimeType);
      return { uploadUrl, objectKey };
    },
    {
      params: t.Object({ installmentId: idParam }),
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
        caps,
      } = await loadInstallmentForUser(user.id, params.installmentId);
      if (!caps.isPayer) {
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

      const updated = await db.transaction(async (tx) => {
        await tx.insert(proof).values({
          installmentId: inst.id,
          objectKey: body.objectKey,
          fileName: body.fileName,
          mimeType: storedMime,
          sizeBytes,
          uploadedBy: user.id,
        });
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
