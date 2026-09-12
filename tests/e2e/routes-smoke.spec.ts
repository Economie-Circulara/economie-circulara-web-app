import { expect, test, type Page } from "@playwright/test";
import { CLIENT_NAV, STAFF_NAV } from "@/components/layout/nav-config";

/**
 * Smoke test de rute — plasa de siguranta pentru erorile de RANDARE care NU sunt
 * prinse de `typecheck` / `lint` / testele unitare / `pnpm build`.
 *
 * De ce exista: in 2026-09 toate ecranele pentru admin/operator/client au dat 500
 * fiindca `NavItem.icon` ducea o componenta Lucide din layout-ul SERVER in
 * `Sidebar` (`"use client"`) — eroare de serializare RSC, invizibila la build si
 * la testele unitare (vezi comentariul din `src/components/layout/nav-config.ts`).
 * Orice eroare de acelasi tip (prop neserializabil, hook in server component,
 * query rupt) cade aici, ieftin: un GET per ruta, fara interactiune.
 *
 * Lista de rute NU e duplicata: rutele principale se citesc din `nav-config.ts`,
 * adica exact navigatia reala; doar sub-rutele care nu apar in sidebar (formulare
 * `/nou`, auth) sunt enumerate explicit. Rutele de DETALIU (`/comenzi/[id]` etc.)
 * sunt acoperite de `tests/e2e/mvp-flow.spec.ts`, care creeaza entitatile.
 *
 * Necesita Supabase local cu `supabase/seed.sql` aplicat (conturile demo).
 */

const PASSWORD = "password123";

/** Rutele din sidebar-ul rolului — sursa unica de adevar, `nav-config.ts`. */
const staffNavRoutes = STAFF_NAV.map((item) => item.href);
const clientNavRoutes = CLIENT_NAV.map((item) => item.href);

/** Sub-rute care nu apar in sidebar (formulare de creare, căutare, auth). */
const STAFF_EXTRA_ROUTES = [
  "/comenzi/nou",
  // `/livrari/nou` NU e in lista: cere `?orderId=` (altfel `notFound()`, prin
  // design) — e acoperit de fluxul din `mvp-flow.spec.ts`.
  "/stoc/nou",
  "/productie/nou",
  "/clienti/nou",
  "/itemi/nou",
  "/retete/nou",
  "/cautare?q=beton",
];
const CLIENT_EXTRA_ROUTES = ["/portal", "/cauta?q=beton"];
const ADMIN_ONLY_ROUTES = ["/setari/utilizatori"];
const SUPER_ADMIN_ROUTES = ["/platform", "/platform/nou"];
const PUBLIC_ROUTES = ["/login", "/forgot-password"];

/** Text afisat de error boundary-ul Next cand randarea eseuaza. */
const RENDER_ERROR_MARKERS = ["This page couldn’t load", "This page couldn't load"];

async function login(page: Page, email: string): Promise<void> {
  await page.goto("/login");
  await page.locator("#email").fill(email);
  await page.locator("#password").fill(PASSWORD);
  await page.getByRole("button", { name: "Conectare" }).click();
  await expect(page).not.toHaveURL(/\/login/, { timeout: 15_000 });
}

/** GET pe o ruta + afirmatiile de smoke: 2xx/3xx si fara error boundary. */
async function expectRenders(page: Page, path: string): Promise<void> {
  const pageErrors: string[] = [];
  const onPageError = (err: Error) => pageErrors.push(err.message);
  page.on("pageerror", onPageError);

  const response = await page.goto(path, { waitUntil: "domcontentloaded" });
  const status = response?.status() ?? 0;

  expect(status, `${path} a raspuns ${status}`).toBeLessThan(400);

  const body = (await page.locator("body").textContent()) ?? "";
  for (const marker of RENDER_ERROR_MARKERS) {
    expect(body, `${path} a randat error boundary-ul Next`).not.toContain(marker);
  }
  // Un ecran randat are intotdeauna un <h1> (toate paginile folosesc PageHeader).
  await expect(page.locator("h1").first(), `${path} nu are <h1>`).toBeVisible();
  await expect
    .poll(
      () =>
        page.evaluate(
          () => document.documentElement.scrollWidth <= document.documentElement.clientWidth,
        ),
      { message: `${path} are overflow orizontal la nivel de pagina` },
    )
    .toBe(true);

  page.off("pageerror", onPageError);
  expect(pageErrors, `${path} a aruncat erori de runtime: ${pageErrors.join(" | ")}`).toEqual([]);
}

test.describe("Smoke de randare pe toate rutele", () => {
  test("rute publice (nelogat)", async ({ page }) => {
    for (const route of PUBLIC_ROUTES) {
      await expectRenders(page, route);
    }
  });

  test("admin vede toate rutele staff", async ({ page }) => {
    await login(page, "admin@demo.local");
    for (const route of [...staffNavRoutes, ...STAFF_EXTRA_ROUTES, ...ADMIN_ONLY_ROUTES]) {
      await expectRenders(page, route);
    }
  });

  test("operator vede rutele staff fara Setari", async ({ page }) => {
    await login(page, "operator@demo.local");
    const operatorNav = STAFF_NAV.filter((item) => item.roles.includes("operator")).map(
      (item) => item.href,
    );
    for (const route of [...operatorNav, ...STAFF_EXTRA_ROUTES]) {
      await expectRenders(page, route);
    }
  });

  test("client vede doar portalul", async ({ page }) => {
    await login(page, "client@demo.local");
    for (const route of [...clientNavRoutes, ...CLIENT_EXTRA_ROUTES]) {
      await expectRenders(page, route);
    }
  });

  test("super_admin vede administrarea platformei", async ({ page }) => {
    await login(page, "super@demo.local");
    for (const route of SUPER_ADMIN_ROUTES) {
      await expectRenders(page, route);
    }
  });

  test("guard: clientul nu ajunge pe ecranele staff", async ({ page }) => {
    await login(page, "client@demo.local");
    for (const route of [...staffNavRoutes, "/platform", "/stoc/audit"]) {
      await page.goto(route, { waitUntil: "domcontentloaded" });
      // `homePathForRole("client")` = `/portal`, care redirecteaza mai departe la `/catalog`.
      await expect(page, `${route} nu a fost blocat pentru rolul client`).toHaveURL(
        /\/(portal|catalog)/,
      );
    }
  });

  test("guard: nelogat e trimis la /login", async ({ page }) => {
    for (const route of ["/dashboard", "/catalog", "/platform"]) {
      await page.goto(route, { waitUntil: "domcontentloaded" });
      await expect(page, `${route} nu a redirectat la /login`).toHaveURL(/\/login/);
    }
  });
});
