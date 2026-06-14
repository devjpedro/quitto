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
    trace: "on-first-retry",
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
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
