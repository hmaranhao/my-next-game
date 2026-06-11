import { test, expect } from "@playwright/test";

test.describe("i18n", () => {
  test("alterna pt-BR → en-US na UI principal", async ({ page }) => {
    await page.goto("/pt-BR");
    await expect(
      page.getByRole("button", { name: "Ver meu próximo game" }),
    ).toBeVisible();

    await page.getByLabel("Idioma").selectOption("en-US");

    await expect(page).toHaveURL(/\/en-US/);
    await expect(
      page.getByRole("button", { name: "See my next game" }),
    ).toBeVisible();
  });
});
