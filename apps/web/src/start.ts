import { createCsrfMiddleware, createStart } from "@tanstack/react-start";
import { timeoutErrorAdapter } from "@/lib/timeout-error-adapter";

// A start instance replaces the Start's default request middleware: keep the
// CSRF check on server functions, the same one it applies without an instance.
const csrfMiddleware = createCsrfMiddleware({
  filter: (ctx) => ctx.handlerType === "serverFn",
});

export const startInstance = createStart(() => ({
  requestMiddleware: [csrfMiddleware],
  // A read that timed out in the SSR stays a timeout in the browser.
  serializationAdapters: [timeoutErrorAdapter],
}));
