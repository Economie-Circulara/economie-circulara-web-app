import { readFileSync } from "node:fs";
import { defineConfig, devices } from "@playwright/test";

/**
 * E2E config. Browsers are pre-provisioned in the remote dev environment at
 * PLAYWRIGHT_BROWSERS_PATH; `executablePath` is set as a fallback when the pinned
 * Playwright version ships a different browser build.
 */
const chromiumExecutable = process.env.PLAYWRIGHT_CHROMIUM_PATH;

/** Citeste o variabila din `.env.local` (gitignored) fara a o injecta global. */
function fromEnvLocal(name: string): string | undefined {
  try {
    const raw = readFileSync(new URL(".env.local", import.meta.url), "utf8");
    for (const line of raw.split("\n")) {
      const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/);
      if (m && m[1] === name) return m[2].replace(/^["']|["']$/g, "");
    }
  } catch {
    // `.env.local` lipseste — cade pe default-uri / variabile de mediu.
  }
  return undefined;
}

/**
 * Mediul serverului Next pornit pentru E2E. Fortam stack-ul Supabase LOCAL fiindca:
 * (a) fluxul E2E scrie date (clienti, itemi, comenzi) — nu trebuie sa atinga cloud/prod;
 * (b) conturile din seed (admin@demo.local etc.) exista doar local;
 * (c) Next da precedenta variabilelor din mediul OS fata de `.env.local`, deci daca
 *     sesiunea are setate valori cloud, ele ar umbri `.env.local` fara sa observi.
 * URL + cheia publishable sunt default-urile fixe ale Supabase local (nu sunt secrete);
 * cheia SECRET nu se pune in cod — se citeste din `.env.local` sau E2E_SUPABASE_SECRET_KEY.
 * Toate pot fi suprascrise prin E2E_SUPABASE_* daca stack-ul local difera.
 */
const secretKey = process.env.E2E_SUPABASE_SECRET_KEY ?? fromEnvLocal("SUPABASE_SECRET_KEY");
const localSupabaseEnv: Record<string, string> = {
  NEXT_PUBLIC_SUPABASE_URL: process.env.E2E_SUPABASE_URL ?? "http://127.0.0.1:54321",
  NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY:
    process.env.E2E_SUPABASE_PUBLISHABLE_KEY ?? "sb_publishable_ACJWlzQHlZjBrEguHvfOxg_3BJgxAaH",
  ...(secretKey ? { SUPABASE_SECRET_KEY: secretKey } : {}),
};

export default defineConfig({
  testDir: "./tests/e2e",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  reporter: "html",
  // Serverul de dev (Next) compileaza fiecare ruta la primul acces, deci prima
  // navigare/actiune pe o ruta „rece" poate depasi cu mult timeout-ul implicit de
  // 5s al lui `expect`. Ridicam pragul ca suita sa fie robusta pe pornire la rece
  // (nu doar cand `.next` e deja incalzit).
  expect: { timeout: 30_000 },
  use: {
    baseURL: "http://localhost:3000",
    navigationTimeout: 30_000,
    trace: "on-first-retry",
  },
  projects: [
    {
      name: "chromium",
      use: {
        ...devices["Desktop Chrome"],
        ...(chromiumExecutable ? { launchOptions: { executablePath: chromiumExecutable } } : {}),
      },
    },
  ],
  webServer: {
    command: "pnpm dev",
    url: "http://localhost:3000",
    // Nu reutiliza un server pornit din afara: ar putea rula cu env cloud (vezi
    // `localSupabaseEnv`). Pornim mereu unul propriu, cu env-ul Supabase local.
    reuseExistingServer: false,
    env: localSupabaseEnv,
    timeout: 120_000,
  },
});
