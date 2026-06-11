import { test, expect } from "@playwright/test";
import { mockManualHappyPath, mockSteamPrivateProfile, recommendedGame } from "./helpers/mocks";

test.describe("perfil privado → manual", () => {
  test("Steam privado exibe erro e formulário manual entrega recomendação", async ({
    page,
  }) => {
    await mockSteamPrivateProfile(page);
    await mockManualHappyPath(page);

    await page.goto("/pt-BR");
    await page.getByLabel("Steam ID ou URL do perfil").fill("private-user");
    await page.getByRole("button", { name: "Ver meu próximo game" }).click();
    await page.getByRole("dialog").getByRole("button", { name: "Li e aceito" }).click();

    await expect(page.getByText(/formulário manual/i)).toBeVisible();

    await page.getByRole("link", { name: /Preencher manualmente/i }).click();
    await expect(page).toHaveURL(/\/manual/);

    await page.getByLabel("Seu nome ou apelido").fill("Tester Manual");
    await page.getByLabel("Gêneros favoritos (separados por vírgula)").fill("RPG");
    await page.getByLabel("Jogos favoritos (um por linha)").fill("Hollow Knight");
    await page.getByRole("button", { name: "Salvar perfil" }).click();
    await page.getByRole("dialog").getByRole("button", { name: "Li e aceito" }).click();

    await expect(page.getByRole("heading", { name: recommendedGame.name })).toBeVisible({
      timeout: 60_000,
    });
    await expect(
      page.locator("article span").filter({ hasText: /^\d{2,3}%$/ }),
    ).toBeVisible();
  });
});
