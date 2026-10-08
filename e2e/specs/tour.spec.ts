import { expect, test } from "@playwright/test";
import { signup, waitForHydrated } from "../fixtures";

const NOW_STEP = /Agora: o que pede/;

test("tour: abre sozinho na conta nova, anda pelos 5 passos e, pulado, não volta; Refazer em Ajustes abre de novo", async ({
  page,
}) => {
  await signup(page, undefined, { skipTour: false });
  const tour = page.getByRole("dialog", { name: "Tudo começa num contrato" });
  await expect(tour).toBeVisible();
  await expect(tour.getByText("1 de 5")).toBeVisible();
  await tour.getByRole("button", { name: "Próximo" }).click();
  await expect(page.getByRole("dialog", { name: NOW_STEP })).toBeVisible();
  await page.keyboard.press("ArrowRight");
  await expect(
    page.getByRole("dialog", { name: "Contratos e Parcelas" })
  ).toBeVisible();
  await page.keyboard.press("ArrowLeft");
  await expect(page.getByRole("dialog", { name: NOW_STEP })).toBeVisible();
  await page.getByRole("button", { name: "Pular o tour" }).click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  // Saved as seen: a reload does not bring it back.
  await page.reload();
  await waitForHydrated(page);
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  // Ajustes › Perfil: "Refazer o tour".
  await page.goto("/settings/profile");
  await waitForHydrated(page);
  await page.getByRole("button", { name: "Refazer o tour" }).click();
  await expect(
    page.getByRole("dialog", { name: "Tudo começa num contrato" })
  ).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(page.getByRole("dialog")).toHaveCount(0);
});

test("a partir de md só o bloco branco rola: a página fica parada e o Voltar ao topo leva ao início", async ({
  page,
}, testInfo) => {
  // biome-ignore lint/suspicious/noSkippedTests: the phone scrolls the page, as before
  test.skip(testInfo.project.name === "mobile", "no celular a página rola");
  await page.setViewportSize({ width: 1280, height: 600 });
  await signup(page);
  await page.goto("/settings/profile");
  await waitForHydrated(page);
  const panel = page.locator("#conteudo");
  await panel.evaluate((el) => {
    const filler = document.createElement("div");
    filler.style.height = "3000px";
    el.append(filler);
  });
  await panel.evaluate((el) => el.scrollTo({ top: 1500 }));
  const pageScrolled = await page.evaluate(() => window.scrollY);
  expect(pageScrolled).toBe(0);
  expect(await panel.evaluate((el) => el.scrollTop)).toBeGreaterThan(0);
  await page.getByRole("button", { name: "Voltar ao topo" }).click();
  await expect.poll(() => panel.evaluate((el) => el.scrollTop)).toBe(0);
});
