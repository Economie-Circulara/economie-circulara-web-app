import { createHash } from "node:crypto";
import { encodePolyline } from "./polyline";
import {
  AddressNotFoundError,
  RoutingNotConfiguredError,
  RoutingProviderError,
  type ComputeRoutesInput,
  type GeocodeInput,
  type GeocodeResult,
  type LatLng,
  type RouteOption,
  type RoutingProvider,
} from "./types";

/**
 * Adapterul de rutare (Task X7 - docs/plans/rute-optimizate-livrari.md). Acelasi
 * pattern ca `src/features/deliveries/e-transport.ts`: TOATA logica de business
 * (calcularea + salvarea rutei, `service.ts`) e construita in spatele acestei
 * interfete minimale; furnizorul real (Google) se activeaza doar cand exista
 * `GOOGLE_MAPS_API_KEY`, altfel ramane implicit `mock` (dev/teste/preview fara cheie).
 *
 * Selectie provider prin env `ROUTING_PROVIDER` ("google" | orice altceva -> mock).
 */

const EARTH_RADIUS_M = 6_371_000;

function toRadians(deg: number): number {
  return (deg * Math.PI) / 180;
}

/** Distanta in linie dreapta (haversine) - baza pt. rutele deterministe din mock. */
function haversineMeters(a: LatLng, b: LatLng): number {
  const dLat = toRadians(b.lat - a.lat);
  const dLng = toRadians(b.lng - a.lng);
  const lat1 = toRadians(a.lat);
  const lat2 = toRadians(b.lat);

  const h = Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return 2 * EARTH_RADIUS_M * Math.asin(Math.min(1, Math.sqrt(h)));
}

/** Hash stabil [0, 1) dintr-un sir - folosit pt. variatie determinista in mock (nu Math.random). */
function stableUnit(input: string): number {
  const hash = createHash("sha256").update(input).digest();
  return hash.readUInt32BE(0) / 0xffffffff;
}

/**
 * Provider MOCK - folosit implicit cat timp lipseste `GOOGLE_MAPS_API_KEY` (dev,
 * teste, preview). NU apeleaza nicio retea:
 *  - `geocode`: coordonate deterministe derivate dintr-un hash al adresei, centrate
 *    pe Iasi (BASE_LAT/BASE_LNG) - suficient pt. a exercita fluxul UI, FARA sa
 *    pretinda acuratete geografica reala.
 *  - `computeRoutes`: 2 variante derivate din distanta in linie dreapta (haversine)
 *    intre origine si destinatie - o ruta "directa" (viteza medie mai mare) si o
 *    "alternativa" (~15% mai lunga, putin mai rapida per km - simuleaza un ocol care
 *    evita traficul), ambele cu polilinie encodata REAL (2 puncte) prin `encodePolyline`.
 */
export class MockRoutingProvider implements RoutingProvider {
  private static readonly BASE_LAT = 47.1585;
  private static readonly BASE_LNG = 27.6014;

  async geocode(input: GeocodeInput): Promise<GeocodeResult> {
    const key = [input.street, input.streetNumber, input.locality, input.county, input.address]
      .filter(Boolean)
      .join(", ");
    if (!key.trim()) throw new AddressNotFoundError();

    // Deplasare determinista de +/- ~0.15 grade (~15km) fata de centrul Iasi.
    const latOffset = (stableUnit(`${key}:lat`) - 0.5) * 0.3;
    const lngOffset = (stableUnit(`${key}:lng`) - 0.5) * 0.3;

    return {
      lat: MockRoutingProvider.BASE_LAT + latOffset,
      lng: MockRoutingProvider.BASE_LNG + lngOffset,
      formattedAddress: input.address,
    };
  }

  async computeRoutes(input: ComputeRoutesInput): Promise<RouteOption[]> {
    const distance = haversineMeters(input.origin, input.destination);
    // ~40 km/h medie in oras/DN - suficient pt. o demonstratie plauzibila, nu o estimare reala.
    const AVG_SPEED_MPS = 40_000 / 3600;

    const direct: RouteOption = {
      distanceMeters: Math.round(distance),
      durationSeconds: Math.round(distance / AVG_SPEED_MPS),
      polyline: encodePolyline([input.origin, input.destination]),
      label: "Ruta directă",
    };

    const midpoint: LatLng = {
      lat: (input.origin.lat + input.destination.lat) / 2 + 0.01,
      lng: (input.origin.lng + input.destination.lng) / 2 + 0.01,
    };
    const alternativeDistance = distance * 1.15;
    const alternative: RouteOption = {
      distanceMeters: Math.round(alternativeDistance),
      // Putin mai rapida per metru (evita un ambuteiaj ipotetic), dar per total
      // rareori bate ruta directa - exercita ambele ramuri ale `pickBestRouteIndex`.
      durationSeconds: Math.round((alternativeDistance / AVG_SPEED_MPS) * 0.97),
      polyline: encodePolyline([input.origin, midpoint, input.destination]),
      label: "Rută alternativă (ocolire)",
    };

    return [direct, alternative];
  }
}

