import { test, expect } from "@playwright/test";
import { mockSteamHappyPath, recommendedGame } from "./helpers/mocks";

test.describe("fluxo principal Steam", () => {
  test("input → consentimento → recomendação com match %", async ({ page }) => {
    await mockSteamHappyPath(page);
    await page.goto("/pt-BR");

    await page.getByLabel("Steam ID ou URL do perfil").fill("e2eplayer");
    await page.getByRole("button", { name: "Ver meu próximo game" }).click();

    await page.getByRole("dialog").getByRole("button", { name: "Li e aceito" }).click();

    await expect(page.getByText("Seu próximo game")).toBeVisible();
    await expect(page.getByRole("heading", { name: recommendedGame.name })).toBeVisible({
      timeout: 60_000,
    });
    await expect(
      page.locator("article span").filter({ hasText: /^\d{2,3}%$/ }),
    ).toBeVisible();
  });
});
