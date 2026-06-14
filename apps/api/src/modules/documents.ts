import { type InstallmentStatus, isPaidStatus, todayISO } from "@quitto/shared";
import { eq } from "drizzle-orm";
import { Elysia, t } from "elysia";
import { db } from "../db/client";
import { contract, installment, participant } from "../db/schema";
import { getContractRole } from "../lib/contract-access";
import { buildStatementCsv } from "../lib/documents/csv";
import { buildReceiptModel, buildStatementModel } from "../lib/documents/model";
import { renderReceiptPdf, renderStatementPdf } from "../lib/documents/pdf";
import { ConflictError, NotFoundError } from "../lib/errors";
import { requireAuth } from "../lib/session";

/** ASCII slug for a safe Content-Disposition filename. */
function slug(value: string): string {
  return (
    value
      .normalize("NFKD")
      .replace(/[̀-ͯ]/g, "")
      .replace(/[^a-zA-Z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .toLowerCase()
      .slice(0, 60) || "documento"
  );
}

async function loadContractFor(userId: string, contractId: string) {
  await getContractRole(userId, contractId); // 404 sem acesso
  const [c] = await db
    .select()
    .from(contract)
    .where(eq(contract.id, contractId))
    .limit(1);
  if (!c) {
    throw new NotFoundError("Contrato não encontrado");
  }
  const items = await db
    .select()
    .from(installment)
    .where(eq(installment.contractId, contractId));
  const people = await db
    .select({ role: participant.role, displayName: participant.displayName })
    .from(participant)
    .where(eq(participant.contractId, contractId));
  return { c, items, people };
}

interface DbInstallment {
  amountCents: number;
  dueDate: string;
  paidAt: Date | null;
  sequence: number;
  status: string;
}

function toModelInstallment(it: DbInstallment) {
  return {
    sequence: it.sequence,
    amountCents: it.amountCents,
    dueDate: it.dueDate,
    status: it.status as InstallmentStatus,
    paidAt: it.paidAt ? it.paidAt.toISOString().slice(0, 10) : null,
  };
}

function modelInstallments(items: DbInstallment[]) {
  return items.map(toModelInstallment);
}

function pdfResponse(bytes: Uint8Array, filename: string): Response {
  return new Response(bytes as BodyInit, {
    headers: {
      "content-type": "application/pdf",
      "content-disposition": `attachment; filename="${filename}"`,
    },
  });
}

export const documentsModule = new Elysia({ prefix: "/api" })
  .get(
    "/contracts/:id/statement.pdf",
    async ({ request, params }) => {
      const { user } = await requireAuth(request.headers);
      const { c, items, people } = await loadContractFor(user.id, params.id);
      const model = buildStatementModel(
        { title: c.title, installmentsCount: c.installmentsCount },
        modelInstallments(items),
        people,
        todayISO()
      );
      const bytes = await renderStatementPdf(model);
      return pdfResponse(bytes, `extrato-${slug(c.title)}.pdf`);
    },
    { params: t.Object({ id: t.String() }) }
  )
  .get(
    "/contracts/:id/statement.csv",
    async ({ request, params }) => {
      const { user } = await requireAuth(request.headers);
      const { c, items, people } = await loadContractFor(user.id, params.id);
      const model = buildStatementModel(
        { title: c.title, installmentsCount: c.installmentsCount },
        modelInstallments(items),
        people,
        todayISO()
      );
      const csv = buildStatementCsv(model);
      return new Response(`﻿${csv}`, {
        headers: {
          "content-type": "text/csv; charset=utf-8",
          "content-disposition": `attachment; filename="extrato-${slug(c.title)}.csv"`,
        },
      });
    },
    { params: t.Object({ id: t.String() }) }
  )
  .get(
    "/installments/:installmentId/receipt.pdf",
    async ({ request, params }) => {
      const { user } = await requireAuth(request.headers);
      const [inst] = await db
        .select()
        .from(installment)
        .where(eq(installment.id, params.installmentId))
        .limit(1);
      if (!inst) {
        throw new NotFoundError("Parcela não encontrada");
      }
      const { c, people } = await loadContractFor(user.id, inst.contractId); // 404 sem acesso
      if (!isPaidStatus(inst.status as InstallmentStatus)) {
        throw new ConflictError("A parcela ainda não foi paga");
      }
      const model = buildReceiptModel(
        { title: c.title, installmentsCount: c.installmentsCount },
        toModelInstallment(inst),
        people
      );
      const bytes = await renderReceiptPdf(model);
      return pdfResponse(
        bytes,
        `recibo-${slug(c.title)}-parcela-${inst.sequence}.pdf`
      );
    },
    { params: t.Object({ installmentId: t.String() }) }
  );
