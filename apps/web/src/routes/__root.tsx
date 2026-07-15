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
import { clearChunkReloadMark } from "@/lib/chunk-reload";
import { initSentry } from "@/lib/sentry";
import { THEME_INIT_SCRIPT } from "@/lib/theme";
import { getThemeSSR } from "@/lib/theme-ssr";

export interface RouterContext {
  queryClient: QueryClient;
}

export const Route = createRootRouteWithContext<RouterContext>()({
  loader: () => getThemeSSR(),
  head: ({ loaderData }) => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1.0" },
      {
        name: "description",
        content:
          "Quitto — gerencie contratos parcelados, comprovantes e quitação em um só lugar.",
      },
      {
        name: "theme-color",
        content: loaderData === "dark" ? "#1c1c1c" : "#faf9f6",
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
      lang="pt-BR"
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
