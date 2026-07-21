import { expect, test, type Page } from "@playwright/test";

/**
 * Task X4 — E2E pe fluxul complet MVP (docs/handoff.md "MVP - termen si flux",
 * pasii 1-9): organizatie+useri -> client -> itemi/retete -> intrare stoc (lot)
 * -> proces reciclare (input fix/output variabil) -> proces productie (output
 * fix) -> comanda -> acceptare (scade stocul) -> livrare -> inchidere (genereaza
 * automat certificatul) -> vizualizare certificat.
 *
 * NOTA MEDIU (important): acest test are nevoie de un Supabase LOCAL pornit
 * (`pnpm db:start` + `pnpm db:reset` — reseteaza schema si ruleaza
 * `supabase/seed.sql`, care creeaza organizatia demo "Lateris Demo" cu conturile
 * admin/operator/client/super@demo.local, parola `password123`) si de serverul
 * Next.js (pornit automat de `webServer` din playwright.config.ts). Ruleaza-l cu
 * `pnpm test:e2e` intr-un mediu cu Supabase local pornit — vezi
 * docs/plans/task-x4-seed-e2e.md pentru detalii.
 *
 * ATENTIE la variabilele de mediu: Next.js da precedenta variabilelor din mediul
 * OS fata de `.env.local`. Daca sesiunea are setate deja NEXT_PUBLIC_SUPABASE_URL
 * / _PUBLISHABLE_KEY / SUPABASE_SECRET_KEY catre un proiect cloud, ele umbresc
 * `.env.local` si testul ar lovi (mutand date in!) proiectul cloud. Exporta
 * explicit valorile stack-ului local (din `pnpm exec supabase status`) inainte de
 * `pnpm test:e2e` ca sa te asiguri ca fluxul ruleaza pe Supabase local.
 *
 * Pasul 1 din handoff ("Creare organizatie + useri") e acoperit de
 * `supabase/seed.sql`, NU de UI: crearea unei organizatii noi de la zero ar
 * necesita fluxul super-admin -> invitatie email -> setare parola (Supabase
 * Auth), care depinde de livrare reala de email — in afara scope-ului unui
 * test E2E fara provider de email configurat in CI. Testul porneste deci direct
 * cu login ca admin al organizatiei demo deja provizionate.
 */

test.setTimeout(180_000);

const ADMIN_EMAIL = "admin@demo.local";
const ADMIN_PASSWORD = "password123";

// Sufix unic per rulare (timestamp), ca testul sa poata rula repetat pe aceeasi
// baza de date fara coliziuni de unicitate (CUI client, titluri itemi) — nu
// exista curatenie/rollback intre rulari, seed-ul fiind aplicat o singura data
// la `db reset`.
const RUN_STAMP = Date.now();
const RUN_ID = RUN_STAMP.toString(36);

const CLIENT_NAME = `E2E Construct ${RUN_ID} SRL`;
// CUI pur numeric (fara validare stricta de format la creare manuala — doar
// lookup-ul ANAF opțional valideaza formatul, neutilizat in acest test).
const CLIENT_CUI = String(RUN_STAMP);

const ITEM_INPUT_TITLE = `Deșeu test E2E ${RUN_ID}`;
const ITEM_RECYCLED_TITLE = `Agregat reciclat E2E ${RUN_ID}`;
const ITEM_PRODUCT_TITLE = `Produs finit E2E ${RUN_ID}`;

/**
 * Locator dupa eticheta unui camp de formular, tolerant la asteriscul „*”
 * adaugat de `FormField` (src/components/form-field.tsx) campurilor
 * obligatorii — accesible-name-ul devine ex. "CUI*", fara spatiu inainte de
 * asterisc, deci o potrivire exacta ar fi fragila.
 */
function label(page: Page, text: string) {
  return page.getByLabel(text, { exact: false });
}

async function loginAsAdmin(page: Page): Promise<void> {
  await page.goto("/login");
  // Match exact pe "Email": formularul de login are si un al doilea camp email
  // (magic link, eticheta "Sau primeste un link pe email"), deci o potrivire
  // partiala ar prinde ambele campuri (violare de "strict mode").
  await page.getByLabel("Email", { exact: true }).fill(ADMIN_EMAIL);
  await label(page, "Parola").fill(ADMIN_PASSWORD);
  await page.getByRole("button", { name: "Conectare" }).click();
  await expect(page).toHaveURL(/\/dashboard/);
  await expect(page.getByRole("heading", { name: "Dashboard", level: 1 })).toBeVisible();
}

test.describe.configure({ mode: "serial" });

