import { expect, test, type Page } from "@playwright/test";
import { mkdirSync } from "node:fs";
import { join } from "node:path";

/**
 * Walkthrough manual pre-recepție: parcurge fiecare ecran si fiecare flux
 * principal cu toate cele 4 roluri si, ca produs secundar, salveaza capturile de
 * ecran folosite in `docs/manual/*.md`.
 *
 * NU e parte din suita de regresie (scrie fisiere in `docs/manual/img/` si
 * muta date reale prin fluxul de business). Ruleaza explicit, cu Supabase local
 * pornit si `supabase/seed.sql` aplicat:
 *   pnpm exec playwright test manual-screenshots --workers=1
 *
 * Plasa de siguranta ieftina pentru randare e `tests/e2e/routes-smoke.spec.ts`;
 * fluxul MVP de regresie e `tests/e2e/mvp-flow.spec.ts` (neatins aici).
 */

const PASSWORD = "password123";
const IMG_DIR = join(process.cwd(), "docs", "manual", "img");

/** Sufix unic per rulare — testele creeaza entitati reale, fara cleanup. */
const RUN_ID = Date.now().toString(36);

test.use({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 2 });
test.setTimeout(240_000);
test.describe.configure({ mode: "serial" });

function label(page: Page, text: string) {
  return page.getByLabel(text, { exact: false });
}

async function login(page: Page, email: string): Promise<void> {
  await page.goto("/login");
  await page.locator("#email").fill(email);
  await page.locator("#password").fill(PASSWORD);
  await page.getByRole("button", { name: "Conectare" }).click();
  await expect(page).not.toHaveURL(/\/login/, { timeout: 20_000 });
}

/** Captura intregului viewport, in `docs/manual/img/<name>.png`. */
async function shot(page: Page, name: string): Promise<void> {
  mkdirSync(IMG_DIR, { recursive: true });
  await page.waitForLoadState("networkidle").catch(() => {});
  await page.screenshot({ path: join(IMG_DIR, `${name}.png`) });
}

/** Captura unui singur element (ex. doar sidebar-ul). */
async function shotOf(page: Page, selector: string, name: string): Promise<void> {
  mkdirSync(IMG_DIR, { recursive: true });
  await page.waitForLoadState("networkidle").catch(() => {});
  await page
    .locator(selector)
    .first()
    .screenshot({ path: join(IMG_DIR, `${name}.png`) });
}

test("A. login + dashboard + sidebar + cautare globala (admin)", async ({ page }) => {
  await page.goto("/login");
  await shot(page, "login-admin");
  await shot(page, "client-login");

  await login(page, "admin@demo.local");
  await expect(page).toHaveURL(/\/dashboard/);
  await expect(page.getByRole("heading", { name: "Dashboard", level: 1 })).toBeVisible();
  await shot(page, "admin-dashboard");
  await shotOf(page, "aside", "admin-sidebar");

  // Cele 4 KPI-uri trebuie sa existe si sa aiba cifre, nu sa fie goale.
  for (const kpi of [
    "Comenzi active",
    "De acceptat",
    "Livrate luna aceasta",
    "Certificate emise",
  ]) {
    await expect.soft(page.getByText(kpi, { exact: false }).first()).toBeVisible();
  }

  // Cautare globala din topbar.
  await page.getByRole("searchbox").first().fill("beton");
  await page.keyboard.press("Enter");
  await expect(page).toHaveURL(/\/cautare\?/);
  await shot(page, "admin-search-results");
});

