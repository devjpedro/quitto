# Fase 6b — Recibo/quitação + export (documentos) — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Gerar sob demanda o recibo de uma parcela paga (PDF) e o extrato do contrato (PDF + CSV, com quitação embutida), baixáveis via âncora same-origin.

**Architecture:** Funções puras montam o *modelo* do documento (dados); o renderer pdfkit e o builder de CSV consomem o mesmo modelo — renderer trocável, PDF e CSV nunca divergem. Endpoints servem os bytes com `Content-Disposition: attachment`. Front baixa por `<a href>` (cookie first-party).

**Tech Stack:** Bun + Elysia + Drizzle (`bun test`); **pdfkit** (desenho server-side, sem wasm/Chromium); React 19 + Vite (Vitest). Reusa `computeProgress`, `isPaidStatus`, `getContractRole`.

**Spec:** `docs/superpowers/specs/2026-06-13-fase-6b-documentos-design.md`

**Git:** branch `feat/fase-6b-documentos` a partir de `develop`; commit por tarefa; no fim, tudo verde → merge em `develop` e marcar a 6b no ROADMAP.

**Pré-requisitos:** Postgres (`DATABASE_URL`). O teste "recibo de parcela paga" exige MinIO/S3 (gerar parcela paga via upload) e usa `it.skipIf(!process.env.S3_ENDPOINT)`.

**Convenções:** código em inglês; textos de documento em pt-BR (canal PDF, centralizados em `documents/labels.ts`); sem literais (status via `INSTALLMENT_STATUS`, cores/medidas via `documents/style.ts`); UI B2 via `frontend-design`.

---

## File Structure

| Arquivo | Responsabilidade |
|---|---|
| `apps/api/src/lib/money.ts` (mod) | `formatCentsBRL` |
| `apps/api/src/lib/dates.ts` (mod) | `formatISODateBR` (server) |
| `apps/api/src/lib/documents/model.ts` (criar) | `buildStatementModel`, `buildReceiptModel` (puros) + tipos |
| `apps/api/src/lib/documents/labels.ts` (criar) | textos pt-BR + rótulos de status |
| `apps/api/src/lib/documents/style.ts` (criar) | constantes B2 (cor/fonte/medida) |
| `apps/api/src/lib/documents/csv.ts` (criar) | `buildStatementCsv` (puro) |
| `apps/api/src/lib/documents/pdf.ts` (criar) | `renderReceiptPdf`, `renderStatementPdf` |
| `apps/api/src/modules/documents.ts` (criar) | 3 endpoints |
| `apps/api/src/app.ts` (mod) | registrar `documentsModule` |
| `apps/api/tests/documents.test.ts` (criar) | puro + renderer + integração |
| `apps/web/src/components/installment-drawer.tsx` (mod) | "Baixar recibo" (parcela paga) |
| `apps/web/src/routes/contract-detail.tsx` (mod) | menu "Exportar" → PDF / CSV |
| `apps/web/tests/documents-ui.test.tsx` (criar) | botões/hrefs |

---

## Task 1: Formatadores server-side

**Files:**
- Modify: `apps/api/src/lib/money.ts`, `apps/api/src/lib/dates.ts`
- Test: `apps/api/tests/money.test.ts`, `apps/api/tests/dates.test.ts`

- [ ] **Step 1: Testes que falham**

Em `apps/api/tests/money.test.ts` (inclua `formatCentsBRL` no import):

```ts
describe("formatCentsBRL", () => {
  it("formats integer cents as BRL with a normal space", () => {
    expect(formatCentsBRL(123_456)).toBe("R$ 1.234,56");
  });
  it("formats zero", () => {
    expect(formatCentsBRL(0)).toBe("R$ 0,00");
  });
});
```

Em `apps/api/tests/dates.test.ts` (inclua `formatISODateBR`):

```ts
describe("formatISODateBR", () => {
  it("formats ISO as DD/MM/YYYY", () => {
    expect(formatISODateBR("2026-07-10")).toBe("10/07/2026");
  });
});
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `cd /home/buckz/Documentos/www/personal-projects/quitto/apps/api && bun test tests/money.test.ts tests/dates.test.ts`
Expected: FAIL (não exportados).

- [ ] **Step 3: Implementar**

Em `apps/api/src/lib/money.ts`:

```ts
const BRL = new Intl.NumberFormat("pt-BR", {
  style: "currency",
  currency: "BRL",
});

/** Formats integer cents as Brazilian currency ("R$ 1.234,56"). */
export function formatCentsBRL(cents: number): string {
  return BRL.format(cents / 100).replace(/[\u00a0\u202f]/g, " ");
}
```

Em `apps/api/src/lib/dates.ts`:

```ts
/** Formats an ISO date (YYYY-MM-DD) as DD/MM/YYYY (string split, no timezone drift). */
export function formatISODateBR(iso: string): string {
  const [y, m, d] = iso.split("-");
  return `${d}/${m}/${y}`;
}
```

- [ ] **Step 4: Rodar e ver passar**

Run: `cd /home/buckz/Documentos/www/personal-projects/quitto/apps/api && bun test tests/money.test.ts tests/dates.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
cd /home/buckz/Documentos/www/personal-projects/quitto
git add apps/api/src/lib/money.ts apps/api/src/lib/dates.ts apps/api/tests/money.test.ts apps/api/tests/dates.test.ts
git commit -m "feat(api): formatCentsBRL + formatISODateBR (server)"
```

---

## Task 2: Modelo do documento (puro)

**Files:**
- Create: `apps/api/src/lib/documents/model.ts`
- Test: `apps/api/tests/documents.test.ts` (parte 1)

- [ ] **Step 1: Teste que falha**

Crie `apps/api/tests/documents.test.ts`:

```ts
import { describe, expect, it } from "bun:test";
import {
  buildReceiptModel,
  buildStatementModel,
  type ModelContract,
  type ModelInstallment,
  type ModelParticipant,
} from "../src/lib/documents/model";

