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
    // A fresh account is pt-BR. Without this the browser sends Accept-Language
    // en-US, the first SSR after signup renders en-US and only flips to pt-BR
    // after hydration + /me + a reload, racing with whatever the test does next.
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
      testMatch: /shell\.spec\.ts/,
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
