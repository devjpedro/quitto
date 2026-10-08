import {
  CONTRACT_STATUS,
  type ContractStatus,
  OWNER_ROLE,
  PARTICIPANT_ROLE,
} from "@quitto/shared";

type Tone = "success" | "warning" | "danger" | "neutral" | "brand" | "gold";

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