test("B. client nou (lookup ANAF) + documente pe client", async ({ page }) => {
  await login(page, "admin@demo.local");

  await page.goto("/clienti");
  await expect(page.getByRole("heading", { name: "Clienți", level: 1 })).toBeVisible();

  await page.goto("/clienti/nou");
  await shot(page, "admin-client-new");

  // Lookup ANAF: nu trebuie sa dea crash nici cand serviciul extern e indisponibil.
  await label(page, "CUI").fill("14399840");
  await page.getByRole("button", { name: "Caută" }).click();
  await page.waitForTimeout(6_000);
  const lookupName = await label(page, "Denumire").inputValue();
  console.log(`[ANAF] Denumire dupa lookup: "${lookupName}"`);

  if (!lookupName) {
    await label(page, "Denumire").fill(`Walkthrough ${RUN_ID} SRL`);
  }
  await page.getByRole("button", { name: "Creează clientul" }).click();
  await expect(page).toHaveURL(/\/clienti\/[0-9a-f-]+$/);

  // Documente pe clientul demo (folosit si de portalul clientului).
  await page.goto(`/clienti/${process.env.CLIENT_DEMO}`);
  await expect(page.getByText("Documente", { exact: false }).first()).toBeVisible();
  await page
    .locator('input[type="file"]')
    .first()
    .setInputFiles({
      name: `contract-${RUN_ID}.pdf`,
      mimeType: "application/pdf",
      buffer: Buffer.from(
        "%PDF-1.4\n1 0 obj<</Type/Catalog/Pages 2 0 R>>endobj\ntrailer<</Root 1 0 R>>\n%%EOF",
      ),
    });
  const tag = label(page, "Etichetă");
  if (await tag.count()) await tag.first().fill("Contract");
  await page.getByRole("button", { name: "Încarcă" }).click();
  await page.waitForTimeout(3_000);
  await shot(page, "admin-client-documents");
  await expect
    .soft(page.getByText(`contract-${RUN_ID}.pdf`, { exact: false }).first())
    .toBeVisible({ timeout: 10_000 });
});

test("C. itemi + reteta", async ({ page }) => {
  await login(page, "admin@demo.local");

  await page.goto("/itemi");
  await shot(page, "admin-items");
  await expect(page.getByRole("table")).toBeVisible();

  await page.goto("/itemi/nou");
  await label(page, "Titlu").fill(`Agregat walkthrough ${RUN_ID}`);
  await label(page, "Unitate de măsură").selectOption({ label: "tonă" });
  await label(page, "Vandabil").check();
  await page.getByRole("button", { name: "Creează itemul" }).click();
  await expect(page).toHaveURL(/\/itemi$/);

  // Editorul de reteta pe un item care are deja reteta in seed (Cărămizi eco).
  await page.goto("/retete");
  await expect(page.getByRole("heading", { name: "Rețete", level: 1 })).toBeVisible();
  await page.getByText("Cărămizi eco", { exact: true }).first().click();
  await expect(page).toHaveURL(/\/retete\/[0-9a-f-]+$/);
  await shot(page, "admin-recipe-editor");
  // Procentele trebuie sa fie vizibile (reteta din seed nu e goala).
  await expect.soft(page.getByText("%", { exact: false }).first()).toBeVisible();
});