const contract: ModelContract = {
  title: "Aluguel",
  installmentsCount: 2,
};
const participants: ModelParticipant[] = [
  { role: "buyer", displayName: "Comprador" },
  { role: "seller", displayName: "Vendedor" },
];
const today = "2026-07-15";

const mkInst = (over: Partial<ModelInstallment>): ModelInstallment => ({
  sequence: 1,
  amountCents: 1000,
  dueDate: "2026-07-10",
  status: "pending",
  paidAt: null,
  ...over,
});

describe("buildStatementModel", () => {
  it("maps parties by slot and builds rows sorted by sequence", () => {
    const model = buildStatementModel(
      contract,
      [mkInst({ sequence: 2, dueDate: "2026-08-10" }), mkInst({ sequence: 1 })],
      participants,
      today
    );
    expect(model.parties).toEqual({
      payerName: "Comprador",
      receiverName: "Vendedor",
    });
    expect(model.rows.map((r) => r.sequence)).toEqual([1, 2]);
    expect(model.isFullyPaid).toBe(false);
  });

  it("flags fully paid and the last paid date", () => {
    const model = buildStatementModel(
      contract,
      [
        mkInst({ sequence: 1, status: "paid", paidAt: "2026-07-01" }),
        mkInst({ sequence: 2, status: "confirmed", paidAt: "2026-07-12" }),
      ],
      participants,
      today
    );
    expect(model.isFullyPaid).toBe(true);
    expect(model.fullyPaidAt).toBe("2026-07-12");
  });
});

describe("buildReceiptModel", () => {
  it("builds receipt fields from a paid installment", () => {
    const model = buildReceiptModel(
      contract,
      mkInst({ sequence: 1, status: "paid", paidAt: "2026-07-12", amountCents: 5000 }),
      participants
    );
    expect(model.sequence).toBe(1);
    expect(model.installmentsCount).toBe(2);
    expect(model.amountCents).toBe(5000);
    expect(model.paidAt).toBe("2026-07-12");
    expect(model.parties.payerName).toBe("Comprador");
  });
});
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `cd /home/buckz/Documentos/www/personal-projects/quitto/apps/api && bun test tests/documents.test.ts`
Expected: FAIL ("Cannot find module .../documents/model").

- [ ] **Step 3: Implementar**

Crie `apps/api/src/lib/documents/model.ts`:

```ts
import { type InstallmentStatus, isPaidStatus } from "@quitto/shared";
import {
  type ContractProgress,
  computeProgress,
} from "../contract-progress";

export interface ModelContract {
  title: string;
  installmentsCount: number;
}
export interface ModelInstallment {
  sequence: number;
  amountCents: number;
  dueDate: string;
  status: InstallmentStatus;
  paidAt: string | null;
}
export interface ModelParticipant {
  role: string;
  displayName: string;
}
export interface DocumentParties {
  payerName: string | null;
  receiverName: string | null;
}

export interface StatementModel {
  contractTitle: string;
  parties: DocumentParties;
  progress: ContractProgress;
  isFullyPaid: boolean;
  fullyPaidAt: string | null;
  rows: {
    sequence: number;
    amountCents: number;
    dueDate: string;
    status: InstallmentStatus;
    paidAt: string | null;
  }[];
}

export interface ReceiptModel {
  contractTitle: string;
  parties: DocumentParties;
  sequence: number;
  installmentsCount: number;
  amountCents: number;
  dueDate: string;
  paidAt: string;
}

function partiesOf(participants: ModelParticipant[]): DocumentParties {
  const byRole = (role: string) =>
    participants.find((p) => p.role === role)?.displayName ?? null;
  return { payerName: byRole("buyer"), receiverName: byRole("seller") };
}

export function buildStatementModel(
  contract: ModelContract,
  installments: ModelInstallment[],
  participants: ModelParticipant[],
  todayISO: string
): StatementModel {
  const progress = computeProgress(installments, todayISO);
  const rows = [...installments].sort((a, b) => a.sequence - b.sequence);
  const isFullyPaid =
    rows.length > 0 && rows.every((r) => isPaidStatus(r.status));
  const paidDates = rows
    .filter((r) => isPaidStatus(r.status) && r.paidAt)
    .map((r) => r.paidAt as string);
  const fullyPaidAt =
    isFullyPaid && paidDates.length > 0
      ? paidDates.reduce((a, b) => (a > b ? a : b))
      : null;
  return {
    contractTitle: contract.title,
    parties: partiesOf(participants),
    progress,
    isFullyPaid,
    fullyPaidAt,
    rows: rows.map((r) => ({
      sequence: r.sequence,
      amountCents: r.amountCents,
      dueDate: r.dueDate,
      status: r.status,
      paidAt: r.paidAt,
    })),
  };
}

export function buildReceiptModel(
  contract: ModelContract,
  installment: ModelInstallment,
  participants: ModelParticipant[]
): ReceiptModel {
  return {
    contractTitle: contract.title,
    parties: partiesOf(participants),
    sequence: installment.sequence,
    installmentsCount: contract.installmentsCount,
    amountCents: installment.amountCents,
    dueDate: installment.dueDate,
    paidAt: installment.paidAt ?? "",
  };
}
```

