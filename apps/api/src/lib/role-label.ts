import { PARTICIPANT_ROLE } from "@quitto/shared";

export const ROLE_LABEL: Record<string, string> = {
  [PARTICIPANT_ROLE.buyer]: "Comprador",
  [PARTICIPANT_ROLE.seller]: "Vendedor",
  [PARTICIPANT_ROLE.viewer]: "Convidado",
};
