import type { QueryClient } from "@tanstack/react-query";
import {
  createRootRouteWithContext,
  HeadContent,
  Outlet,
  Scripts,
} from "@tanstack/react-router";
import { useEffect } from "react";
import { Toaster } from "sonner";
import "@fontsource/space-grotesk/500.css";
import "@fontsource/space-grotesk/700.css";
import "../index.css";
import { initSentry } from "@/lib/sentry";

export interface RouterContext {
  queryClient: QueryClient;
}

export const Route = createRootRouteWithContext<RouterContext>()({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1.0" },
      {
        name: "description",
        content:
          "Quitto — gerencie contratos parcelados, comprovantes e quitação em um só lugar.",
      },
      { name: "theme-color", content: "#0f766e" },
      { title: "Quitto" },
    ],
    links: [{ rel: "icon", type: "image/svg+xml", href: "/favicon.svg" }],
  }),
  component: RootDocument,
});

function RootDocument() {
  // Sentry só no cliente (no-op sem DSN); evita rodar o SDK de browser no SSR.
  useEffect(() => {
    initSentry();
  }, []);

  return (
    <html lang="pt-BR">
      <head>
        <HeadContent />
      </head>
      <body>
        <Outlet />
        <Toaster position="top-right" richColors />
        <Scripts />
      </body>
    </html>
  );
}