interface GoogleProviderConfig {
  apiKey?: string;
}

const GEOCODE_URL = "https://maps.googleapis.com/maps/api/geocode/json";
const ROUTES_URL = "https://routes.googleapis.com/directions/v2:computeRoutes";

/**
 * Provider REAL - Google Geocoding API + Routes API v2 (`computeRoutes`,
 * `computeAlternativeRoutes: true`, `routingPreference: TRAFFIC_AWARE`).
 * Cheia se citeste DOAR pe server (`GOOGLE_MAPS_API_KEY`, niciodata expusa clientului -
 * vezi si `static-map.ts`, care proxy-aza imaginea prin propriul route handler).
 */
export class GoogleRoutingProvider implements RoutingProvider {
  constructor(
    private readonly config: GoogleProviderConfig = { apiKey: process.env.GOOGLE_MAPS_API_KEY },
  ) {}

  private requireApiKey(): string {
    if (!this.config.apiKey) throw new RoutingNotConfiguredError();
    return this.config.apiKey;
  }

  async geocode(input: GeocodeInput): Promise<GeocodeResult> {
    const apiKey = this.requireApiKey();
    // Componentele structurate (cand exista) dau rezultate mai precise decat textul
    // liber - dar cat timp UI-ul nu le colecteaza inca (vezi site-form.tsx), cazul
    // curent e MEREU fallback pe `input.address`. Nu folosim "România" singur ca
    // adresa (ar geocoda tara, nu adresa) - țara se adauga DOAR peste componente
    // structurate reale.
    const structured = [
      input.street && input.streetNumber ? `${input.street} ${input.streetNumber}` : input.street,
      input.locality,
      input.county,
      input.postalCode,
    ].filter(Boolean);
    const address = structured.length > 0 ? `${structured.join(", ")}, România` : input.address;

    const url = new URL(GEOCODE_URL);
    url.searchParams.set("address", address);
    url.searchParams.set("key", apiKey);

    let response: Response;
    try {
      response = await fetch(url.toString());
    } catch {
      throw new RoutingProviderError("Nu am putut contacta serviciul de geocodare Google.");
    }
    if (!response.ok) {
      throw new RoutingProviderError(`Geocodarea a răspuns cu eroare (status ${response.status}).`);
    }

    const payload = (await response.json()) as {
      status: string;
      results?: Array<{
        formatted_address: string;
        geometry: { location: { lat: number; lng: number } };
      }>;
    };

    const first = payload.results?.[0];
    if (payload.status !== "OK" || !first) {
      throw new AddressNotFoundError();
    }

    return {
      lat: first.geometry.location.lat,
      lng: first.geometry.location.lng,
      formattedAddress: first.formatted_address,
    };
  }

  async computeRoutes(input: ComputeRoutesInput): Promise<RouteOption[]> {
    const apiKey = this.requireApiKey();

    const body = {
      origin: { location: { latLng: { latitude: input.origin.lat, longitude: input.origin.lng } } },
      destination: {
        location: { latLng: { latitude: input.destination.lat, longitude: input.destination.lng } },
      },
      travelMode: "DRIVE",
      routingPreference: "TRAFFIC_AWARE",
      computeAlternativeRoutes: true,
      ...(input.departureTime ? { departureTime: input.departureTime.toISOString() } : {}),
    };

    let response: Response;
    try {
      response = await fetch(ROUTES_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Goog-Api-Key": apiKey,
          "X-Goog-FieldMask":
            "routes.duration,routes.distanceMeters,routes.polyline.encodedPolyline",
        },
        body: JSON.stringify(body),
      });
    } catch {
      throw new RoutingProviderError("Nu am putut contacta Google Routes API.");
    }
    if (!response.ok) {
      throw new RoutingProviderError(
        `Google Routes API a răspuns cu eroare (status ${response.status}).`,
      );
    }

    const payload = (await response.json()) as {
      routes?: Array<{
        distanceMeters: number;
        duration: string; // ex. "1234s"
        polyline?: { encodedPolyline: string };
      }>;
    };

    const routes = payload.routes ?? [];
    if (routes.length === 0) {
      throw new RoutingProviderError("Google Routes API nu a returnat nicio rută.");
    }

    return routes.map((route, index) => ({
      distanceMeters: route.distanceMeters,
      durationSeconds: Number.parseInt(route.duration.replace(/s$/, ""), 10) || 0,
      polyline: route.polyline?.encodedPolyline ?? "",
      label: index === 0 ? "Ruta recomandată de Google" : `Rută alternativă ${index}`,
    }));
  }
}

/**
 * Selecteaza providerul activ dupa `ROUTING_PROVIDER` (implicit `mock`). O
 * instanta noua per apel (fara stare proprie) - acelasi pattern ca
 * `getETransportProvider` din `src/features/deliveries/e-transport.ts`.
 */
export function getRoutingProvider(): RoutingProvider {
  const selected = (process.env.ROUTING_PROVIDER ?? "mock").trim().toLowerCase();
  if (selected === "google") return new GoogleRoutingProvider();
  return new MockRoutingProvider();
}