- [ ] **Step 4: Rodar e ver passar**

Run: `cd /home/buckz/Documentos/www/personal-projects/quitto/apps/api && bun test tests/documents.test.ts`
Expected: PASS (3 testes).

- [ ] **Step 5: Commit**

```bash
cd /home/buckz/Documentos/www/personal-projects/quitto
git add apps/api/src/lib/documents/model.ts apps/api/tests/documents.test.ts
git commit -m "feat(api): modelo puro de recibo/extrato"
```

---

## Task 3: Labels e estilo dos documentos

**Files:**
- Create: `apps/api/src/lib/documents/labels.ts`, `apps/api/src/lib/documents/style.ts`

(Constantes — sem teste dedicado; cobertas pelo CSV/PDF nas próximas tarefas.)

- [ ] **Step 1: `labels.ts`**

```ts
import { INSTALLMENT_STATUS, type InstallmentStatus } from "@quitto/shared";

export const DOC_INSTALLMENT_STATUS_LABEL: Record<InstallmentStatus, string> = {
  [INSTALLMENT_STATUS.pending]: "Pendente",
  [INSTALLMENT_STATUS.awaitingConfirmation]: "Aguardando confirmação",
  [INSTALLMENT_STATUS.confirmed]: "Confirmada",
  [INSTALLMENT_STATUS.disputed]: "Contestada",
  [INSTALLMENT_STATUS.paid]: "Paga",
};

export const DOC_TEXT = {
  brand: "Quitto",
  receiptTitle: "RECIBO DE PAGAMENTO",
  statementTitle: "EXTRATO DO CONTRATO",
  paidSeal: "QUITADO",
  payerLabel: "Pagador",
  receiverLabel: "Recebedor",
  amountLabel: "Valor",
  paidAtLabel: "Pago em",
  dueDateLabel: "Vencimento",
  emptyParty: "—",
  receiptSentence: (amount: string, n: number, total: number, title: string, paidAt: string) =>
    `Declaramos o recebimento de ${amount} referente à parcela ${n}/${total} do contrato "${title}", pago em ${paidAt}.`,
  quittanceSentence: (title: string, date: string) =>
    `Contrato "${title}" integralmente quitado em ${date}.`,
  generatedAt: (date: string) =>
    `Documento gerado eletronicamente pelo Quitto em ${date}.`,
  tableHeaders: ["Nº", "Vencimento", "Valor", "Status", "Pago em"] as const,
} as const;
```

- [ ] **Step 2: `style.ts`**

(pdfkit usa as fontes padrão Helvetica — sem embutir TTF, pra não arriscar bundling de asset no Bun/Fly. Identidade B2 vem das cores + layout. Embutir Space Grotesk fica como backlog.)

```ts
export const DOC_STYLE = {
  margin: 50,
  color: {
    brand: "#0f766e",
    text: "#1c1917",
    muted: "#78716c",
    line: "#e7e5e4",
    zebra: "#f5f5f4",
    paid: "#15803d",
    pending: "#b45309",
    overdue: "#b91c1c",
  },
  font: {
    body: "Helvetica",
    bold: "Helvetica-Bold",
  },
  size: {
    brand: 16,
    title: 13,
    heading: 11,
    body: 10,
    small: 8,
    amount: 22,
  },
} as const;
```

- [ ] **Step 3: Typecheck + commit**

Run: `cd /home/buckz/Documentos/www/personal-projects/quitto && bun run --filter @quitto/api typecheck`
Expected: PASS.

```bash
cd /home/buckz/Documentos/www/personal-projects/quitto
git add apps/api/src/lib/documents/labels.ts apps/api/src/lib/documents/style.ts
git commit -m "feat(api): textos e estilo dos documentos"
```

---

## Task 4: CSV do extrato (puro)

**Files:**
- Create: `apps/api/src/lib/documents/csv.ts`
- Test: `apps/api/tests/documents.test.ts` (parte 2)

- [ ] **Step 1: Teste que falha**

Adicione em `apps/api/tests/documents.test.ts`:

```ts
import { buildStatementCsv } from "../src/lib/documents/csv";

describe("buildStatementCsv", () => {
  it("emits a semicolon-delimited statement with a header and BR values", () => {
    const model = buildStatementModel(
      contract,
      [mkInst({ sequence: 1, amountCents: 123_456, status: "paid", paidAt: "2026-07-12" })],
      participants,
      today
    );
    const csv = buildStatementCsv(model);
    const lines = csv.trim().split("\r\n");
    expect(lines[0]).toBe("Nº;Vencimento;Valor;Status;Pago em");
    expect(lines[1]).toBe("1;10/07/2026;R$ 1.234,56;Paga;12/07/2026");
  });

  it("leaves 'Pago em' empty for unpaid rows", () => {
    const model = buildStatementModel(
      contract,
      [mkInst({ sequence: 1, amountCents: 1000, status: "pending", paidAt: null })],
      participants,
      today
    );
    const lines = buildStatementCsv(model).trim().split("\r\n");
    expect(lines[1]).toBe("1;10/07/2026;R$ 10,00;Pendente;");
  });
});
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `cd /home/buckz/Documentos/www/personal-projects/quitto/apps/api && bun test tests/documents.test.ts`
Expected: FAIL ("Cannot find module .../documents/csv").

- [ ] **Step 3: Implementar**

Crie `apps/api/src/lib/documents/csv.ts`:

```ts
import { formatISODateBR } from "../dates";
import { formatCentsBRL } from "../money";
import { DOC_INSTALLMENT_STATUS_LABEL, DOC_TEXT } from "./labels";
import type { StatementModel } from "./model";

