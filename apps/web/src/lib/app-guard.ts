export type GateDecision =
  | { kind: "render" }
  | { kind: "loader" }
  | { kind: "redirect"; to: "/login" };

/**
 * Decisão pura do gate no cliente, a partir do estado da query de sessão.
 * - 401 → redireciona pra /login (sessão ausente de verdade)
 * - tem data → renderiza o app
 * - resto (pendente / erro transitório) → mostra o loader de marca
 */
export function decideClientGate(q: {
  isPending?: boolean;
  isError?: boolean;
  status?: number;
  data?: unknown;
}): GateDecision {
  if (q.isError && q.status === 401) {
    return { kind: "redirect", to: "/login" };
  }
  if (q.data) {
    return { kind: "render" };
  }
  return { kind: "loader" };
}
