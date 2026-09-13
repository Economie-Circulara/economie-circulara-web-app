import { expect, test, type Page } from "@playwright/test";

/**
 * Manualul din aplicatie (`/ajutor`): filtrarea pe rol si randarea efectiva a unui
 * document. Verificarea `naturalWidth > 0` e singura care prinde ruperea rutei de
 * imagini sau a `outputFileTracingIncludes` - capturile stau in `docs/manual/img/`,
 * in afara lui `public/`.
 *
 * Necesita Supabase local cu `supabase/seed.sql` aplicat (conturile demo).
 */

const PASSWORD = "password123";

async function login(page: Page, email: string): Promise<void> {
  await page.goto("/login");
  await page.locator("#email").fill(email);
  await page.locator("#password").fill(PASSWORD);
  await page.getByRole("button", { name: "Conectare" }).click();
  await expect(page).not.toHaveURL(/\/login/, { timeout: 15_000 });
}

test.describe("Manual in aplicatie", () => {
  test("adminul citeste manualul, cu capturi si cuprins", async ({ page }) => {
    await login(page, "admin@demo.local");

    await page.goto("/ajutor");
    await expect(page.getByRole("link", { name: /Manual admin \/ operator/ })).toBeVisible();

    await page.getByRole("link", { name: /Manual admin \/ operator/ }).click();
    await page.waitForURL("**/ajutor/utilizare-admin-operator");

    // Cuprinsul lateral + ancora catre prima sectiune.
    const toc = page.getByRole("navigation", { name: "Cuprins" }).last();
    const firstEntry = toc.getByRole("link").first();
    const anchor = await firstEntry.getAttribute("href");
    await firstEntry.click();
    expect(page.url()).toContain(anchor ?? "#");
    await expect(page.locator(`h2[id="${(anchor ?? "#").slice(1)}"]`)).toBeVisible();

    // Capturile se incarca efectiv prin ruta autentificata.
    const image = page.locator('img[src^="/ajutor/img/"]').first();
    await expect(image).toBeVisible();
    await expect
      .poll(() => image.evaluate((el) => (el as HTMLImageElement).naturalWidth))
      .toBeGreaterThan(0);
  });

  test("clientul vede doar manualul de client", async ({ page }) => {
    await login(page, "client@demo.local");

    await page.goto("/ajutor");
    await expect(page.getByRole("link", { name: /Manual portal client/ })).toBeVisible();
    await expect(page.getByRole("link", { name: /Ghid de administrare/ })).toHaveCount(0);

    const response = await page.goto("/ajutor/ghid-administrare");
    expect(response?.status()).toBe(404);
  });

  test("nelogat, manualul si capturile cer autentificare", async ({ page }) => {
    await page.goto("/ajutor");
    await expect(page).toHaveURL(/\/login/);

    await page.goto("/ajutor/img/admin-dashboard.png");
    await expect(page).toHaveURL(/\/login/);
  });
});
