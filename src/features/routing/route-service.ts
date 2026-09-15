import { getRoutingProvider } from "./provider";
import { pickBestRouteIndex } from "./rank";
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
