import { decodePolyline, encodePolyline } from "./polyline";
import type { LatLng } from "./types";

const STATIC_MAP_BASE_URL = "https://maps.googleapis.com/maps/api/staticmap";
const DEFAULT_WIDTH = 640;
const DEFAULT_HEIGHT = 400;
/** Gri neutru pt. rutele nerecomandate - vezi `buildStaticMapUrl`. */
const ALTERNATIVE_ROUTE_COLOR = "9CA3AF";
const DEFAULT_RECOMMENDED_COLOR = "2563EB";
/**
 * Maps Static API respinge cereri peste 8192 caractere - marja de siguranta pt.
 * restul query string-ului (size/key/markers). Poliliniile MOCK (2-3 puncte) nu
 * se apropie niciodata de limita, dar o ruta REALA (Google Routes API, strazi
 * urbane) poate avea sute/mii de puncte si depaseste usor limita - vezi
 * `decimatePolyline`.
 */
const MAX_URL_LENGTH = 8000;
/** Numarul de incercari de simplificare inainte sa trimitem oricum URL-ul (mai bine o harta usor mai putin precisa decat deloc). */
const MAX_SIMPLIFY_ATTEMPTS = 6;

export interface StaticMapRouteInput {
  polyline: string;
  /** Ruta recomandata se deseneaza ULTIMA (deasupra celorlalte) si cu culoarea tenantului. */
  recommended: boolean;
}

export interface BuildStaticMapUrlInput {
  origin: LatLng;
  destination: LatLng;
  routes: readonly StaticMapRouteInput[];
  apiKey: string;
  /** Culoarea primara a tenantului (hex, cu sau fara '#') - implicit un albastru neutru. */
  recommendedColor?: string | null;
  width?: number;
  height?: number;
}

/** Normalizeaza un hex de culoare la formatul cerut de Static Maps (`0xRRGGBB`), cu fallback. */
function toStaticMapColor(hex: string | null | undefined, fallback: string): string {
  const cleaned = (hex ?? "").replace(/^#/, "").trim();
  const valid = /^[0-9a-fA-F]{6}$/.test(cleaned) ? cleaned : fallback;
  return `0x${valid}`;
}

/**
 * Pastreaza doar 1 din `keepEvery` puncte ale unei polilinii (mereu primul si
 * ultimul) - reduce lungimea codificata fara sa schimbe vizibil traseul la
 * scara unui preview mic. `keepEvery <= 1` intoarce polilinia neschimbata.
 */
function decimatePolyline(encoded: string, keepEvery: number): string {
  if (keepEvery <= 1) return encoded;
  const points = decodePolyline(encoded);
  if (points.length <= 2) return encoded;
  const kept = points.filter((_, i) => i % keepEvery === 0 || i === points.length - 1);
  return encodePolyline(kept);
}

function buildUrl(input: BuildStaticMapUrlInput, keepEvery: number): string {
  const url = new URL(STATIC_MAP_BASE_URL);
  url.searchParams.set("size", `${input.width ?? DEFAULT_WIDTH}x${input.height ?? DEFAULT_HEIGHT}`);
  url.searchParams.set("key", input.apiKey);

  url.searchParams.append("markers", `color:green|label:A|${input.origin.lat},${input.origin.lng}`);
  url.searchParams.append(
    "markers",
    `color:red|label:B|${input.destination.lat},${input.destination.lng}`,
  );

  const ordered = [...input.routes].sort((a, b) => Number(a.recommended) - Number(b.recommended));
  for (const route of ordered) {
    const color = route.recommended
      ? toStaticMapColor(input.recommendedColor, DEFAULT_RECOMMENDED_COLOR)
      : `0x${ALTERNATIVE_ROUTE_COLOR}`;
    const polyline = decimatePolyline(route.polyline, keepEvery);
    url.searchParams.append("path", `weight:5|color:${color}|enc:${polyline}`);
  }

  return url.toString();
}

/**
 * Construieste URL-ul Google Maps Static API pt. un preview cu 1-N rute intre
 * origine si destinatie - randat de un route handler propriu (cheia NU ajunge in
 * HTML, vezi docs/plans/rute-optimizate-livrari.md, decizia 2). Rutele NErecomandate
 * se deseneaza intai (gri), apoi ruta recomandata deasupra (culoarea tenantului) -
 * asa raman vizibile ambele chiar acolo unde traseele se suprapun.
 *
 * Daca URL-ul cu poliliniile complete depaseste limita Maps Static API (rute REALE,
 * nu mock - vezi `MAX_URL_LENGTH`), le simplificam progresiv (`decimatePolyline`)
 * pana incape, in loc sa esueze cererea intreaga.
 */
export function buildStaticMapUrl(input: BuildStaticMapUrlInput): string {
  let keepEvery = 1;
  let url = buildUrl(input, keepEvery);
  for (let attempt = 0; url.length > MAX_URL_LENGTH && attempt < MAX_SIMPLIFY_ATTEMPTS; attempt++) {
    keepEvery += 1;
    url = buildUrl(input, keepEvery);
  }
  return url;
}