/** Builds a semicolon-delimited CSV (pt-BR Excel default) of the statement rows. */
export function buildStatementCsv(model: StatementModel): string {
  const header = DOC_TEXT.tableHeaders.join(";");
  const lines = model.rows.map((r) =>
    [
      String(r.sequence),
      formatISODateBR(r.dueDate),
      formatCentsBRL(r.amountCents),
      DOC_INSTALLMENT_STATUS_LABEL[r.status],
      r.paidAt ? formatISODateBR(r.paidAt) : "",
    ].join(";")
  );
  return [header, ...lines].join("\r\n");
}
```

- [ ] **Step 4: Rodar e ver passar**

Run: `cd /home/buckz/Documentos/www/personal-projects/quitto/apps/api && bun test tests/documents.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
cd /home/buckz/Documentos/www/personal-projects/quitto
git add apps/api/src/lib/documents/csv.ts apps/api/tests/documents.test.ts
git commit -m "feat(api): CSV do extrato"
```

---

## Task 5: Renderer pdfkit

**Files:**
- Modify: `apps/api/package.json` (dep `pdfkit` + `@types/pdfkit`)
- Create: `apps/api/src/lib/documents/pdf.ts`
- Test: `apps/api/tests/documents.test.ts` (parte 3)

- [ ] **Step 1: Instalar pdfkit**

Run: `cd /home/buckz/Documentos/www/personal-projects/quitto/apps/api && bun add pdfkit && bun add -d @types/pdfkit`
Expected: adiciona às dependências; `bun install` ok.

- [ ] **Step 2: Teste que falha**

Adicione em `apps/api/tests/documents.test.ts`:

```ts
import { renderReceiptPdf, renderStatementPdf } from "../src/lib/documents/pdf";

const PDF_MAGIC = "%PDF";

describe("pdf renderer", () => {
  it("renders a receipt PDF", async () => {
    const model = buildReceiptModel(
      contract,
      mkInst({ sequence: 1, status: "paid", paidAt: "2026-07-12", amountCents: 5000 }),
      participants
    );
    const bytes = await renderReceiptPdf(model);
    expect(bytes.length).toBeGreaterThan(0);
    expect(new TextDecoder().decode(bytes.slice(0, 4))).toBe(PDF_MAGIC);
  });

  it("renders a statement PDF (with quittance seal when fully paid)", async () => {
    const model = buildStatementModel(
      contract,
      [
        mkInst({ sequence: 1, status: "paid", paidAt: "2026-07-01" }),
        mkInst({ sequence: 2, status: "paid", paidAt: "2026-07-12" }),
      ],
      participants,
      today
    );
    const bytes = await renderStatementPdf(model);
    expect(new TextDecoder().decode(bytes.slice(0, 4))).toBe(PDF_MAGIC);
  });
});
```

- [ ] **Step 3: Rodar e ver falhar**

Run: `cd /home/buckz/Documentos/www/personal-projects/quitto/apps/api && bun test tests/documents.test.ts`
Expected: FAIL ("Cannot find module .../documents/pdf").

- [ ] **Step 4: Implementar**

Crie `apps/api/src/lib/documents/pdf.ts`:

```ts
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

function header(doc: Doc, title: string) {
  doc
    .font(font.bold)
    .fontSize(size.brand)
    .fillColor(color.brand)
    .text(`◷ ${DOC_TEXT.brand}`, margin, margin, { continued: false });
  doc
    .font(font.bold)
    .fontSize(size.heading)
    .fillColor(color.muted)
    .text(title, margin, margin + 4, { align: "right" });
  const y = margin + 28;
  doc.moveTo(margin, y).lineTo(doc.page.width - margin, y).strokeColor(color.brand).lineWidth(1).stroke();
  doc.fillColor(color.text);
  return y + 16;
}

function footer(doc: Doc) {
  const y = doc.page.height - margin;
  doc
    .font(font.body)
    .fontSize(size.small)
    .fillColor(color.muted)
    .text(DOC_TEXT.generatedAt(formatISODateBR(new Date().toISOString().slice(0, 10))), margin, y - 10, {
      width: doc.page.width - margin * 2,
      align: "center",
    });
}

function metaRow(doc: Doc, label: string, value: string, y: number): number {
  doc.font(font.body).fontSize(size.small).fillColor(color.muted).text(label, margin, y);
  doc.font(font.bold).fontSize(size.body).fillColor(color.text).text(value, margin, y + 10);
  return y + 30;
}

