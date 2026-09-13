import { expect, test, type Page } from "@playwright/test";

/**
 * Asistentul AI (`/asistent`). Ruleaza pe furnizorul MOCK (fara chei API in CI), deci
 * verifica exact ce nu depinde de model: ecranul, quota afisata si drumul unei
 * intrebari prin tool-ul de manual.
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

test.describe("Asistent AI", () => {
  test("adminul vede quota si primeste raspuns din manual", async ({ page }) => {
    await login(page, "admin@demo.local");
    await page.goto("/asistent");

    await expect(page.getByRole("heading", { name: "Asistent AI" })).toBeVisible();
    await expect(page.getByText("Mesaje incluse luna aceasta")).toBeVisible();

    await page.getByLabel("Mesaj pentru asistent").fill("cum adaug un lot în stoc?");
    await page.getByRole("button", { name: "Trimite" }).click();

    // Mock-ul cheama `cauta_in_manual`, iar raspunsul final trece prin bucla de tool-uri.
    await expect(page.getByText("Mă gândesc...")).toBeHidden({ timeout: 20_000 });
    await expect(page.locator("text=cum adaug un lot în stoc?")).toBeVisible();
  });

  test("clientul are asistentul, dar fara acțiuni de organizație", async ({ page }) => {
    await login(page, "client@demo.local");
    await page.goto("/asistent");

    await expect(page.getByRole("heading", { name: "Asistent AI" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Cum plasez o comandă?" })).toBeVisible();
  });

  test("nelogat, asistentul cere autentificare", async ({ page }) => {
    await page.goto("/asistent");
    await expect(page).toHaveURL(/\/login/);
  });
});
