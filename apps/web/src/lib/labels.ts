import {
  AUDIT_TYPE,
  CONTRACT_STATUS,
  type ContractStatus,
  INSTALLMENT_STATUS,
  type InstallmentStatus,
  OWNER_ROLE,
  PARTICIPANT_ROLE,
} from "@quitto/shared";

type Tone = "success" | "warning" | "danger" | "neutral" | "brand";

export const INSTALLMENT_STATUS_LABEL: Record<InstallmentStatus, string> = {
  [INSTALLMENT_STATUS.pending]: "pendente",
  [INSTALLMENT_STATUS.awaitingConfirmation]: "aguardando",
  [INSTALLMENT_STATUS.confirmed]: "confirmada",
  [INSTALLMENT_STATUS.disputed]: "contestada",
  [INSTALLMENT_STATUS.paid]: "paga",
};

export const INSTALLMENT_STATUS_TONE: Record<InstallmentStatus, Tone> = {
  [INSTALLMENT_STATUS.pending]: "warning",
  [INSTALLMENT_STATUS.awaitingConfirmation]: "warning",
  [INSTALLMENT_STATUS.confirmed]: "success",
  [INSTALLMENT_STATUS.disputed]: "danger",
  [INSTALLMENT_STATUS.paid]: "success",
};

export const CONTRACT_STATUS_LABEL: Record<ContractStatus, string> = {
  [CONTRACT_STATUS.active]: "ativo",
  [CONTRACT_STATUS.completed]: "concluído",
  [CONTRACT_STATUS.cancelled]: "cancelado",
};

export const CONTRACT_STATUS_TONE: Record<ContractStatus, Tone> = {
  [CONTRACT_STATUS.active]: "brand",
  [CONTRACT_STATUS.completed]: "success",
  [CONTRACT_STATUS.cancelled]: "neutral",
};

// Papéis: inclui rótulos exibidos que não são papéis de domínio puros (ex.: contraparte).
export const ROLE_LABEL: Record<string, string> = {
  [PARTICIPANT_ROLE.owner]: "dono",
  [PARTICIPANT_ROLE.buyer]: "comprador",
  [PARTICIPANT_ROLE.seller]: "vendedor",
  [PARTICIPANT_ROLE.viewer]: "convidado",
  [OWNER_ROLE.neutral]: "neutro",
  counterparty: "contraparte",
};

export const OWNER_BADGE_LABEL = "Dono";

export const AUDIT_TYPE_LABEL: Record<string, string> = {
  [AUDIT_TYPE.proofSubmitted]: "Comprovante enviado",
  [AUDIT_TYPE.paymentConfirmed]: "Pagamento confirmado",
  [AUDIT_TYPE.paymentDisputed]: "Pagamento contestado",
  [AUDIT_TYPE.installmentPaid]: "Parcela paga",
};
