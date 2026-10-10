import type { QueryClient } from "@tanstack/react-query";
import {
  createRootRouteWithContext,
  HeadContent,
  Outlet,
  Scripts,
} from "@tanstack/react-router";
import { useEffect } from "react";
import "@fontsource-variable/geist";
import "@fontsource-variable/geist-mono";
import "@fontsource-variable/bricolage-grotesque";
import "../index.css";
import { AppToaster } from "@/components/ui/app-toaster";
import "@/features/install/lib/install-store"; // listens to beforeinstallprompt from the first script
import { clearChunkReloadMark } from "@/lib/chunk-reload";
import { registerServiceWorker } from "@/lib/register-sw";
import { initSentry } from "@/lib/sentry";
import { seedSession } from "@/lib/session-route";
import {
  parseThemeCookie,
  THEME_INIT_SCRIPT,
  themeColorMetas,
} from "@/lib/theme";
import { getThemeSSR } from "@/lib/theme-ssr";
import { m } from "@/paraglide/messages.js";
import { getLocale } from "@/paraglide/runtime.js";

export interface RouterContext {
  queryClient: QueryClient;
}

export const Route = createRootRouteWithContext<RouterContext>()({
  // The session is decided once, here, and every route reads it from the
  // context: the layouts redirect on it, and the logo (HomeLogo) is a link
  // only when there is one. Cheap: with no cookie it never calls the API.
  beforeLoad: async ({ context }) => ({
    session: await seedSession(context.queryClient),
  }),
  // No cliente lê o cookie direto: server function aqui é um request por preload.
  loader: () =>
    typeof document === "undefined"
      ? getThemeSSR()
      : parseThemeCookie(document.cookie),
  head: ({ loaderData }) => ({
    meta: [
      { charSet: "utf-8" },
      {
        name: "viewport",
        content: "width=device-width, initial-scale=1.0, viewport-fit=cover",
      },
      {
        name: "description",
        content: m.meta_description(),
      },
      ...themeColorMetas(loaderData),
      { name: "mobile-web-app-capable", content: "yes" },
      { name: "apple-mobile-web-app-capable", content: "yes" },
      { name: "apple-mobile-web-app-status-bar-style", content: "default" },
      { name: "apple-mobile-web-app-title", content: "Quitto" },
      { title: "Quitto" },
    ],
    links: [
      { rel: "icon", type: "image/svg+xml", href: "/favicon.svg" },
      { rel: "apple-touch-icon", href: "/apple-touch-icon.png" },
      { rel: "manifest", href: "/manifest.webmanifest" },
    ],
  }),
  component: RootDocument,
});

function RootDocument() {
  const theme = Route.useLoaderData();

  // Sentry só no cliente (no-op sem DSN); evita rodar o SDK de browser no SSR.
  useEffect(() => {
    initSentry();
    registerServiceWorker();
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
        <AppToaster />
        <Scripts />
      </body>
    </html>
  );
}
