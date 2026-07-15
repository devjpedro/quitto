import { createServerFn } from "@tanstack/react-start";
import { getRequest } from "@tanstack/react-start/server";
import {
  resolveSessionSSR,
  SESSION_SSR_TIMEOUT_MS,
} from "@/lib/session-resolver";

// O SSR chama a API do Fly direto (o rewrite /api/* é só pro browser).
const API_URL = process.env.API_URL ?? "http://localhost:3000";

/**
 * Check de sessão no servidor: lê o cookie da request (via getRequest, evitando
 * o gotcha de headers incompletos no beforeLoad) e resolve com timeout curto.
 */
export const getSessionSSR = createServerFn({ method: "GET" }).handler(() => {
  const cookie = getRequest().headers.get("cookie");
  return resolveSessionSSR({
    cookie,
    timeoutMs: SESSION_SSR_TIMEOUT_MS,
    fetchMe: (c) => fetch(`${API_URL}/api/me`, { headers: { cookie: c } }),
  });
});
