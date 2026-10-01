import type { PublicReceipt } from "@quitto/shared";
import { createServerFn } from "@tanstack/react-start";

// O SSR chama a API do Fly direto (o rewrite /api/* é só pro browser).
const API_URL = process.env.API_URL ?? "http://localhost:3000";
const SSR_FETCH_TIMEOUT_MS = 5000;

/** null = indisponível (404 da API: inexistente, revogado ou não-paga). */
export const getPublicReceiptSSR = createServerFn({ method: "GET" })
  .validator((token: string) => token)
  .handler(async ({ data: token }): Promise<PublicReceipt | null> => {
    const res = await fetch(
      `${API_URL}/api/public/receipts/${encodeURIComponent(token)}`,
      { signal: AbortSignal.timeout(SSR_FETCH_TIMEOUT_MS) }
    );
    if (res.status === 404) {
      return null;
    }
    if (!res.ok) {
      throw new Error(`public receipt: HTTP ${res.status}`);
    }
    return (await res.json()) as PublicReceipt;
  });
