import { INSTALLMENT_STATUS } from "@quitto/shared";
import PDFDocument from "pdfkit";
import { formatISODateBR } from "../dates";
import { formatCentsBRL } from "../money";
import { DOC_INSTALLMENT_STATUS_LABEL, DOC_TEXT } from "./labels";
import type { ReceiptModel, StatementModel } from "./model";
import { DOC_STYLE } from "./style";

type Doc = PDFKit.PDFDocument;

const { color, font, size, margin } = DOC_STYLE;

function collect(doc: Doc): Promise<Uint8Array> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    doc.on("data", (c: Buffer) => chunks.push(c));
    doc.on("end", () => resolve(new Uint8Array(Buffer.concat(chunks))));
    doc.on("error", reject);
    doc.end();
  });
}

function header(doc: Doc, title: string): number {
  doc
    .font(font.bold)
    .fontSize(size.brand)
    .fillColor(color.brand)
    .text(DOC_TEXT.brand, margin, margin, { continued: false });
  doc
    .font(font.bold)
    .fontSize(size.heading)
    .fillColor(color.muted)
    .text(title, margin, margin + 4, { align: "right" });
  const y = margin + 28;
  doc
    .moveTo(margin, y)
    .lineTo(doc.page.width - margin, y)
    .strokeColor(color.brand)
    .lineWidth(1)
    .stroke();
  doc.fillColor(color.text);
  return y + 16;
}

function footer(doc: Doc): void {
  const y = doc.page.height - margin;
  doc
    .font(font.body)
    .fontSize(size.small)
    .fillColor(color.muted)
    .text(
      DOC_TEXT.generatedAt(
        formatISODateBR(new Date().toISOString().slice(0, 10))
      ),
      margin,
      y - 10,
      {
        width: doc.page.width - margin * 2,
        align: "center",
      }
    );
}

function metaRow(doc: Doc, label: string, value: string, y: number): number {
  doc
    .font(font.body)
    .fontSize(size.small)
    .fillColor(color.muted)
    .text(label, margin, y);
  doc
    .font(font.bold)
    .fontSize(size.body)
    .fillColor(color.text)
    .text(value, margin, y + 10);
  return y + 30;
}

export function renderReceiptPdf(model: ReceiptModel): Promise<Uint8Array> {
  const doc = new PDFDocument({ size: "A4", margin });
  let y = header(doc, DOC_TEXT.receiptTitle);

  doc
    .font(font.bold)
    .fontSize(size.title)
    .fillColor(color.text)
    .text(model.contractTitle, margin, y);
  y = doc.y + 4;
  doc
    .font(font.body)
    .fontSize(size.body)
    .fillColor(color.muted)
    .text(
      DOC_TEXT.installmentOfTotal(model.sequence, model.installmentsCount),
      margin,
      y
    );
  y = doc.y + 16;

  y = metaRow(
    doc,
    DOC_TEXT.payerLabel,
    model.parties.payerName ?? DOC_TEXT.emptyParty,
    y
  );
  y = metaRow(
    doc,
    DOC_TEXT.receiverLabel,
    model.parties.receiverName ?? DOC_TEXT.emptyParty,
    y
  );

  doc
    .font(font.body)
    .fontSize(size.small)
    .fillColor(color.muted)
    .text(DOC_TEXT.amountLabel, margin, y);
  doc
    .font(font.bold)
    .fontSize(size.amount)
    .fillColor(color.brand)
    .text(formatCentsBRL(model.amountCents), margin, y + 10);
  y = doc.y + 16;

  y = metaRow(doc, DOC_TEXT.dueDateLabel, formatISODateBR(model.dueDate), y);
  y = metaRow(
    doc,
    DOC_TEXT.paidAtLabel,
    model.paidAt ? formatISODateBR(model.paidAt) : DOC_TEXT.emptyParty,
    y
  );

  doc
    .font(font.body)
    .fontSize(size.body)
    .fillColor(color.text)
    .text(
      DOC_TEXT.receiptSentence(
        formatCentsBRL(model.amountCents),
        model.sequence,
        model.installmentsCount,
        model.contractTitle,
        model.paidAt ? formatISODateBR(model.paidAt) : ""
      ),
      margin,
      y + 10,
      { width: doc.page.width - margin * 2 }
    );

  footer(doc);
  return collect(doc);
}