test.describe("Flux complet MVP (handoff.md, pasii 1-9)", () => {
  test("client -> itemi/retete -> stoc -> reciclare -> productie -> comanda -> certificat", async ({
    page,
  }) => {
    await test.step("Pasul 1-2: login admin (org+useri din seed) + client nou", async () => {
      await loginAsAdmin(page);

      await page.goto("/clienti/nou");
      await label(page, "CUI").fill(CLIENT_CUI);
      await label(page, "Denumire").fill(CLIENT_NAME);
      await page.getByRole("button", { name: "Creează clientul" }).click();

      await expect(page).toHaveURL(/\/clienti\/[0-9a-f-]+$/);
      await expect(page.getByRole("heading", { name: CLIENT_NAME, level: 1 })).toBeVisible();
    });

    await test.step("Pasul 3a: itemi noi (materie primă -> reciclat -> produs finit)", async () => {
      await page.goto("/itemi/nou");
      await label(page, "Titlu").fill(ITEM_INPUT_TITLE);
      await label(page, "Unitate de măsură").selectOption({ label: "kg" });
      // Rămâne nevandabil (materie primă internă) și "Fizic" (implicit).
      await page.getByRole("button", { name: "Creează itemul" }).click();
      await expect(page).toHaveURL(/\/itemi$/);

      await page.goto("/itemi/nou");
      await label(page, "Titlu").fill(ITEM_RECYCLED_TITLE);
      await label(page, "Unitate de măsură").selectOption({ label: "kg" });
      await label(page, "Vandabil").check();
      await page.getByRole("button", { name: "Creează itemul" }).click();
      await expect(page).toHaveURL(/\/itemi$/);

      await page.goto("/itemi/nou");
      await label(page, "Titlu").fill(ITEM_PRODUCT_TITLE);
      await label(page, "Unitate de măsură").selectOption({ label: "bucată" });
      await label(page, "Vandabil").check();
      await page.getByRole("button", { name: "Creează itemul" }).click();
      await expect(page).toHaveURL(/\/itemi$/);

      // Lista /itemi e paginata (10/pagina) si sortata alfabetic — cu suficienti
      // itemi demo + cei 3 noi, un item poate cadea pe pagina 2. Filtram dupa
      // RUN_ID (comun celor 3 titluri noi) ca sa le vedem pe toate pe o singura
      // pagina, indiferent de sortare/paginare.
      await page.goto(`/itemi?q=${encodeURIComponent(RUN_ID)}`);
      await expect(page.getByText(ITEM_INPUT_TITLE, { exact: true })).toBeVisible();
      await expect(page.getByText(ITEM_RECYCLED_TITLE, { exact: true })).toBeVisible();
      await expect(page.getByText(ITEM_PRODUCT_TITLE, { exact: true })).toBeVisible();
    });

    await test.step("Pasul 3b: rețete (descompunere reciclare + compoziție produs finit)", async () => {
      // Rețeta itemului de intrare: descompunere 100% în agregatul reciclat
      // (interpretata de 4b — VariableOutputForm — ca fracții de output ideal).
      await page.goto("/retete/nou");
      await label(page, "Item").selectOption({ label: `${ITEM_INPUT_TITLE} (kg)` });
      await page.getByRole("button", { name: "Creează rețeta" }).click();
      await expect(page).toHaveURL(/\/retete\/[0-9a-f-]+$/);

      await label(page, "Item").selectOption({ label: `${ITEM_RECYCLED_TITLE} (kg)` });
      await label(page, "Procent").fill("100");
      await page.getByRole("button", { name: "Adaugă" }).click();
      await expect(page.getByText(ITEM_RECYCLED_TITLE, { exact: true })).toBeVisible();

      // Rețeta produsului finit: compoziție 100% din agregatul reciclat
      // (interpretata de 4a — FixedOutputForm — ca și consum calculat FIFO).
      await page.goto("/retete/nou");
      await label(page, "Item").selectOption({ label: `${ITEM_PRODUCT_TITLE} (bucata)` });
      await page.getByRole("button", { name: "Creează rețeta" }).click();
      await expect(page).toHaveURL(/\/retete\/[0-9a-f-]+$/);

      await label(page, "Item").selectOption({ label: `${ITEM_RECYCLED_TITLE} (kg)` });
      await label(page, "Procent").fill("100");
      await page.getByRole("button", { name: "Adaugă" }).click();
      await expect(page.getByText(ITEM_RECYCLED_TITLE, { exact: true })).toBeVisible();
    });

    await test.step("Pasul 4: intrare stoc — lot nou pentru materia primă", async () => {
      await page.goto("/stoc/nou");
      await label(page, "Item").selectOption({ label: `${ITEM_INPUT_TITLE} (kg)` });
      await label(page, "Cantitate").fill("100");
      await label(page, "Proveniență").selectOption({ label: "Achiziție" });
      await page.getByRole("button", { name: "Înregistrează lotul" }).click();

      await expect(page).toHaveURL(/\/stoc$/);
      // Scopeaza la tabel (nu la intreaga pagina): filtrul "Item" de deasupra
      // tabelului randeaza optiuni cu titlul PUR (fara sufix UM), acelasi text
      // exact ca celula din tabel — fara scopare, `getByText(exact)` ar gasi
      // ambele elemente (violare de "strict mode").
      await expect(
        page.getByRole("table").getByText(ITEM_INPUT_TITLE, { exact: true }),
      ).toBeVisible();
    });

    await test.step("Pasul 5: proces de reciclare (input fix / output variabil)", async () => {
      await page.goto("/productie/nou");
      await page.getByRole("button", { name: /Output variabil/ }).click();

      await label(page, "Material input").selectOption({ label: ITEM_INPUT_TITLE });
      await page.getByPlaceholder("0").fill("50");

      const confirmRecycle = page.getByRole("button", { name: /Finalizează procesul/ });
      await expect(confirmRecycle).toBeEnabled({ timeout: 15_000 });
      await confirmRecycle.click();

      await expect(page).toHaveURL(/\/productie\/[0-9a-f-]+$/);
      await expect(
        page.getByRole("heading", { name: new RegExp(`Proces.*${ITEM_RECYCLED_TITLE}`) }),
      ).toBeVisible();
    });

    await test.step("Pasul 6: proces de producție (output fix) — produsul finit", async () => {
      await page.goto("/productie/nou");
      // Tab implicit "Output fix — Fabricație" — nu mai trebuie schimbat.
      await label(page, "Rețetă / produs").selectOption({ label: ITEM_PRODUCT_TITLE });
      await label(page, "Cantitate output dorită").fill("20");

      const confirmProduce = page.getByRole("button", { name: /Confirmă și pornește/ });
      await expect(confirmProduce).toBeEnabled({ timeout: 15_000 });
      await confirmProduce.click();

      await expect(page).toHaveURL(/\/productie\/[0-9a-f-]+$/);
      await expect(
        page.getByRole("heading", { name: new RegExp(`Proces.*${ITEM_PRODUCT_TITLE}`) }),
      ).toBeVisible();
    });

    await test.step("Pasul 7: comandă nouă în numele clientului", async () => {
      await page.goto("/comenzi/nou");
      await label(page, "Client").selectOption({ label: `${CLIENT_NAME} (${CLIENT_CUI})` });
      await label(page, "Item").selectOption({ label: `${ITEM_PRODUCT_TITLE} (bucata)` });
      await label(page, "Cantitate").fill("5");
      await page.getByRole("button", { name: "Adaugă linie" }).click();
      await expect(page.getByText(ITEM_PRODUCT_TITLE, { exact: true })).toBeVisible();

      await page.getByRole("button", { name: "Creează comanda" }).click();
      await expect(page).toHaveURL(/\/comenzi\/[0-9a-f-]+$/);
      await expect(page.getByRole("heading", { name: "Comandă draft", level: 1 })).toBeVisible();
    });

    await test.step("Pasul 7-8: trimitere + acceptare (scade stocul)", async () => {
      await page.getByRole("button", { name: "Trimite" }).click();
      await expect(page.getByRole("button", { name: "Acceptă" })).toBeVisible();

      await page.getByRole("button", { name: "Acceptă" }).click();
      await expect(page.getByRole("button", { name: "Livrează" })).toBeVisible();
    });

    await test.step("Pasul 9: livrare -> închidere -> certificat automat", async () => {
      await page.getByRole("button", { name: "Livrează" }).click();
      await expect(page.getByRole("button", { name: "Închide" })).toBeVisible();

      await page.getByRole("button", { name: "Închide" }).click();
      const viewCertificate = page.getByRole("link", { name: "Vezi certificat" });
      await expect(viewCertificate).toBeVisible();

      await viewCertificate.click();
      await expect(page).toHaveURL(/\/comenzi\/[0-9a-f-]+\/certificat$/);
      await expect(
        page.getByRole("heading", { name: "Certificat de trasabilitate" }),
      ).toBeVisible();
      await expect(page.getByText(/Nr\. CRT-\d{4}-\d{4}/)).toBeVisible();
      // .first(): titlul produsului apare atat in blocul "Produs(e) livrat(e)"
      // cat si ca eticheta de nod in diagrama Sankey a lantului de trasabilitate.
      await expect(page.getByText(ITEM_PRODUCT_TITLE, { exact: true }).first()).toBeVisible();
    });
  });
});
