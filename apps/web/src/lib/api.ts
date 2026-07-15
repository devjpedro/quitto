import { treaty } from "@elysiajs/eden";
import type { App } from "@quitto/api";

// Same origin: the front calls '/api' (Vite proxy in dev, vercel.json in prod).
// parseDate:false — Eden's treaty client otherwise revives any "YYYY-MM-DD"-ish
// string into a Date object (and drifts the day via UTC parsing). Our API speaks
// ISO date strings (installment.dueDate etc.); reviving them breaks string-based
// helpers (formatISODateBR/isOverdue) and reintroduces the timezone drift we
// deliberately avoid. Keep dates as strings on the wire.
// window não existe no SSR; o client Eden é usado só no cliente (dados do app são
// client-fetched, ADR-0001). No server a base fica vazia e nunca é exercida.
const baseUrl = typeof window === "undefined" ? "" : window.location.origin;

export const api = treaty<App>(baseUrl, {
  fetch: { credentials: "include" },
  parseDate: false,
});