const COL = { seq: 40, due: 110, amount: 120, status: 130, paid: 110 };

function statusColor(status: string): string {
  if (
    status === INSTALLMENT_STATUS.paid ||
    status === INSTALLMENT_STATUS.confirmed
  ) {
    return color.paid;
  }
  if (status === INSTALLMENT_STATUS.disputed) {
    return color.overdue;
  }
  return color.pending;
}

export function renderStatementPdf(model: StatementModel): Promise<Uint8Array> {
  const doc = new PDFDocument({ size: "A4", margin });
  let y = header(doc, DOC_TEXT.statementTitle);

  doc
    .font(font.bold)
    .fontSize(size.title)
    .fillColor(color.text)
    .text(model.contractTitle, margin, y);
  y = doc.y + 6;
  doc
    .font(font.body)
    .fontSize(size.body)
    .fillColor(color.muted)
    .text(
      `${DOC_TEXT.payerLabel}: ${model.parties.payerName ?? DOC_TEXT.emptyParty}   .   ${DOC_TEXT.receiverLabel}: ${model.parties.receiverName ?? DOC_TEXT.emptyParty}`,
      margin,
      y
    );
  y = doc.y + 6;
  doc.text(
    DOC_TEXT.progressSummary(
      formatCentsBRL(model.progress.totalCents),
      formatCentsBRL(model.progress.paidCents),
      model.progress.percent,
      model.progress.overdueCount
    ),
    margin,
    y
  );
  y = doc.y + 10;

  if (model.isFullyPaid) {
    doc
      .font(font.bold)
      .fontSize(size.heading)
      .fillColor(color.paid)
      .text(DOC_TEXT.paidSeal, margin, y);
    y = doc.y + 2;
    doc
      .font(font.body)
      .fontSize(size.small)
      .fillColor(color.muted)
      .text(
        DOC_TEXT.quittanceSentence(
          model.contractTitle,
          model.fullyPaidAt ? formatISODateBR(model.fullyPaidAt) : ""
        ),
        margin,
        y
      );
    y = doc.y + 10;
  }

  const widths = [COL.seq, COL.due, COL.amount, COL.status, COL.paid];
  const tableWidth = widths.reduce((a, b) => a + b, 0);

  const drawTableHeader = (top: number): number => {
    let x = margin;
    doc.font(font.bold).fontSize(size.small).fillColor(color.brand);
    DOC_TEXT.tableHeaders.forEach((h, i) => {
      const w = widths[i] ?? 0;
      doc.text(h, x + 2, top + 4, { width: w - 4 });
      x += w;
    });
    const hy = top + 18;
    doc
      .moveTo(margin, hy)
      .lineTo(margin + tableWidth, hy)
      .strokeColor(color.line)
      .lineWidth(0.5)
      .stroke();
    return hy + 4;
  };

  y = drawTableHeader(y);
  const rowH = 18;

  model.rows.forEach((r, idx) => {
    if (y + rowH > doc.page.height - margin - 20) {
      doc.addPage();
      y = drawTableHeader(margin);
    }
    if (idx % 2 === 1) {
      doc
        .rect(margin, y - 2, tableWidth, rowH)
        .fillColor(color.zebra)
        .fill();
    }
    let x = margin;
    const cells = [
      String(r.sequence),
      formatISODateBR(r.dueDate),
      formatCentsBRL(r.amountCents),
      DOC_INSTALLMENT_STATUS_LABEL[r.status],
      r.paidAt ? formatISODateBR(r.paidAt) : "—",
    ];
    cells.forEach((c, i) => {
      const w = widths[i] ?? 0;
      doc
        .font(font.body)
        .fontSize(size.small)
        .fillColor(i === 3 ? statusColor(r.status) : color.text)
        .text(c, x + 2, y, { width: w - 4 });
      x += w;
    });
    y += rowH;
  });

  footer(doc);
  return collect(doc);
}
