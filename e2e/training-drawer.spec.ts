import { test, expect } from "@playwright/test";
import { mockSteamHappyPath } from "./helpers/mocks";

test.describe("drawer de treinamento TF.js", () => {
  test.use({ viewport: { width: 375, height: 667 } });

  test("fecha com botão e Escape; fundo não recebe clique", async ({ page }) => {
    await mockSteamHappyPath(page);
    await page.goto("/pt-BR");

    await page.getByLabel("Steam ID ou URL do perfil").fill("e2eplayer");
    await page.getByRole("button", { name: "Ver meu próximo game" }).click();
    await page.getByRole("dialog").getByRole("button", { name: "Li e aceito" }).click();

    await expect(page.getByTestId("open-training-drawer")).toBeVisible({
      timeout: 60_000,
    });

    const drawer = page.getByTestId("training-drawer");
    if (!(await drawer.isVisible())) {
      await page.getByTestId("open-training-drawer").click({ force: true });
    }
    await expect(drawer).toBeVisible();

    const behind = page.getByRole("button", { name: "Sim, boa escolha" });
    await expect(behind).toBeVisible();
    const box = await behind.boundingBox();
    if (box) {
      await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
    }
    await expect(drawer).toBeVisible();

    await page.getByTestId("training-drawer-close").click({ force: true });
    await expect(drawer).toBeHidden();

    if (!(await drawer.isVisible())) {
      await page.getByTestId("open-training-drawer").click({ force: true });
    }
    await expect(drawer).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(drawer).toBeHidden();
  });
});