test("D. stoc: lot nou, blocare lot, audit + export CSV", async ({ page }) => {
  await login(page, "admin@demo.local");

  await page.goto("/stoc");
  await expect(page.getByRole("table")).toBeVisible();

  await page.goto("/stoc/nou");
  await shot(page, "admin-stock-new");
  await label(page, "Item").selectOption({ label: "Moloz (tona)" });
  await label(page, "Cantitate").fill("120");
  await label(page, "Proveniență").selectOption({ label: "Achiziție" });
  const sourceField = label(page, "Sursă");
  if (await sourceField.count()) await sourceField.first().fill(`Walkthrough ${RUN_ID}`);
  await page.getByRole("button", { name: "Înregistrează lotul" }).click();
  await expect(page).toHaveURL(/\/stoc$/);

  // Blocare lot (migrarea 0017): cere motiv, apoi lotul iese din stocul disponibil.
  const blockButton = page.getByRole("button", { name: "Blochează" }).first();
  await blockButton.click();
  await label(page, "Motivul blocării").first().fill(`Blocat in walkthrough ${RUN_ID}`);
  await page.getByRole("button", { name: "Confirmă" }).first().click();
  await expect(page.getByRole("button", { name: "Deblochează" }).first()).toBeVisible({
    timeout: 20_000,
  });
  await shot(page, "admin-stock-list");

  // …si deblocarea il readuce in stocul disponibil.
  await page.getByRole("button", { name: "Deblochează" }).first().click();
  await page.waitForTimeout(3_000);

  await page.goto("/stoc/audit");
  await expect(page.getByRole("heading", { name: "Audit stoc", level: 1 })).toBeVisible();
  await shot(page, "admin-stock-audit");
  // Export CSV — trebuie sa porneasca un download real.
  const [download] = await Promise.all([
    page.waitForEvent("download", { timeout: 20_000 }),
    page
      .getByRole("link", { name: /Exportă CSV/ })
      .or(page.getByRole("button", { name: /Exportă CSV/ }))
      .first()
      .click(),
  ]);
  console.log(`[CSV] audit stoc -> ${download.suggestedFilename()}`);
});

test("E. proces reciclare (output variabil)", async ({ page }) => {
  await login(page, "admin@demo.local");

  await page.goto("/productie");
  await expect(page.getByRole("heading", { name: "Producție", level: 1 })).toBeVisible();

  await page.goto("/productie/nou");
  await shot(page, "admin-process-wizard");

  await page.getByRole("button", { name: /Output variabil/ }).click();
  await label(page, "Material input").selectOption({ label: "Moloz" });
  await page.getByPlaceholder("0").first().fill("60");
  const confirm = page.getByRole("button", { name: /Finalizează procesul/ });
  await expect(confirm).toBeEnabled({ timeout: 20_000 });
  await confirm.click();
  await expect(page).toHaveURL(/\/productie\/[0-9a-f-]+$/, { timeout: 30_000 });
});

test("F. proces productie (output fix, consum FIFO) + detaliu Sankey", async ({ page }) => {
  await login(page, "admin@demo.local");

  await page.goto("/productie/nou");
  await label(page, "Rețetă / produs").selectOption({ label: "Cărămizi eco" });
  await label(page, "Cantitate output dorită").fill("30");
  const confirm = page.getByRole("button", { name: /Confirmă și pornește/ });
  await expect(confirm).toBeEnabled({ timeout: 20_000 });
  await confirm.click();
  await expect(page).toHaveURL(/\/productie\/[0-9a-f-]+$/, { timeout: 30_000 });

  await shot(page, "admin-process-detail");
  await expect.soft(page.getByText("Flux materiale", { exact: false })).toBeVisible();
  await expect.soft(page.getByText("Inputuri", { exact: false }).first()).toBeVisible();
  await expect.soft(page.getByText("Outputuri", { exact: false }).first()).toBeVisible();
});

