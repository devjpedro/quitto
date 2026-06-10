import { treaty } from "@elysiajs/eden";
import type { App } from "@quitto/api";

// Same origin: the front calls '/api' (Vite proxy in dev, vercel.json in prod).
export const api = treaty<App>(window.location.origin, {
  fetch: { credentials: "include" },
});
