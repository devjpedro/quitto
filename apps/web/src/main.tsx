// biome-ignore lint/performance/noNamespaceImport: Sentry SDK is designed as a namespace
import * as Sentry from "@sentry/react";
import { QueryClientProvider } from "@tanstack/react-query";
import { RouterProvider } from "@tanstack/react-router";
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { Toaster } from "sonner";
import "@fontsource/space-grotesk/500.css";
import "@fontsource/space-grotesk/700.css";
import "./index.css";
import { queryClient } from "./lib/query";
import { initSentry } from "./lib/sentry";
import { warmUpApi } from "./lib/warm-up";
import { router } from "./router";

initSentry();
warmUpApi();

// biome-ignore lint/style/noNonNullAssertion: #root exists in index.html
createRoot(document.getElementById("root")!, {
  onUncaughtError: Sentry.reactErrorHandler(),
  onCaughtError: Sentry.reactErrorHandler(),
  onRecoverableError: Sentry.reactErrorHandler(),
}).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <RouterProvider router={router} />
      <Toaster position="top-right" richColors />
    </QueryClientProvider>
  </StrictMode>
);
