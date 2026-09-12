import { expect, test } from "@playwright/test";

test("pagina principala se incarca", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { name: "Lot cu Lot" })).toBeVisible();
});