test("G. comanda admin -> trimite -> accepta -> livrare -> inchide -> certificat", async ({
  page,
}) => {
  await login(page, "admin@demo.local");

  await page.goto("/comenzi");
  await expect(page.getByRole("heading", { name: "Comenzi", level: 1 })).toBeVisible();

  await page.goto("/comenzi/nou");
  await label(page, "Client").selectOption({ label: "Client Demo SRL (RO12345678)" });
  await label(page, "Item").selectOption({ label: "Cărămizi eco (bucata)" });
  await label(page, "Cantitate").fill("12");
  await page.getByRole("button", { name: "Adaugă linie" }).click();
  await shot(page, "admin-order-new");
  await page.getByRole("button", { name: "Creează comanda" }).click();
  await expect(page).toHaveURL(/\/comenzi\/[0-9a-f-]+$/, { timeout: 30_000 });

  const orderUrl = page.url();
  console.log(`[ORDER] comanda walkthrough: ${orderUrl}`);

  await page.getByRole("button", { name: "Trimite" }).click();
  await expect(page.getByRole("button", { name: "Acceptă" })).toBeVisible({ timeout: 20_000 });
  await page.getByRole("button", { name: "Acceptă" }).click();
  await expect(page.getByRole("button", { name: "Livrează" })).toBeVisible({ timeout: 20_000 });
  await shot(page, "admin-order-detail");

  // Livrare planificata (Task X5) — butonul exista doar pe comenzi acceptate.
  const planDelivery = page.getByRole("link", { name: /Planifică livrare/ });
  if (await planDelivery.count()) {
    await planDelivery.first().click();
    await expect(page).toHaveURL(/\/livrari\/nou/, { timeout: 20_000 });
    await shot(page, "admin-delivery-new");
    const carrier = label(page, "Transportator");
    if (await carrier.count()) await carrier.first().fill(`Transport ${RUN_ID} SRL`);
    const plate = label(page, "Număr de înmatriculare").or(label(page, "înmatriculare"));
    if (await plate.count()) await plate.first().fill("B 123 ABC");
    const submit = page.getByRole("button", { name: /Planifică|Salvează|Creează/ }).first();
    await submit.click();
    await page.waitForTimeout(3_000);
    await shot(page, "admin-delivery-detail");
    console.log(`[DELIVERY] URL dupa planificare: ${page.url()}`);
  } else {
    console.log("[DELIVERY] butonul Planifica livrare nu exista pe comanda acceptata");
  }

  await page.goto(orderUrl);
  await page.getByRole("button", { name: "Livrează" }).click();
  await expect(page.getByRole("button", { name: "Închide" })).toBeVisible({ timeout: 20_000 });
  await page.getByRole("button", { name: "Închide" }).click();

  const cert = page.getByRole("link", { name: "Vezi certificat" });
  await expect(cert).toBeVisible({ timeout: 30_000 });
  await cert.click();
  await expect(page).toHaveURL(/\/certificat$/);
  await expect(page.getByRole("heading", { name: /Certificat de trasabilitate/ })).toBeVisible();
  await shot(page, "admin-certificate");
});

test("H. retur pe comanda inchisa + acceptare retur", async ({ page }) => {
  await login(page, "admin@demo.local");

  await page.goto(`/comenzi/${process.env.ORDER_CLOSED}`);
  const returnButton = page.getByRole("button", { name: "Retur", exact: true });
  await expect(returnButton).toBeVisible({ timeout: 20_000 });
  await returnButton.click();
  await expect(page.getByText(/Max\. returnabil/).first()).toBeVisible();
  await shot(page, "admin-return-form");

  const qty = page.locator('input[type="text"], input[type="number"]');
  await qty.first().fill("2");
  await page.getByRole("button", { name: "Trimite" }).click();
  await page.waitForTimeout(4_000);
  console.log(`[RETUR] URL dupa creare retur: ${page.url()}`);

  const acceptReturn = page.getByRole("button", { name: /Acceptă retur/ });
  await expect.soft(acceptReturn).toBeVisible({ timeout: 20_000 });
  if (await acceptReturn.count()) {
    await acceptReturn.first().click();
    await page.waitForTimeout(3_000);
    await shot(page, "admin-return-accepted");
  }
});

