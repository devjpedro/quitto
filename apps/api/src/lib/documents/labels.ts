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
  receiptSentence: (
    amount: string,
    n: number,
    total: number,
    title: string,
    paidAt: string
  ) =>
    `Declaramos o recebimento de ${amount} referente à parcela ${n}/${total} do contrato "${title}", pago em ${paidAt}.`,
  quittanceSentence: (title: string, date: string) =>
    `Contrato "${title}" integralmente quitado em ${date}.`,
  generatedAt: (date: string) =>
    `Documento gerado eletronicamente pelo Quitto em ${date}.`,
  tableHeaders: ["Nº", "Vencimento", "Valor", "Status", "Pago em"] as const,
} as const;
