# Fase 6b — Recibo/quitação + export (documentos)

**Data:** 2026-06-13
**Branch base:** `develop`
**Spec mestre:** `2026-06-09-quitto-design.md` (§44-45 recibo/quitação/export; §257 textos de PDF centralizados)

Segunda fatia da Fase 6 (6a Dashboard ✅ → **6b documentos** → 6c LGPD).

## Objetivo

Gerar, sob demanda, documentos do contrato: **recibo de uma parcela paga** (PDF), **extrato do
contrato** (PDF e CSV), com a **quitação embutida** no extrato (selo "QUITADO" quando 100% pago).
Tudo baixável; nada é enviado por e-mail (e-mail está no backlog).

## Decisões

- **pdfkit (desenho server-side).** Leve, sem wasm, roda no Bun, streaming — o mais escalável num
  tier pequeno. Sem Chromium headless (estoura memória) e sem `@react-pdf/renderer` (mais
  pesado/risco no Bun).
- **Modelo separado do renderer.** Funções puras montam o *modelo* do documento (dados); o
  renderer (pdfkit) e o CSV consomem o mesmo modelo. Renderer trocável sem tocar no domínio; CSV
  e PDF nunca divergem nos dados.
- **Quitação embutida.** A declaração de quitação é o próprio extrato com selo "QUITADO" +
  frase, quando `isFullyPaid`. Sem documento separado.
- **Download direto (âncora same-origin).** O front baixa via `<a href="/api/...">` — cookie
  first-party vai junto, sem manipular blob. Endpoints respondem com
  `Content-Disposition: attachment`.
- **Layout fixo na identidade B2** (não customizável pelo usuário final — YAGNI). Estilo
  (cores/fontes/margens) centralizado num módulo, ajustável globalmente. Logo/tema por contrato =
  backlog.
- **Plano único** (API + UI numa branch).

## Acesso

Qualquer parte do contrato baixa (via `getContractRole` — 404 sem acesso, não vaza). O recibo
exige a parcela **paga** (`isPaidStatus`); senão **409**. Sessão ausente → 401.

## Camadas e arquivos

| Camada | Arquivo | Responsabilidade |
|---|---|---|
| api/lib | `money.ts` (modificar) | `formatCentsBRL(cents)` → "R$ 1.234,56" |
| api/lib | `dates.ts` (modificar) | `formatISODateBR(iso)` → "DD/MM/AAAA" (server) |
| api/lib/documents | `model.ts` (criar) | `buildStatementModel`, `buildReceiptModel` (puros) + tipos |
| api/lib/documents | `labels.ts` (criar) | textos pt-BR dos docs + rótulos de status (canal PDF) |
| api/lib/documents | `style.ts` (criar) | constantes B2 (cores, fontes, margens, tamanhos) |
| api/lib/documents | `csv.ts` (criar) | `buildStatementCsv(model)` (puro) |
| api/lib/documents | `pdf.ts` (criar) | `renderStatementPdf(model)`, `renderReceiptPdf(model)` → `Uint8Array` |
| api/modules | `documents.ts` (criar) | 3 endpoints |
| api | `app.ts` (modificar) | registrar `documentsModule` |
| web/components | `installment-drawer.tsx` (modificar) | botão "Baixar recibo" (parcela paga) |
| web/routes | `contract-detail.tsx` (modificar) | menu "Exportar" → PDF / CSV |

## Modelo do documento (`lib/documents/model.ts`)

```
StatementModel {
  contractTitle: string;
  parties: { payerName: string | null; receiverName: string | null };
  progress: ContractProgress;          // reusa computeProgress
  isFullyPaid: boolean;                 // progress.percent === 100
  fullyPaidAt: string | null;          // maior paidAt quando quitado (YYYY-MM-DD) ou null
  rows: { sequence; amountCents; dueDate; status; paidAt: string | null }[];
}

ReceiptModel {
  contractTitle: string;
  parties: { payerName: string | null; receiverName: string | null };
  sequence: number; installmentsCount: number;
  amountCents: number; dueDate: string; paidAt: string;
}
```