export function renderReceiptPdf(model: ReceiptModel): Promise<Uint8Array> {
  const doc = new PDFDocument({ size: "A4", margin });
  let y = header(doc, DOC_TEXT.receiptTitle);

  doc.font(font.bold).fontSize(size.title).fillColor(color.text).text(model.contractTitle, margin, y);
  y = doc.y + 4;
  doc.font(font.body).fontSize(size.body).fillColor(color.muted).text(`Parcela ${model.sequence} de ${model.installmentsCount}`, margin, y);
  y = doc.y + 16;

  y = metaRow(doc, DOC_TEXT.payerLabel, model.parties.payerName ?? DOC_TEXT.emptyParty, y);
  y = metaRow(doc, DOC_TEXT.receiverLabel, model.parties.receiverName ?? DOC_TEXT.emptyParty, y);

  doc.font(font.body).fontSize(size.small).fillColor(color.muted).text(DOC_TEXT.amountLabel, margin, y);
  doc.font(font.bold).fontSize(size.amount).fillColor(color.brand).text(formatCentsBRL(model.amountCents), margin, y + 10);
  y = doc.y + 16;

  y = metaRow(doc, DOC_TEXT.dueDateLabel, formatISODateBR(model.dueDate), y);
  y = metaRow(doc, DOC_TEXT.paidAtLabel, model.paidAt ? formatISODateBR(model.paidAt) : DOC_TEXT.emptyParty, y);

  doc.font(font.body).fontSize(size.body).fillColor(color.text).text(
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
  if (status === "paid" || status === "confirmed") {
    return color.paid;
  }
  if (status === "disputed") {
    return color.overdue;
  }
  return color.pending;
}

export function renderStatementPdf(model: StatementModel): Promise<Uint8Array> {
  const doc = new PDFDocument({ size: "A4", margin });
  let y = header(doc, DOC_TEXT.statementTitle);

  doc.font(font.bold).fontSize(size.title).fillColor(color.text).text(model.contractTitle, margin, y);
  y = doc.y + 6;
  doc.font(font.body).fontSize(size.body).fillColor(color.muted).text(
    `${DOC_TEXT.payerLabel}: ${model.parties.payerName ?? DOC_TEXT.emptyParty}   ·   ${DOC_TEXT.receiverLabel}: ${model.parties.receiverName ?? DOC_TEXT.emptyParty}`,
    margin,
    y
  );
  y = doc.y + 6;
  doc.text(
    `Total ${formatCentsBRL(model.progress.totalCents)}   ·   Pago ${formatCentsBRL(model.progress.paidCents)}   ·   ${model.progress.percent}% quitado   ·   ${model.progress.overdueCount} atrasada(s)`,
    margin,
    y
  );
  y = doc.y + 10;

  if (model.isFullyPaid) {
    doc.font(font.bold).fontSize(size.heading).fillColor(color.paid).text(`✓ ${DOC_TEXT.paidSeal}`, margin, y);
    y = doc.y + 2;
    doc.font(font.body).fontSize(size.small).fillColor(color.muted).text(
      DOC_TEXT.quittanceSentence(model.contractTitle, model.fullyPaidAt ? formatISODateBR(model.fullyPaidAt) : ""),
      margin,
      y
    );
    y = doc.y + 10;
  }

  // table header
  const drawTableHeader = (top: number): number => {
    let x = margin;
    doc.font(font.bold).fontSize(size.small).fillColor(color.brand);
    const widths = [COL.seq, COL.due, COL.amount, COL.status, COL.paid];
    DOC_TEXT.tableHeaders.forEach((h, i) => {
      doc.text(h, x + 2, top + 4, { width: widths[i] - 4 });
      x += widths[i];
    });
    const hy = top + 18;
    doc.moveTo(margin, hy).lineTo(margin + widths.reduce((a, b) => a + b, 0), hy).strokeColor(color.line).lineWidth(0.5).stroke();
    return hy + 4;
  };

  y = drawTableHeader(y);
  const widths = [COL.seq, COL.due, COL.amount, COL.status, COL.paid];
  const rowH = 18;

  model.rows.forEach((r, idx) => {
    if (y + rowH > doc.page.height - margin - 20) {
      doc.addPage();
      y = drawTableHeader(margin);
    }
    if (idx % 2 === 1) {
      doc.rect(margin, y - 2, widths.reduce((a, b) => a + b, 0), rowH).fillColor(color.zebra).fill();
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
      doc.font(font.body).fontSize(size.small).fillColor(i === 3 ? statusColor(r.status) : color.text).text(c, x + 2, y, { width: widths[i] - 4 });
      x += widths[i];
    });
    y += rowH;
  });

  footer(doc);
  return collect(doc);
}
```

- [ ] **Step 5: Rodar e ver passar**

Run: `cd /home/buckz/Documentos/www/personal-projects/quitto/apps/api && bun test tests/documents.test.ts`
Expected: PASS (renderer retorna `%PDF`).
Se o pdfkit reclamar de tipo do `data` chunk no Bun, garanta `chunks: Buffer[]` e o cast `(c: Buffer)`.

- [ ] **Step 6: Commit**

```bash
cd /home/buckz/Documentos/www/personal-projects/quitto
git add apps/api/package.json apps/api/../bun.lock apps/api/src/lib/documents/pdf.ts apps/api/tests/documents.test.ts
git commit -m "feat(api): renderer pdfkit (recibo + extrato com quitação)"
```

(Use o caminho real do lockfile — `bun.lock` na raiz do monorepo.)

---

## Task 6: Endpoints de documentos

**Files:**
- Create: `apps/api/src/modules/documents.ts`
- Modify: `apps/api/src/app.ts`
- Test: `apps/api/tests/documents.test.ts` (parte 4 — integração)

- [ ] **Step 1: Testes de integração que falham**

Adicione em `apps/api/tests/documents.test.ts` (copie `signUpCookie`, `createContract`, `firstInstallmentId`, `uploadProof` de `tests/payments.test.ts`):

```ts
import { app } from "../src/app";

