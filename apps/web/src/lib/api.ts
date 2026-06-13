import { treaty } from "@elysiajs/eden";
import type { App } from "@quitto/api";

// Same origin: the front calls '/api' (Vite proxy in dev, vercel.json in prod).
// parseDate:false — Eden's treaty client otherwise revives any "YYYY-MM-DD"-ish
// string into a Date object (and drifts the day via UTC parsing). Our API speaks
// ISO date strings (installment.dueDate etc.); reviving them breaks string-based
// helpers (formatISODateBR/isOverdue) and reintroduces the timezone drift we
// deliberately avoid. Keep dates as strings on the wire.
export const api = treaty<App>(window.location.origin, {
  fetch: { credentials: "include" },
  parseDate: false,
});