test("I. rapoarte + export PDF/CSV", async ({ page }) => {
  await login(page, "admin@demo.local");

  await page.goto("/rapoarte");
  await expect(page.getByRole("heading", { name: "Rapoarte", level: 1 })).toBeVisible();
  await shot(page, "admin-reports");

  for (const title of [
    "Comenzi pe perioadă",
    "Livrări",
    "Retururi și garanții",
    "Materiale reciclate",
    "Utilizare PaaS",
    "materii prime secundare",
  ]) {
    await expect.soft(page.getByText(title, { exact: false }).first()).toBeVisible();
  }

  // Aplicarea perioadei nu trebuie sa strice pagina.
  const from = label(page, "De la");
  if (await from.count()) {
    await from.first().fill("2026-01-01");
    await label(page, "Până la").first().fill("2026-12-31");
    await page.getByRole("button", { name: /Aplică perioada/ }).click();
    await page.waitForTimeout(2_000);
    await shot(page, "admin-reports-period");
  }

  // Export PDF + CSV pe primul raport.
  for (const name of [/⤓ PDF/, /⤓ CSV/]) {
    const link = page.getByRole("link", { name }).or(page.getByRole("button", { name })).first();
    if (!(await link.count())) {
      console.log(`[EXPORT] lipseste butonul ${name}`);
      continue;
    }
    try {
      const [download] = await Promise.all([
        page.waitForEvent("download", { timeout: 25_000 }),
        link.click(),
      ]);
      console.log(`[EXPORT] ${name} -> ${download.suggestedFilename()}`);
    } catch (err) {
      console.log(`[EXPORT] ${name} a EȘUAT: ${(err as Error).message}`);
    }
  }
});

test("J. setari organizatie + utilizatori (invitare)", async ({ page }) => {
  await login(page, "admin@demo.local");

  await page.goto("/setari");
  await expect(page.getByRole("heading", { name: /Setări/, level: 1 })).toBeVisible();
  await shot(page, "admin-settings");

  // Salvarea setarilor nu trebuie sa strice tema/organizatia.
  await page.getByRole("button", { name: /Salvează setările/ }).click();
  await page.waitForTimeout(2_000);
  console.log(
    `[SETARI] body dupa salvare conține eroare: ${(
      (await page.locator("body").textContent()) ?? ""
    ).includes("Eroare")}`,
  );

  await page.goto("/setari/utilizatori");
  await expect(page.getByRole("heading", { name: /Utilizatori/, level: 1 })).toBeVisible();
  await shot(page, "admin-users");

  await label(page, "Email").first().fill(`operator-${RUN_ID}@demo.local`);
  const nameField = label(page, "Nume");
  if (await nameField.count()) await nameField.first().fill(`Operator ${RUN_ID}`);
  await page.getByRole("button", { name: "Invită", exact: true }).click();
  await page.waitForTimeout(4_000);
  const body = (await page.locator("body").textContent()) ?? "";
  console.log(
    `[INVITATIE] rezultat: ${body.includes(`operator-${RUN_ID}`) ? "aparut in lista" : "NU apare in lista"}`,
  );
  await shot(page, "admin-users-invited");
});

test("K. portal client: catalog, cos, comanda, retur, documente, certificat", async ({ page }) => {
  await login(page, "client@demo.local");
  await expect(page).toHaveURL(/\/(portal|catalog)/);

  await page.goto("/catalog");
  await expect(page.getByRole("heading", { name: "Catalog", level: 1 })).toBeVisible();
  await shotOf(page, "aside", "client-sidebar");

  // Clientul NU trebuie sa vada preturi nicaieri.
  const catalogText = (await page.locator("main").textContent()) ?? "";
  expect.soft(catalogText, "catalogul afiseaza preturi (lei/RON)").not.toMatch(/\b(lei|RON)\b/);

  await page
    .getByRole("button", { name: /Adaugă în coș/ })
    .first()
    .click();
  await page.waitForTimeout(1_000);
  await shot(page, "client-catalog");

  await page.getByRole("button", { name: /Trimite comanda/ }).click();
  await expect(page).toHaveURL(/\/comenzile-mele\/[0-9a-f-]+$/, { timeout: 30_000 });
  console.log(`[CLIENT] comanda trimisa: ${page.url()}`);

  await page.goto("/comenzile-mele");
  await expect(page.getByRole("heading", { name: /Comenzile mele/, level: 1 })).toBeVisible();
  await shot(page, "client-orders");

  // Detaliul comenzii INCHISE a clientului (creata in testul G) — are „Repetă
  // comanda", „Vezi certificat" si formularul de retur.
  await page.getByRole("link", { name: /CMD-/ }).first().click();
  await expect(page).toHaveURL(/\/comenzile-mele\/[0-9a-f-]+$/);
  await shot(page, "client-order-detail");
  await expect.soft(page.getByRole("button", { name: /Repetă comanda/ })).toBeVisible();

  await page.goto("/documente");
  await expect(page.getByRole("heading", { name: /Documente/, level: 1 })).toBeVisible();
  await shot(page, "client-documents");
});