// ── helpers copiados de tests/payments.test.ts ──
const hasStorage = Boolean(process.env.S3_ENDPOINT);

describe("documents endpoints", () => {
  it("requires auth", async () => {
    const res = await app.handle(
      new Request("http://localhost/api/contracts/x/statement.csv")
    );
    expect(res.status).toBe(401);
  });

  it("statement.csv returns the header for the caller's contract", async () => {
    const cookie = await signUpCookie("doc-csv");
    const contractId = await createContract(cookie, false);
    const res = await app.handle(
      new Request(`http://localhost/api/contracts/${contractId}/statement.csv`, {
        headers: { cookie },
      })
    );
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toContain("text/csv");
    const body = await res.text();
    expect(body.split("\r\n")[0]).toBe("Nº;Vencimento;Valor;Status;Pago em");
  });

  it("statement.pdf returns a PDF", async () => {
    const cookie = await signUpCookie("doc-pdf");
    const contractId = await createContract(cookie, false);
    const res = await app.handle(
      new Request(`http://localhost/api/contracts/${contractId}/statement.pdf`, {
        headers: { cookie },
      })
    );
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toContain("application/pdf");
    const bytes = new Uint8Array(await res.arrayBuffer());
    expect(new TextDecoder().decode(bytes.slice(0, 4))).toBe("%PDF");
  });

  it("does not leak another user's statement (404)", async () => {
    const owner = await signUpCookie("doc-owner");
    const contractId = await createContract(owner, false);
    const other = await signUpCookie("doc-other");
    const res = await app.handle(
      new Request(`http://localhost/api/contracts/${contractId}/statement.csv`, {
        headers: { cookie: other },
      })
    );
    expect(res.status).toBe(404);
  });

  it("receipt is 409 for an unpaid installment", async () => {
    const cookie = await signUpCookie("doc-unpaid");
    const contractId = await createContract(cookie, false);
    const instId = await firstInstallmentId(cookie, contractId);
    const res = await app.handle(
      new Request(`http://localhost/api/installments/${instId}/receipt.pdf`, {
        headers: { cookie },
      })
    );
    expect(res.status).toBe(409);
  });

  it.skipIf(!hasStorage)("receipt is a PDF for a paid installment", async () => {
    const cookie = await signUpCookie("doc-paid");
    const contractId = await createContract(cookie, false); // sem confirmação → upload marca paga
    const instId = await firstInstallmentId(cookie, contractId);
    await uploadProof(cookie, instId);
    const res = await app.handle(
      new Request(`http://localhost/api/installments/${instId}/receipt.pdf`, {
        headers: { cookie },
      })
    );
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toContain("application/pdf");
    expect(res.headers.get("content-disposition")).toContain("attachment");
  });
});
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `cd /home/buckz/Documentos/www/personal-projects/quitto/apps/api && bun test tests/documents.test.ts`
Expected: FAIL (rotas inexistentes).

- [ ] **Step 3: Implementar o módulo**

Crie `apps/api/src/modules/documents.ts`:

```ts
import { eq } from "drizzle-orm";
import { Elysia, t } from "elysia";
import { type InstallmentStatus, isPaidStatus } from "@quitto/shared";
import { db } from "../db/client";
import { contract, installment, participant } from "../db/schema";
import { getContractRole } from "../lib/contract-access";
import { buildReceiptModel, buildStatementModel } from "../lib/documents/model";
import { buildStatementCsv } from "../lib/documents/csv";
import { renderReceiptPdf, renderStatementPdf } from "../lib/documents/pdf";
import { ConflictError, NotFoundError } from "../lib/errors";
import { requireAuth } from "../lib/session";

const today = () => new Date().toISOString().slice(0, 10);

/** ASCII slug for a safe Content-Disposition filename. */
function slug(value: string): string {
  return value
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .toLowerCase()
    .slice(0, 60) || "documento";
}

async function loadContractFor(userId: string, contractId: string) {
  await getContractRole(userId, contractId); // 404 sem acesso
  const [c] = await db.select().from(contract).where(eq(contract.id, contractId)).limit(1);
  if (!c) {
    throw new NotFoundError("Contrato não encontrado");
  }
  const items = await db.select().from(installment).where(eq(installment.contractId, contractId));
  const people = await db
    .select({ role: participant.role, displayName: participant.displayName })
    .from(participant)
    .where(eq(participant.contractId, contractId));
  return { c, items, people };
}

type DbInstallment = {
  sequence: number;
  amountCents: number;
  dueDate: string;
  status: string;
  paidAt: Date | null;
};

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
  return new Response(bytes, {
    headers: {
      "content-type": "application/pdf",
      "content-disposition": `attachment; filename="${filename}"`,
    },
  });
}

export const documentsModule = new Elysia({ prefix: "/api" })
  .get("/contracts/:id/statement.pdf", async ({ request, params }) => {
    const { user } = await requireAuth(request.headers);
    const { c, items, people } = await loadContractFor(user.id, params.id);
    const model = buildStatementModel(
      { title: c.title, installmentsCount: c.installmentsCount },
      modelInstallments(items),
      people,
      today()
    );
    const bytes = await renderStatementPdf(model);
    return pdfResponse(bytes, `extrato-${slug(c.title)}.pdf`);
  }, { params: t.Object({ id: t.String() }) })
  .get("/contracts/:id/statement.csv", async ({ request, params }) => {
    const { user } = await requireAuth(request.headers);
    const { c, items, people } = await loadContractFor(user.id, params.id);
    const model = buildStatementModel(
      { title: c.title, installmentsCount: c.installmentsCount },
      modelInstallments(items),
      people,
      today()
    );
    const csv = buildStatementCsv(model);
    return new Response(`\uFEFF${csv}`, {
      headers: {
        "content-type": "text/csv; charset=utf-8",
        "content-disposition": `attachment; filename="extrato-${slug(c.title)}.csv"`,
      },
    });
  }, { params: t.Object({ id: t.String() }) })
  .get("/installments/:id/receipt.pdf", async ({ request, params }) => {
    const { user } = await requireAuth(request.headers);
    const [inst] = await db.select().from(installment).where(eq(installment.id, params.id)).limit(1);
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
    return pdfResponse(bytes, `recibo-${slug(c.title)}-parcela-${inst.sequence}.pdf`);
  }, { params: t.Object({ id: t.String() }) });
```

