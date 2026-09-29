/**
 * Brandingul setat de super-admin in aplicatie (`/platform/<id>`: tema si logo),
 * citit la BUILD prin RPC-ul anonim `org_branding` (migrarea 0045) - acelasi pe care
 * il foloseste ecranul de login al aplicatiei. Asa site-ul nu copiaza de mana tema
 * sau logo-ul: dupa o schimbare in `/platform`, un redeploy al site-ului e suficient.
 *
 * Fara `SUPABASE_URL` / `SUPABASE_PUBLISHABLE_KEY`, sau daca apelul esueaza, raman
 * valorile din fisierul de continut - build-ul nu cade din cauza brandingului.
 */

import { isThemeKey, type SiteContent, type ThemeKey } from "./content";

export interface ResolvedBranding {
  name: string;
  theme: ThemeKey;
  /** Logo pentru antet (orizontal, altfel patrat); `null` -> wordmark text. */
  logo: string | null;
  /** Logo pentru favicon (patrat, altfel orizontal); `null` -> iconita implicita. */
  icon: string | null;
  /** De unde vine brandingul - afisat in logul de build. */
  source: "platform" | "content";
}

export interface BrandingEnv {
  SUPABASE_URL?: string;
  SUPABASE_PUBLISHABLE_KEY?: string;
}

type FetchLike = (
  input: string,
  init: RequestInit,
) => Promise<Pick<Response, "ok" | "status" | "json">>;

interface OrgBrandingRow {
  logo_url: string | null;
  logo_square_url?: string | null;
  theme: string | null;
}

interface Logos {
  inline: string | null;
  square: string | null;
}

/**
 * Aceeasi regula ca `inlineLogoOf` / `squareLogoOf` din aplicatie
 * (src/features/branding/logos.ts): fiecare loc foloseste varianta potrivita, iar
 * cealalta e rezerva cand lipseste.
 */
function pickLogos({ inline, square }: Logos): { logo: string | null; icon: string | null } {
  return { logo: inline || square || null, icon: square || inline || null };
}

export function fromContent(content: SiteContent): ResolvedBranding {
  return {
    name: content.name,
    theme: content.theme,
    ...pickLogos({ inline: content.logo, square: content.logoSquare }),
    source: "content",
  };
}

export async function resolveBranding(
  content: SiteContent,
  env: BrandingEnv,
  fetchImpl: FetchLike = fetch,
  log: (message: string) => void = console.warn,
): Promise<ResolvedBranding> {
  const fallback = fromContent(content);
  const url = env.SUPABASE_URL?.trim().replace(/\/+$/, "");
  const key = env.SUPABASE_PUBLISHABLE_KEY?.trim();
  if (!url || !key) return fallback;

  let row: OrgBrandingRow | undefined;
  try {
    const res = await fetchImpl(`${url}/rest/v1/rpc/org_branding`, {
      method: "POST",
      headers: { apikey: key, Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify({ p_slug: null, p_domain: content.appDomain }),
    });
    if (!res.ok) {
      log(`[branding] org_branding a raspuns ${res.status}; raman valorile din content.`);
      return fallback;
    }
    const data = (await res.json()) as OrgBrandingRow[] | OrgBrandingRow | null;
    row = Array.isArray(data) ? data[0] : (data ?? undefined);
  } catch (error) {
    log(`[branding] org_branding indisponibil (${String(error)}); raman valorile din content.`);
    return fallback;
  }

  if (!row) {
    log(`[branding] nicio organizatie activa pe ${content.appDomain}; raman valorile din content.`);
    return fallback;
  }

  return {
    // Numele ramane cel de marketing din content (in DB e de regula denumirea legala).
    name: content.name,
    theme: isThemeKey(row.theme) ? row.theme : content.theme,
    // Un logo pus explicit in repo (calitate controlata) are prioritate fata de cel din aplicatie.
    ...pickLogos({
      inline: content.logo ?? (row.logo_url?.trim() || null),
      square: content.logoSquare ?? (row.logo_square_url?.trim() || null),
    }),
    source: "platform",
  };
}
