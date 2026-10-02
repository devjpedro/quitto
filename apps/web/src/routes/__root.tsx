import type { QueryClient } from "@tanstack/react-query";
import {
  createRootRouteWithContext,
  HeadContent,
  Outlet,
  Scripts,
} from "@tanstack/react-router";
import { useEffect } from "react";
import { Toaster } from "sonner";
import "@fontsource-variable/geist";
import "@fontsource-variable/geist-mono";
import "@fontsource-variable/bricolage-grotesque";
import "../index.css";
import { clearChunkReloadMark } from "@/lib/chunk-reload";
import { initSentry } from "@/lib/sentry";
import { parseThemeCookie, THEME_INIT_SCRIPT } from "@/lib/theme";
import { getThemeSSR } from "@/lib/theme-ssr";
import { m } from "@/paraglide/messages.js";
import { getLocale } from "@/paraglide/runtime.js";

export interface RouterContext {
  queryClient: QueryClient;
}

export const Route = createRootRouteWithContext<RouterContext>()({
  // No cliente lê o cookie direto: server function aqui é um request por preload.
  loader: () =>
    typeof document === "undefined"
      ? getThemeSSR()
      : parseThemeCookie(document.cookie),
  head: ({ loaderData }) => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1.0" },
      {
        name: "description",
        content: m.meta_description(),
      },
      {
        name: "theme-color",
        content: loaderData === "dark" ? "#1A1B18" : "#F1F0EB",
      },
      { title: "Quitto" },
    ],
    links: [{ rel: "icon", type: "image/svg+xml", href: "/favicon.svg" }],
  }),
  component: RootDocument,
});

function RootDocument() {
  const theme = Route.useLoaderData();

  // Sentry só no cliente (no-op sem DSN); evita rodar o SDK de browser no SSR.
  useEffect(() => {
    initSentry();
    clearChunkReloadMark(sessionStorage); // load OK → libera novo reload no próximo deploy
    // Marca que o cliente hidratou — E2E espera por isso antes de interagir
    // (evita clicar num botão SSR antes do handler anexar).
    document.documentElement.setAttribute("data-hydrated", "true");
  }, []);

  return (
    <html
      className={theme === "dark" ? "dark" : undefined}
      lang={getLocale()}
      suppressHydrationWarning
    >
      <head>
        {/* anti-FOUC: roda antes do paint na 1ª visita (sem cookie) */}
        {/* biome-ignore lint/security/noDangerouslySetInnerHtml: script estático controlado */}
        <script dangerouslySetInnerHTML={{ __html: THEME_INIT_SCRIPT }} />
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
