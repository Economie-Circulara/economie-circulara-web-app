import { expect, test } from "@playwright/test";

// Pe domeniul platformei (fara tenant rezolvat), homepage-ul NU afiseaza un brand -
// descrie platforma (vezi src/app/page.tsx si testele lui unitare din page.test.tsx).
test("pagina principala se incarca", async ({ page }) => {
  await page.goto("/");
  await expect(
    page.getByRole("heading", {
      level: 1,
      name: "Trasabilitatea materialelor în economia circulară",
    }),
  ).toBeVisible();
});