test("L. super_admin: organizatii, creare, suspendare/reactivare", async ({ page }) => {
  await login(page, "super@demo.local");
  await expect(page).toHaveURL(/\/platform/);
  await shot(page, "superadmin-orgs");

  await page.goto("/platform/nou");
  await expect(page.getByRole("heading", { name: /Organiza/, level: 1 })).toBeVisible();
  await shot(page, "superadmin-org-new");

  await label(page, "Nume organizație").fill(`Walkthrough Org ${RUN_ID}`);
  const emailField = label(page, "Email admin");
  if (await emailField.count()) await emailField.first().fill(`admin-${RUN_ID}@example.com`);
  await page.getByRole("button", { name: /Creează organizația/ }).click();
  await page.waitForTimeout(5_000);
  console.log(`[ORG NOUA] URL: ${page.url()}`);
  console.log(
    `[ORG NOUA] body: ${((await page.locator("body").textContent()) ?? "").slice(0, 400)}`,
  );

  // Suspendare/reactivare pe o organizatie care NU e cea demo (ca sa nu blocheze
  // restul walkthrough-ului).
  await page.goto("/platform");
  const row = page.getByRole("row", { name: /Org A/ });
  const suspend = row.getByRole("button", { name: /Suspendă/ });
  if (await suspend.count()) {
    await suspend.first().click();
    await page
      .getByRole("button", { name: /Confirmă/ })
      .first()
      .click();
    await page.waitForTimeout(2_000);
    await shot(page, "superadmin-orgs-suspend");
    const reactivate = page
      .getByRole("row", { name: /Org A/ })
      .getByRole("button", { name: /Reactivează/ });
    await expect.soft(reactivate, "butonul Reactivează nu a apărut").toBeVisible();
    if (await reactivate.count()) {
      await reactivate.first().click();
      await page
        .getByRole("button", { name: /Confirmă/ })
        .first()
        .click();
      await page.waitForTimeout(2_000);
    }
  } else {
    console.log("[SUSPENDARE] butonul Suspendă nu a fost gasit pe rândul Org A");
  }
});

test("M. anulare comanda acceptata — stocul se reface (migrarea 0018)", async ({ page }) => {
  await login(page, "admin@demo.local");

  await page.goto("/comenzi/nou");
  await label(page, "Client").selectOption({ label: "Client Demo SRL (RO12345678)" });
  await label(page, "Item").selectOption({ label: "Cărămizi eco (bucata)" });
  await label(page, "Cantitate").fill("7");
  await page.getByRole("button", { name: "Adaugă linie" }).click();
  await page.getByRole("button", { name: "Creează comanda" }).click();
  await expect(page).toHaveURL(/\/comenzi\/[0-9a-f-]+$/, { timeout: 30_000 });
  console.log(`[ANULARE] comanda: ${page.url()}`);

  await page.getByRole("button", { name: "Trimite" }).click();
  await expect(page.getByRole("button", { name: "Acceptă" })).toBeVisible({ timeout: 20_000 });
  await page.getByRole("button", { name: "Acceptă" }).click();
  await expect(page.getByRole("button", { name: "Livrează" })).toBeVisible({ timeout: 20_000 });

  await page.getByRole("button", { name: "Anulează" }).click();
  await page.waitForTimeout(4_000);
  console.log(
    `[ANULARE] status dupa anulare: ${((await page.locator("body").textContent()) ?? "").includes("Anulată") ? "Anulată" : "NU e Anulată"}`,
  );

  // Evenimentul de stornare trebuie sa apara in auditul de stoc.
  await page.goto("/stoc/audit");
  await expect
    .soft(
      page
        .getByRole("table")
        .getByText(/Stornare/i)
        .first(),
      "lipseste evenimentul Stornare",
    )
    .toBeVisible({ timeout: 20_000 });
  await shot(page, "admin-stock-audit-reversal");
});

