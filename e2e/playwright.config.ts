import { defineConfig, devices } from "@playwright/test";

const WEB = "http://localhost:3001";
const API_HEALTH = "http://localhost:3000/api/ping";
// In CI (or with E2E_PROD=1) the specs run against the production build of the
// web (Nitro node-server, built beforehand with NITRO_PRESET=node-server and
// QUITTO_API_PROXY=http://localhost:3000), not the Vite dev server.
const PROD = !!process.env.CI || process.env.E2E_PROD === "1";

export default defineConfig({
  testDir: "./specs",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  // The production build has no per-route compilation, so CI only needs a
  // margin for the 2-core runner. Locally the defaults stay.
  timeout: process.env.CI ? 45_000 : 30_000,
  expect: { timeout: process.env.CI ? 8_000 : 5_000 },
  // The runner has 2 cores shared by the API, the web server and Chromium; the
  // specs wait on the network more than on the CPU, so 2 workers keep it busy.
  workers: process.env.CI ? 2 : undefined,
  reporter: process.env.CI ? "github" : "list",
  use: {
    baseURL: WEB,
    // A fresh account has no language chosen (null), so the browser's
    // Accept-Language decides the UI. Chromium defaults to en-US, and the specs
    // assert pt-BR copy: pin the browser to pt-BR so every page renders it.
    locale: "pt-BR",
    trace: "on-first-retry",
  },
  projects: [
    { name: "chromium", use: { ...devices["Desktop Chrome"] } },
    {
      name: "mobile",
      use: {
        ...devices["Desktop Chrome"],
        viewport: { width: 390, height: 844 },
        hasTouch: true,
        isMobile: true,
      },
      testMatch: [
        "**/shell.spec.ts",
        "**/home*.spec.ts",
        "**/contract-*.spec.ts",
        "**/wizard*.spec.ts",
        "**/invite*.spec.ts",
        "**/contracts-list.spec.ts",
        "**/installments*.spec.ts",
        "**/people*.spec.ts",
        "**/auth.spec.ts",
        "**/settings.spec.ts",
        "**/public-receipt.spec.ts",
        "**/command-palette.spec.ts",
        "**/smoke.spec.ts",
      ],
    },
  ],
  webServer: [
    {
      command: "bun run --filter @quitto/api dev",
      url: API_HEALTH,
      reuseExistingServer: !process.env.CI,
      timeout: 60_000,
    },
    {
      command: PROD
        ? "PORT=3001 node ../apps/web/.output/server/index.mjs"
        : "bun run --filter @quitto/web dev",
      url: WEB,
      reuseExistingServer: !process.env.CI,
      timeout: 60_000,
    },
  ],
});
