import { defineConfig, devices } from "@playwright/test";

const WEB = "http://localhost:3001";
const API_HEALTH = "http://localhost:3000/api/ping";

export default defineConfig({
  testDir: "./specs",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
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
      command: "bun run --filter @quitto/web dev",
      url: WEB,
      reuseExistingServer: !process.env.CI,
      timeout: 60_000,
    },
  ],
});