- [ ] **Step 4: Conferir `ConflictError` (409) em `lib/errors.ts`**

Abra `apps/api/src/lib/errors.ts`. Se **não** existir um `ConflictError` com `httpStatus = 409`, adicione-o no mesmo padrão das outras (ex.: `class ConflictError extends AppError` com `code "conflict"`, `httpStatus 409`). Ajuste o import no módulo conforme o nome real. (Se já houver um erro 409 com outro nome, use-o.)

- [ ] **Step 5: Registrar no `app.ts`**

Importe `import { documentsModule } from "./modules/documents";` e adicione `.use(documentsModule)` na cadeia de `buildApp()`.

- [ ] **Step 6: Rodar e ver passar**

Run: `cd /home/buckz/Documentos/www/personal-projects/quitto/apps/api && bun test tests/documents.test.ts`
Expected: PASS (integração; o teste de recibo pago pula sem MinIO).

- [ ] **Step 7: Typecheck + commit**

Run: `cd /home/buckz/Documentos/www/personal-projects/quitto && bun run --filter @quitto/api typecheck`

```bash
cd /home/buckz/Documentos/www/personal-projects/quitto
git add apps/api/src/modules/documents.ts apps/api/src/app.ts apps/api/src/lib/errors.ts apps/api/tests/documents.test.ts
git commit -m "feat(api): endpoints de recibo/extrato (pdf+csv)"
```

---

## Task 7: UI — baixar recibo + exportar

**Files:**
- Modify: `apps/web/src/components/installment-drawer.tsx`
- Modify: `apps/web/src/routes/contract-detail.tsx`
- Test: `apps/web/tests/documents-ui.test.tsx`

- [ ] **Step 1: Teste que falha**

Crie `apps/web/tests/documents-ui.test.tsx`. Testa dois componentes pequenos e puros que vamos extrair para manter a UI fina:

```tsx
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { ReceiptLink } from "../src/components/receipt-link";
import { ExportMenu } from "../src/components/export-menu";

describe("ReceiptLink", () => {
  it("links to the receipt when paid", () => {
    render(<ReceiptLink installmentId="i1" status="paid" />);
    const link = screen.getByRole("link", { name: /recibo/i });
    expect(link).toHaveAttribute("href", "/api/installments/i1/receipt.pdf");
  });
  it("renders nothing when not paid", () => {
    const { container } = render(<ReceiptLink installmentId="i1" status="pending" />);
    expect(container).toBeEmptyDOMElement();
  });
});

describe("ExportMenu", () => {
  it("exposes PDF and CSV links for the contract", async () => {
    render(<ExportMenu contractId="c1" />);
    // o conteúdo do menu pode ser renderizado sob demanda; garanta os hrefs
    expect(
      screen.getByRole("link", { name: /pdf/i })
    ).toHaveAttribute("href", "/api/contracts/c1/statement.pdf");
    expect(
      screen.getByRole("link", { name: /csv/i })
    ).toHaveAttribute("href", "/api/contracts/c1/statement.csv");
  });
});
```

(Se o `DropdownMenuContent` do Radix só montar os itens quando aberto, renderize o `ExportMenu` já aberto no teste — ex.: um prop `defaultOpen` repassado ao `DropdownMenu`, ou teste os itens via `userEvent.click` no trigger antes dos asserts.)

- [ ] **Step 2: Rodar e ver falhar**

Run: `cd /home/buckz/Documentos/www/personal-projects/quitto/apps/web && bunx vitest run tests/documents-ui.test.tsx`
Expected: FAIL (componentes não existem).

- [ ] **Step 3: Implementar os componentes**

Crie `apps/web/src/components/receipt-link.tsx`:

```tsx
import { isPaidStatus, type InstallmentStatus } from "@quitto/shared";
import { Download } from "lucide-react";

export function ReceiptLink({
  installmentId,
  status,
}: {
  installmentId: string;
  status: InstallmentStatus;
}) {
  if (!isPaidStatus(status)) {
    return null;
  }
  return (
    <a
      className="inline-flex items-center gap-1.5 text-primary text-sm hover:underline"
      download
      href={`/api/installments/${installmentId}/receipt.pdf`}
    >
      <Download aria-hidden="true" className="size-4" />
      Baixar recibo
    </a>
  );
}
```

Crie `apps/web/src/components/export-menu.tsx`:

