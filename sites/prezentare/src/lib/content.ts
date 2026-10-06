/**
 * Continutul site-ului de prezentare al unui tenant (`content/<tenant>.json`).
 *
 * Fisierul e validat la build: un camp obligatoriu lipsa sau o valoare gresita opreste
 * build-ul cu un mesaj clar, in loc sa publice o pagina cu goluri. Cheile de tema sunt
 * aceleasi ca in aplicatie (`src/features/branding/themes.ts`).
 */

export const THEME_KEYS = ["default", "teren", "industrial", "ciclu"] as const;
export type ThemeKey = (typeof THEME_KEYS)[number];

export interface SiteService {
  title: string;
  text: string;
  /** Eticheta scurta de pe card (ex. „Stație proprie”). */
  tag: string | null;
}

export interface SiteCircularStep {
  /** Eticheta pasului (ex. „Intrare”, „Procesare”). */
  label: string;
  title: string;
  text: string;
}

export interface SiteStat {
  value: string;
  label: string;
}

export interface SiteHeroImage {
  /** Cale din `public/`, ex. `/maconxcx/hero/statie-1.webp` (latime ~1920px). */
  src: string;
  alt: string;
}

export interface SiteContent {
  /** Pagina nu e inca finala (texte placeholder) -> `noindex`. */
  draft: boolean;
  /** Numele afisat (poate fi suprascris de `org_branding` la build). */
  name: string;
  /** Hostul aplicatiei tenantului (fara protocol), ex. `circular.etora.ro`. */
  appDomain: string;
  /** Hostul site-ului de prezentare (apex), ex. `etora.ro`. */
  siteDomain: string;
  /** Tema de rezerva, daca nu se poate citi cea din `/platform`. */
  theme: ThemeKey;
  /** Logo local ORIZONTAL (cale din `public/`, ex. `/etora/logo.svg`) - antet. */
  logo: string | null;
  /** Logo local PATRAT (cale din `public/`) - favicon. */
  logoSquare: string | null;
  tagline: string;
  description: string;
  /** Fotografii de fundal pentru hero (optional): una = fundal fix, mai multe = se succed lent. */
  heroImages: SiteHeroImage[];
  about: { title: string; paragraphs: string[] };
  services: { title: string; items: SiteService[] };
  stats: SiteStat[];
  /** Fluxul de economie circulara al firmei (optional - altfel lipseste sectiunea). */
  circular: { title: string; intro: string; steps: SiteCircularStep[]; note: string | null } | null;
  /**
   * Formularul „Cere o ofertă” (optional): serviciile din lista. Cererea ajunge in
   * aplicatie (`https://<appDomain>/api/public/cerere-oferta`) si pe emailul firmei.
   */
  quote: { services: string[] } | null;
  portal: { title: string; text: string; bullets: string[] };
  contact: {
    email: string | null;
    phone: string | null;
    address: string | null;
    hours: string | null;
  };
  legal: { companyName: string; cui: string | null; regCom: string | null };
  /** Mentiunea obligatorie pentru proiectele cu finantare UE (text + sigle din `public/`). */
  euFunding: { text: string; logos: string[] } | null;
}

export class ContentError extends Error {
  constructor(tenant: string, message: string) {
    super(`content/${tenant}.json: ${message}`);
    this.name = "ContentError";
  }
}

type Json = Record<string, unknown>;

