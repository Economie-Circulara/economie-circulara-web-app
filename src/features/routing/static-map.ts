import type { LatLng } from "./types";

const STATIC_MAP_BASE_URL = "https://maps.googleapis.com/maps/api/staticmap";
const DEFAULT_WIDTH = 640;
const DEFAULT_HEIGHT = 400;
/** Gri neutru pt. rutele nerecomandate - vezi `buildStaticMapUrl`. */
const ALTERNATIVE_ROUTE_COLOR = "9CA3AF";
const DEFAULT_RECOMMENDED_COLOR = "2563EB";

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
 * Construieste URL-ul Google Maps Static API pt. un preview cu 1-N rute intre
 * origine si destinatie - randat de un route handler propriu (cheia NU ajunge in
 * HTML, vezi docs/plans/rute-optimizate-livrari.md, decizia 2). Rutele NErecomandate
 * se deseneaza intai (gri), apoi ruta recomandata deasupra (culoarea tenantului) -
 * asa raman vizibile ambele chiar acolo unde traseele se suprapun.
 */
export function buildStaticMapUrl(input: BuildStaticMapUrlInput): string {
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
    url.searchParams.append("path", `weight:5|color:${color}|enc:${route.polyline}`);
  }

  return url.toString();
}
