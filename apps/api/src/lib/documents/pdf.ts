import { INSTALLMENT_STATUS, type Locale, todayISO } from "@quitto/shared";
import PDFDocument from "pdfkit";
import { formatISODate } from "../dates";
import { formatCents } from "../money";
import { type DocText, docStatusLabel, docText } from "./labels";
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

const ICON_BOX = 24;
const ICON_ARC = { startDeg: 125, sweepDeg: 254.6 };

/** The app icon in vector: a Floresta square and the logo's open ring (geometry of apps/web ring-geometry.ts: radius 9 of 24, stroke 4, ~70% of the ring, opening turned 125°). */
function drawIcon(doc: Doc, x: number, y: number, box: number): void {
  const k = box / ICON_BOX;
  doc
    .roundedRect(x, y, box, box, box * 0.25)
    .fillColor(color.brand)
    .fill();
  const r = 9 * k;
  const cx = x + box / 2;
  const cy = y + box / 2;
  const point = (deg: number) => {
    const rad = (deg * Math.PI) / 180;
    return [cx + r * Math.cos(rad), cy + r * Math.sin(rad)] as const;
  };
  const [x0, y0] = point(ICON_ARC.startDeg);
  const [x1, y1] = point(ICON_ARC.startDeg + ICON_ARC.sweepDeg);
  doc
    .path(`M ${x0} ${y0} A ${r} ${r} 0 1 1 ${x1} ${y1}`)
    .lineWidth(4 * k)
    .lineCap("round")
    .strokeColor("#FFFFFF")
    .stroke();
  doc.lineCap("butt");
}

function header(doc: Doc, title: string): number {
  drawIcon(doc, margin, margin, size.icon);
  doc
    .font(font.bold)
    .fontSize(size.heading)
    .fillColor(color.muted)
    .text(title, margin, margin + 7, {
      align: "right",
      width: doc.page.width - margin * 2,
    });
  const y = margin + size.icon + 12;
  doc
    .moveTo(margin, y)
    .lineTo(doc.page.width - margin, y)
    .strokeColor(color.line)
    .lineWidth(1)
    .stroke();
  doc.fillColor(color.text);
  return y + 16;
}

function footer(doc: Doc, t: DocText, locale: Locale): void {
  const y = doc.page.height - margin;
  doc
    .font(font.body)
    .fontSize(size.small)
    .fillColor(color.muted)
    .text(
      t.generatedAt({ date: formatISODate(todayISO(), locale) }),
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

export function renderReceiptPdf(
  model: ReceiptModel,
  locale: Locale
): Promise<Uint8Array> {
  const t = docText(locale);
  const doc = new PDFDocument({ size: "A4", margin });
  let y = header(doc, t.receiptTitle);

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
      t.installmentOfTotal({
        n: model.sequence,
        total: model.installmentsCount,
      }),
      margin,
      y
    );
  y = doc.y + 16;

  y = metaRow(doc, t.payer, model.parties.payerName ?? t.emptyParty, y);
  y = metaRow(doc, t.receiver, model.parties.receiverName ?? t.emptyParty, y);

  doc
    .font(font.body)
    .fontSize(size.small)
    .fillColor(color.muted)
    .text(t.amount, margin, y);
  doc
    .font(font.bold)
    .fontSize(size.amount)
    .fillColor(color.brand)
    .text(formatCents(model.amountCents, locale), margin, y + 10);
  y = doc.y + 16;

  y = metaRow(doc, t.dueDate, formatISODate(model.dueDate, locale), y);
  y = metaRow(
    doc,
    t.paidAt,
    model.paidAt ? formatISODate(model.paidAt, locale) : t.emptyParty,
    y
  );

  doc
    .font(font.body)
    .fontSize(size.body)
    .fillColor(color.text)
    .text(
      t.receiptSentence({
        amount: formatCents(model.amountCents, locale),
        n: model.sequence,
        total: model.installmentsCount,
        title: model.contractTitle,
        paidAt: model.paidAt ? formatISODate(model.paidAt, locale) : "",
      }),
      margin,
      y + 10,
      { width: doc.page.width - margin * 2 }
    );

  footer(doc, t, locale);
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

export function renderStatementPdf(
  model: StatementModel,
  locale: Locale
): Promise<Uint8Array> {
  const t = docText(locale);
  const doc = new PDFDocument({ size: "A4", margin });
  let y = header(doc, t.statementTitle);

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
      `${t.payer}: ${model.parties.payerName ?? t.emptyParty} · ${t.receiver}: ${model.parties.receiverName ?? t.emptyParty}`,
      margin,
      y
    );
  y = doc.y + 6;
  doc.text(
    t.progressSummary({
      total: formatCents(model.progress.totalCents, locale),
      paid: formatCents(model.progress.paidCents, locale),
      percent: model.progress.percent,
      overdue: t.overdue({ count: model.progress.overdueCount }),
    }),
    margin,
    y
  );
  y = doc.y + 10;

  if (model.isFullyPaid) {
    doc
      .font(font.bold)
      .fontSize(size.heading)
      .fillColor(color.paid)
      .text(t.paidSeal, margin, y);
    y = doc.y + 2;
    doc
      .font(font.body)
      .fontSize(size.small)
      .fillColor(color.muted)
      .text(
        t.quittanceSentence({
          title: model.contractTitle,
          date: model.fullyPaidAt
            ? formatISODate(model.fullyPaidAt, locale)
            : "",
        }),
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
    t.tableHeaders.forEach((h, i) => {
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
      formatISODate(r.dueDate, locale),
      formatCents(r.amountCents, locale),
      docStatusLabel(r.status, locale),
      r.paidAt ? formatISODate(r.paidAt, locale) : t.emptyParty,
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

  footer(doc, t, locale);
  return collect(doc);
}