const HOST_RE = /^(?=.{1,253}$)([a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,}$/;

export function isThemeKey(value: unknown): value is ThemeKey {
  return typeof value === "string" && (THEME_KEYS as readonly string[]).includes(value);
}

/** Valideaza JSON-ul brut si intoarce continutul tipat (sau arunca `ContentError`). */
export function parseSiteContent(tenant: string, raw: unknown): SiteContent {
  const fail = (message: string): never => {
    throw new ContentError(tenant, message);
  };

  const obj = (value: unknown, path: string): Json =>
    value && typeof value === "object" && !Array.isArray(value)
      ? (value as Json)
      : fail(`${path} trebuie sa fie obiect`);

  const str = (value: unknown, path: string): string =>
    typeof value === "string" && value.trim() !== ""
      ? value.trim()
      : fail(`${path} lipseste sau e gol`);

  const optStr = (value: unknown, path: string): string | null =>
    value === undefined || value === null ? null : str(value, path);

  const arr = (value: unknown, path: string, min: number): unknown[] => {
    if (!Array.isArray(value)) return fail(`${path} trebuie sa fie lista`);
    if (value.length < min) return fail(`${path} trebuie sa aiba cel putin ${min} elemente`);
    return value;
  };

  const host = (value: unknown, path: string): string => {
    const h = str(value, path).toLowerCase();
    return HOST_RE.test(h) ? h : fail(`${path} nu e un domeniu valid (doar hostul, ex. etora.ro)`);
  };

  const root = obj(raw, "radacina");

  const theme = root.theme ?? "default";
  if (!isThemeKey(theme)) fail(`theme trebuie sa fie una din: ${THEME_KEYS.join(", ")}`);

  const localPath = (value: unknown, field: string): string | null => {
    const v = optStr(value, field);
    if (v !== null && !v.startsWith("/"))
      fail(`${field} trebuie sa fie o cale din public/, ex. /etora/logo.svg`);
    return v;
  };
  const logo = localPath(root.logo, "logo");
  const logoSquare = localPath(root.logoSquare, "logoSquare");

  const about = obj(root.about, "about");
  const services = obj(root.services, "services");
  const portal = obj(root.portal, "portal");
  const contact = obj(root.contact, "contact");
  const legal = obj(root.legal, "legal");

  const contactValue = {
    email: optStr(contact.email, "contact.email"),
    phone: optStr(contact.phone, "contact.phone"),
    address: optStr(contact.address, "contact.address"),
    hours: optStr(contact.hours, "contact.hours"),
  };
  if (!contactValue.email && !contactValue.phone) fail("contact are nevoie de email sau telefon");

  let circular: SiteContent["circular"] = null;
  if (root.circular !== undefined && root.circular !== null) {
    const c = obj(root.circular, "circular");
    circular = {
      title: str(c.title, "circular.title"),
      intro: str(c.intro, "circular.intro"),
      steps: arr(c.steps, "circular.steps", 2).map((item, i) => {
        const step = obj(item, `circular.steps[${i}]`);
        return {
          label: str(step.label, `circular.steps[${i}].label`),
          title: str(step.title, `circular.steps[${i}].title`),
          text: str(step.text, `circular.steps[${i}].text`),
        };
      }),
      note: optStr(c.note, "circular.note"),
    };
  }

  let quote: SiteContent["quote"] = null;
  if (root.quote !== undefined && root.quote !== null) {
    const q = obj(root.quote, "quote");
    const services = arr(q.services, "quote.services", 1).map((v, i) =>
      str(v, `quote.services[${i}]`),
    );
    if (new Set(services).size !== services.length) fail("quote.services are valori duplicate");
    quote = { services };
  }

  let euFunding: SiteContent["euFunding"] = null;
  if (root.euFunding !== undefined && root.euFunding !== null) {
    const eu = obj(root.euFunding, "euFunding");
    euFunding = {
      text: str(eu.text, "euFunding.text"),
      logos:
        eu.logos === undefined
          ? []
          : arr(eu.logos, "euFunding.logos", 0).map((l, i) => str(l, `euFunding.logos[${i}]`)),
    };
  }

  return {
    draft: root.draft === true,
    name: str(root.name, "name"),
    appDomain: host(root.appDomain, "appDomain"),
    siteDomain: host(root.siteDomain, "siteDomain"),
    theme: theme as ThemeKey,
    logo,
    logoSquare,
    tagline: str(root.tagline, "tagline"),
    description: str(root.description, "description"),
    heroImages:
      root.heroImages === undefined || root.heroImages === null
        ? []
        : arr(root.heroImages, "heroImages", 0).map((item, i) => {
            const img = obj(item, `heroImages[${i}]`);
            return {
              src:
                localPath(img.src, `heroImages[${i}].src`) ?? fail(`heroImages[${i}].src lipseste`),
              alt: str(img.alt, `heroImages[${i}].alt`),
            };
          }),
    about: {
      title: str(about.title, "about.title"),
      paragraphs: arr(about.paragraphs, "about.paragraphs", 1).map((p, i) =>
        str(p, `about.paragraphs[${i}]`),
      ),
    },
    services: {
      title: str(services.title, "services.title"),
      items: arr(services.items, "services.items", 1).map((item, i) => {
        const s = obj(item, `services.items[${i}]`);
        return {
          title: str(s.title, `services.items[${i}].title`),
          text: str(s.text, `services.items[${i}].text`),
          tag: optStr(s.tag, `services.items[${i}].tag`),
        };
      }),
    },
    stats:
      root.stats === undefined
        ? []
        : arr(root.stats, "stats", 0).map((item, i) => {
            const s = obj(item, `stats[${i}]`);
            return {
              value: str(s.value, `stats[${i}].value`),
              label: str(s.label, `stats[${i}].label`),
            };
          }),
    circular,
    quote,
    portal: {
      title: str(portal.title, "portal.title"),
      text: str(portal.text, "portal.text"),
      bullets: arr(portal.bullets, "portal.bullets", 0).map((b, i) =>
        str(b, `portal.bullets[${i}]`),
      ),
    },
    contact: contactValue,
    legal: {
      companyName: str(legal.companyName, "legal.companyName"),
      cui: optStr(legal.cui, "legal.cui"),
      regCom: optStr(legal.regCom, "legal.regCom"),
    },
    euFunding,
  };
}