```tsx
import { Download } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

export function ExportMenu({ contractId }: { contractId: string }) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger className="inline-flex items-center gap-1.5 rounded-lg border border-border px-3 py-1.5 text-sm hover:bg-muted">
        <Download aria-hidden="true" className="size-4" />
        Exportar
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem asChild>
          <a download href={`/api/contracts/${contractId}/statement.pdf`}>
            PDF
          </a>
        </DropdownMenuItem>
        <DropdownMenuItem asChild>
          <a download href={`/api/contracts/${contractId}/statement.csv`}>
            CSV
          </a>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
```

(Confirme que `DropdownMenuItem` aceita `asChild` — é o `DropdownMenuPrimitive.Item` do Radix, que suporta. Se a assinatura local não repassar `asChild`, ajuste o wrapper em `ui/dropdown-menu.tsx` para repassar props, ou renderize a âncora dentro do item.)

- [ ] **Step 4: Integrar nas telas**

- No `installment-drawer.tsx`: importe `ReceiptLink` e renderize-o dentro do `InstallmentDetailView` (que recebe `status` e `installment`), na área de ações — `<ReceiptLink installmentId={installment.id} status={status} />`.
- No `contract-detail.tsx`: importe `ExportMenu` e coloque-o no `<header>`, à direita do título. Transforme o bloco do título num flex `justify-between` e adicione `<ExportMenu contractId={id} />` (o `id` já vem do `useParams`).

- [ ] **Step 5: Rodar e ver passar**

Run: `cd /home/buckz/Documentos/www/personal-projects/quitto/apps/web && bunx vitest run tests/documents-ui.test.tsx`
Expected: PASS.

- [ ] **Step 6: Typecheck + commit**

Run: `cd /home/buckz/Documentos/www/personal-projects/quitto && bun run --filter @quitto/web typecheck`

```bash
cd /home/buckz/Documentos/www/personal-projects/quitto
git add apps/web/src/components/receipt-link.tsx apps/web/src/components/export-menu.tsx apps/web/src/components/installment-drawer.tsx apps/web/src/routes/contract-detail.tsx apps/web/tests/documents-ui.test.tsx
git commit -m "feat(web): baixar recibo + menu exportar (pdf/csv)"
```

---

## Task 8: Verificação final + merge + roadmap

- [ ] **Step 1: Suíte da API**

Run: `cd /home/buckz/Documentos/www/personal-projects/quitto/apps/api && bun test`
Expected: verde (recibo pago pula sem MinIO; suba MinIO p/ exercitá-lo).

- [ ] **Step 2: Suíte do web**

Run: `cd /home/buckz/Documentos/www/personal-projects/quitto/apps/web && bunx vitest run`
Expected: verde.

- [ ] **Step 3: Typecheck + lint**

Run: `cd /home/buckz/Documentos/www/personal-projects/quitto && bun run typecheck && bun run lint`
Expected: PASS nos 3 pacotes.

- [ ] **Step 4: Smoke manual (dev)**

Suba `bun run dev`. Abra um contrato: "Exportar → PDF" baixa o extrato (confira o selo QUITADO num contrato 100% pago) e "CSV" abre no Excel/LibreOffice com colunas certas. Marque uma parcela como paga e baixe o recibo pelo drawer.

- [ ] **Step 5: Marcar a 6b no ROADMAP**

Em `docs/superpowers/ROADMAP.md`, marque a **6b** concluída:
`` `plans/2026-06-13-fase-6b-documentos.md` ✅ **concluído** (merge em `develop`; suite verde — modelo puro + CSV + renderer pdfkit, endpoints recibo/extrato com RBAC e 409, download por âncora same-origin, layout B2) ``

- [ ] **Step 6: Commit do roadmap + merge**

```bash
cd /home/buckz/Documentos/www/personal-projects/quitto
git add docs/superpowers/ROADMAP.md
git commit -m "docs: marca Fase 6b concluída no roadmap"
git checkout develop
git merge --no-ff feat/fase-6b-documentos -m "Merge: Fase 6b — recibo/quitação + export"
```

Expected: merge limpo; suites verdes em `develop`.

---

## Notas para o executor

- **Sem literais:** status via `INSTALLMENT_STATUS`/`isPaidStatus`; cores/medidas via `DOC_STYLE`; textos via `DOC_TEXT`/`DOC_INSTALLMENT_STATUS_LABEL`.
- **Response de arquivo:** retornar `new Response(bytes, { headers })` — o `onError` só intercepta `AppError`, então o stream passa direto.
- **pdfkit no Bun:** usa fontes padrão (Helvetica), sem TTF embutido — evita bundling de asset. O glifo `◷`/`✓` pode não existir na Helvetica padrão; se renderizar como `□`, troque por texto (ex.: "Quitto" sem o símbolo e "QUITADO" sem o ✓) — os testes só checam `%PDF`, mas o smoke visual manda.
- **CSV com BOM** (`﻿`) para o Excel abrir os acentos certos; delimitador `;`.
- **Download:** âncoras same-origin levam o cookie; nada de fetch/blob. `getContractRole` garante o 404 sem vazar.
- **Harness de teste da API:** reuse `signUpCookie`/`createContract`/`firstInstallmentId`/`uploadProof` de `tests/payments.test.ts`.
- **Design B2:** invoque `frontend-design` para o acabamento do botão Exportar / link de recibo e, no smoke, ajuste espaçamentos do PDF.
