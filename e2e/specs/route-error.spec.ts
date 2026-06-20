import { expect, test } from "@playwright/test";
import { signup } from "../fixtures";

const DASHBOARD_GLOB = "**/api/dashboard**";

test("loader que falha mostra a fronteira de erro (não tela branca)", async ({
  page,
}) => {
  await signup(page); // valid session → dashboard

  // Force the dashboard loader to fail persistently
  await page.route(DASHBOARD_GLOB, (route) =>
    route.fulfill({
      status: 500,
      contentType: "application/json",
      body: JSON.stringify({
        error: { code: "INTERNAL", message: "falha simulada" },
      }),
    })
  );

  await page.reload();
  await expect(page.getByText("Ops, algo deu errado")).toBeVisible({
    timeout: 15_000,
  });
});