`parties`: nome do participante em vaga `buyer` → `payerName`; `seller` → `receiverName`
(displayName; null se a vaga não existir/sem nome). Reusa as linhas de `participant`.

## Endpoints (`modules/documents.ts`)

- `GET /api/installments/:id/receipt.pdf` — carrega parcela + contrato + caps; `getContractRole`
  (404); se `!isPaidStatus(status)` → 409; monta `buildReceiptModel`, `renderReceiptPdf`, retorna
  `new Response(bytes, { headers: { "content-type": "application/pdf", "content-disposition":
  'attachment; filename="recibo-<contrato>-parcela-<n>.pdf"' } })`.
- `GET /api/contracts/:id/statement.pdf` — `getContractRole` (404); `buildStatementModel` +
  `renderStatementPdf`; mesma resposta com filename `extrato-<contrato>.pdf`.
- `GET /api/contracts/:id/statement.csv` — idem com `buildStatementCsv`; content-type
  `text/csv; charset=utf-8`, filename `.csv`. CSV: delimitador `;`, cabeçalho
  `Parcela;Vencimento;Valor;Status;Pago em`, valores BR, BOM UTF-8 opcional p/ Excel.

Os bytes do PDF são coletados do stream do pdfkit numa Promise (`doc.on("data")`/`"end"`).
Nomes de arquivo: slug do título (ascii, sem espaços) para evitar header inválido.

## Renderer pdfkit (layout B2)

**Recibo (A4, 1 página):** faixa de topo `◷ Quitto` (teal) + "RECIBO DE PAGAMENTO" + régua;
bloco título (contrato + "Parcela N de M"); meta 2 colunas (Pagador/Recebedor, Valor em
destaque, Pago em, Vencimento); frase de quitação; rodapé "gerado eletronicamente pelo Quitto em
<data>".

**Extrato (A4, multipágina):** mesma faixa + "EXTRATO DO CONTRATO"; resumo (partes, total, %
quitado com barra desenhada, pagas/total, atrasadas); selo "QUITADO" + frase quando
`isFullyPaid`; tabela Nº · Vencimento · Valor · Status · Pago em (zebra, cabeçalho teal repetido
por página, status colorido por tom); linha de totais; rodapé.

Estilo todo em `style.ts` (cores, fontes embutidas padrão do pdfkit ou Space Grotesk se simples,
margens). Sem literais de cor/medida espalhados.

## UI

- **Drawer da parcela:** quando `isPaidStatus(status)`, mostra "Baixar recibo" — âncora
  `href={/api/installments/${id}/receipt.pdf}` com `download`.
- **Detalhe do contrato:** botão "Exportar" abre `DropdownMenu` (já existe) com itens "PDF" e
  "CSV" → âncoras para `statement.pdf` / `statement.csv`.
- Âncoras same-origin levam o cookie automaticamente; sem fetch/blob.

## Testes

- **Puro:** `buildStatementCsv` (string exata: cabeçalho + 1 linha formatada `;`-delimitada);
  `buildStatementModel` (rows, isFullyPaid true quando todas pagas, fullyPaidAt, parties por
  vaga); `buildReceiptModel`. `formatCentsBRL`/`formatISODateBR` (unit).
- **Renderer:** `renderReceiptPdf`/`renderStatementPdf` retornam `Uint8Array` começando com
  `%PDF` (não-vazio).
- **Integração:** recibo 200 + `content-type application/pdf` + `content-disposition attachment`
  para parcela paga; **409** para não-paga; `statement.pdf` começa com `%PDF`; `statement.csv`
  tem o cabeçalho certo; **404** cross-user; **401** sem sessão.
- **Web:** "Baixar recibo" só aparece quando paga e com `href` correto; menu Exportar tem PDF/CSV
  com hrefs corretos.

## Fora de escopo

E-mail (enviar recibo/extrato) — backlog. Logo/tema por contrato. Assinatura digital do PDF.
Anexar o contrato original (já no backlog do MVP). 6c (LGPD) tem spec própria.
