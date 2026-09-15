import { decodePolyline } from "./polyline";
import { getRoutingProvider } from "./provider";
import { pickBestRouteIndex } from "./rank";
import { buildStaticMapUrl } from "./static-map";
import type { GeocodeInput, LatLng, RouteOption } from "./types";

export interface DeliveryRouteComputation {
  routes: RouteOption[];
  bestIndex: number;
  origin: LatLng;
  destination: LatLng;
}

/**
 * Geocodeaza origine + destinatie si calculeaza variantele de ruta intre ele,
 * marcand indexul recomandat (`pickBestRouteIndex`). Functie de business PURA
 * (fara scriere in DB) - persistarea pe o livrare se face separat, in
 * `src/features/deliveries/service.ts` (aceeasi separare ca la
 * `src/features/deliveries/e-transport.ts`, care nici el nu atinge DB-ul).
 */
export async function computeRouteBetween(
  originInput: GeocodeInput,
  destinationInput: GeocodeInput,
  departureTime?: Date,
): Promise<DeliveryRouteComputation> {
  const provider = getRoutingProvider();
  const [originGeo, destinationGeo] = await Promise.all([
    provider.geocode(originInput),
    provider.geocode(destinationInput),
  ]);

  const origin: LatLng = { lat: originGeo.lat, lng: originGeo.lng };
  const destination: LatLng = { lat: destinationGeo.lat, lng: destinationGeo.lng };

  const routes = await provider.computeRoutes({ origin, destination, departureTime });
  const bestIndex = pickBestRouteIndex(routes);

  return { routes, bestIndex, origin, destination };
}

/**
 * Randeaza un preview static (Google Maps Static API) al variantelor calculate,
 * ca imagine data-URI (base64) - cheia Google NU paraseste niciodata serverul
 * (nu ajunge in HTML/network tab-ul browserului, spre deosebire de un URL trimis
 * direct catre client). `null` cand nu exista `GOOGLE_MAPS_API_KEY` (mod mock) sau
 * cand cererea catre Maps Static API esueaza - apelantul afiseaza lista de rute
 * fara harta in acest caz (planificarea ramane posibila, doar fara preview vizual).
 */
export async function renderRouteStaticMapDataUrl(input: {
  origin: LatLng;
  destination: LatLng;
  routes: readonly RouteOption[];
  bestIndex: number;
  recommendedColor?: string | null;
}): Promise<string | null> {
  const apiKey = process.env.GOOGLE_MAPS_API_KEY;
  if (!apiKey) return null;

  const url = buildStaticMapUrl({
    origin: input.origin,
    destination: input.destination,
    apiKey,
    recommendedColor: input.recommendedColor,
    routes: input.routes.map((route, index) => ({
      polyline: route.polyline,
      recommended: index === input.bestIndex,
    })),
  });

  try {
    const response = await fetch(url);
    if (!response.ok) {
      // Raspunsul Static Maps e text simplu si explica exact motivul (ex. API
      // neactivat, cheie restrictionata, billing lipsa) - fara asta, un eșec aici
      // era complet silentios (mapDataUrl: null, fara nicio urma in loguri).
      const body = await response.text().catch(() => "");
      console.error(
        `[routing] Google Maps Static API a răspuns ${response.status}: ${body.slice(0, 500)}`,
      );
      return null;
    }
    const buffer = Buffer.from(await response.arrayBuffer());
    return `data:image/png;base64,${buffer.toString("base64")}`;
  } catch (err) {
    console.error("[routing] Cererea către Google Maps Static API a eșuat:", err);
    return null;
  }
}

/**
 * Randeaza preview-ul unei rute deja STOCATE (`deliveries.route_alternatives`),
 * ex. pe ecranul de detaliu al livrarii - fara sa mai apeleze geocodarea si FARA
 * sa fi pastrat coordonatele originii/destinatiei separat: primul/ultimul punct al
 * unei polilinii decodate (`decodePolyline`) SUNT originea/destinatia (identice pe
 * toate variantele calculate in acelasi request).
 */
export async function renderStoredRouteStaticMapDataUrl(input: {
  routes: readonly RouteOption[];
  selectedIndex: number;
  recommendedColor?: string | null;
}): Promise<string | null> {
  const reference = input.routes[input.selectedIndex] ?? input.routes[0];
  if (!reference) return null;

  const points = decodePolyline(reference.polyline);
  const origin = points[0];
  const destination = points[points.length - 1];
  if (!origin || !destination) return null;

  return renderRouteStaticMapDataUrl({
    origin,
    destination,
    routes: input.routes,
    bestIndex: input.selectedIndex,
    recommendedColor: input.recommendedColor,
  });
}