/**
 * Pas DOAR-CITIRE pentru capturile din manual: nu scrie nimic in baza, deci poate
 * rula imediat dupa `pnpm db:reset` si produce imagini cu date demo curate (fara
 * entitatile create de testele de flux de mai sus).
 */
test("N. capturi read-only din datele demo curate", async ({ page }) => {
  await page.goto("/login");
  await shot(page, "login-admin");
  await shot(page, "client-login");

  await login(page, "admin@demo.local");
  await shot(page, "admin-dashboard");
  await shotOf(page, "aside", "admin-sidebar");

  for (const [path, name] of [
    ["/clienti/nou", "admin-client-new"],
    ["/itemi", "admin-items"],
    ["/stoc", "admin-stock-list"],
    ["/stoc/nou", "admin-stock-new"],
    ["/stoc/audit", "admin-stock-audit"],
    ["/productie", "admin-processes"],
    ["/productie/nou", "admin-process-wizard"],
    ["/comenzi", "admin-orders"],
    ["/comenzi/nou", "admin-order-new"],
    ["/rapoarte", "admin-reports"],
    ["/setari", "admin-settings"],
    ["/setari/utilizatori", "admin-users"],
    ["/cautare?q=beton", "admin-search-results"],
  ] as const) {
    await page.goto(path);
    await shot(page, name);
  }

  // Detaliul comenzii inchise din seed + certificatul ei + procesul cu diagrama.
  await page.goto("/comenzi");
  await page
    .getByRole("link", { name: /CMD-2026-0001/ })
    .first()
    .click();
  await expect(page).toHaveURL(/\/comenzi\/[0-9a-f-]+$/);
  await shot(page, "admin-order-detail");

  const cert = page.getByRole("link", { name: /Vezi certificat/ });
  if (await cert.count()) {
    await cert.first().click();
    await shot(page, "admin-certificate");
  }

  await page.goto("/productie");
  await page.getByRole("table").getByRole("link").first().click();
  await expect(page).toHaveURL(/\/productie\/[0-9a-f-]+$/);
  await shot(page, "admin-process-detail");

  // Detaliul clientului demo (secțiunea Documente).
  // Randurile din /clienti NU sunt link-uri: `ClientTable` navigheaza prin
  // `onRowClick` (router.push) pe <tr> — de aceea se apasa randul, nu un link.
  await page.goto("/clienti");
  await page
    .getByRole("row", { name: /Client Demo SRL/ })
    .first()
    .click();
  await expect(page).toHaveURL(/\/clienti\/[0-9a-f-]+$/);
  await shot(page, "admin-client-documents");

  // Editorul de reteta.
  await page.goto("/retete");
  await page.getByText("Cărămizi eco", { exact: true }).first().click();
  await shot(page, "admin-recipe-editor");
});

test("O. capturi read-only portal client + super_admin", async ({ page }) => {
  await login(page, "client@demo.local");
  await page.goto("/catalog");
  await shotOf(page, "aside", "client-sidebar");
  await shot(page, "client-catalog");
  await page.goto("/comenzile-mele");
  await shot(page, "client-orders");
  await page.goto("/documente");
  await shot(page, "client-documents");

  const ctx = page.context();
  await ctx.clearCookies();
  await login(page, "super@demo.local");
  await shot(page, "superadmin-orgs");
  await page.goto("/platform/nou");
  await shot(page, "superadmin-org-new");
});
