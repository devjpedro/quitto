import { resolve } from "node:path";
import { tanstackStart } from "@tanstack/react-start/plugin/vite";
import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { visualizer } from "rollup-plugin-visualizer";
import { sentryVitePlugin } from "@sentry/vite-plugin";
import { nitro } from "nitro/vite";
import { defineConfig, type PluginOption } from "vite";

const analyze = process.env.ANALYZE === "1";
// No `vercel build` rodando dentro do GitHub Actions, a autodetecção do Nitro
// (std-env) enxerga "GitHub Actions" antes de "Vercel" e cai no preset genérico
// (.output/). O deploy-web força NITRO_PRESET=vercel — esse é o sinal explícito.
const onVercel =
  Boolean(process.env.VERCEL) || process.env.NITRO_PRESET === "vercel";
const sentryAuthToken = process.env.SENTRY_AUTH_TOKEN;

export default defineConfig(({ command }) => ({
  plugins: [
    tanstackStart(),
    // Nitro empacota o servidor do Start pro alvo de deploy (na Vercel detecta
    // o preset sozinho e gera o Build Output API). Só no build: no `vite dev`
    // o servidor do Nitro atende /api antes do `server.proxy` abaixo. O proxy
    // de /api/* mora aqui porque o output do Nitro substitui as rotas do
    // vercel.json — e só no build da Vercel, pra um build local nunca falar
    // com a API de produção.
    ...(command === "build"
      ? [
          nitro({
            // Função SSR/server functions na mesma região da API (Fly gru): o
            // default (iad1) fazia cada chamada cruzar BR → EUA → BR duas vezes.
            vercel: { functions: { regions: ["gru1"] } },
            routeRules: onVercel
              ? { "/api/**": { proxy: "https://usequitto-api.fly.dev/api/**" } }
              : {},
          }),
        ]
      : []),
    react(),
    tailwindcss(),
    ...(analyze
      ? [
          visualizer({
            filename: "dist/stats.html",
            gzipSize: true,
            brotliSize: true,
          }) as PluginOption,
        ]
      : []),
    ...(sentryAuthToken
      ? [
          sentryVitePlugin({
            org: process.env.SENTRY_ORG,
            project: process.env.SENTRY_PROJECT,
            authToken: sentryAuthToken,
            // delete .map files after upload so they are never published on Vercel
            sourcemaps: {
              filesToDeleteAfterUpload: [
                "./.output/**/*.map",
                "./.vercel/output/**/*.map",
              ],
            },
          }),
        ]
      : []),
  ],
  resolve: { alias: { "@": resolve(__dirname, "./src") } },
  server: {
    port: 3001,
    proxy: { "/api": { target: "http://localhost:3000", changeOrigin: true } },
  },
  build: {
    // generate hidden source maps only when uploading to Sentry (token present)
    sourcemap: sentryAuthToken ? "hidden" : false,
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (/[\\/]node_modules[\\/](react|react-dom|scheduler)[\\/]/.test(id)) {
            return "react";
          }
          if (/[\\/]node_modules[\\/]@tanstack[\\/]/.test(id)) {
            return "tanstack";
          }
        },
      },
    },
  },
}));
