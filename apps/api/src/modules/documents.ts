import { type InstallmentStatus, isPaidStatus, todayISO } from "@quitto/shared";
import { eq } from "drizzle-orm";
import { Elysia, t } from "elysia";
import { db } from "../db/client";
import { contract, installment, participant } from "../db/schema";
import { getContractRole } from "../lib/contract-access";
import { buildStatementCsv } from "../lib/documents/csv";
import { documentFilename } from "../lib/documents/labels";
import {
  buildReceiptModel,
  buildStatementModel,
  type DbInstallment,
  toModelInstallment,
} from "../lib/documents/model";
import { renderReceiptPdf, renderStatementPdf } from "../lib/documents/pdf";
import { ConflictError, NotFoundError } from "../lib/errors";
import { localeFromHeaders, pickLocale, userLocale } from "../lib/locale";
import { idParam } from "../lib/route-params";
import { requireAuth } from "../lib/session";

/** The language of a download: the caller's account, then the request, then pt-BR. */
async function downloadLocale(userId: string, headers: Headers) {
  return pickLocale(await userLocale(userId), localeFromHeaders(headers));
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

function modelInstallments(items: DbInstallment[]) {
  return items.map(toModelInstallment);
}

export function pdfResponse(bytes: Uint8Array, filename: string): Response {
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
      const locale = await downloadLocale(user.id, request.headers);
      const bytes = await renderStatementPdf(model, locale);
      return pdfResponse(
        bytes,
        documentFilename({
          ext: "pdf",
          kind: "statement",
          locale,
          title: c.title,
        })
      );
    },
    { params: t.Object({ id: idParam }) }
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
      const locale = await downloadLocale(user.id, request.headers);
      const csv = buildStatementCsv(model, locale);
      return new Response(`﻿${csv}`, {
        headers: {
          "content-type": "text/csv; charset=utf-8",
          "content-disposition": `attachment; filename="${documentFilename({
            ext: "csv",
            kind: "statement",
            locale,
            title: c.title,
          })}"`,
        },
      });
    },
    { params: t.Object({ id: idParam }) }
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
      const locale = await downloadLocale(user.id, request.headers);
      const bytes = await renderReceiptPdf(model, locale);
      return pdfResponse(
        bytes,
        documentFilename({
          ext: "pdf",
          kind: "receipt",
          locale,
          sequence: inst.sequence,
          title: c.title,
        })
      );
    },
    { params: t.Object({ installmentId: idParam }) }
  );
