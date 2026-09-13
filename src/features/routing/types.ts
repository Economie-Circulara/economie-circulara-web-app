/** Coordonata geografica (WGS84) - folosita atat pt. geocodare cat si pt. calculul de rute. */
export interface LatLng {
  lat: number;
  lng: number;
}

/** Adresa structurata trimisa la geocodare - vezi 0024_route_planning.sql (motivul structurarii). */
export interface GeocodeInput {
  /** Adresa completa, text liber - folosita ca fallback/context (mereu prezenta). */
  address: string;
  street?: string | null;
  streetNumber?: string | null;
  locality?: string | null;
  county?: string | null;
  postalCode?: string | null;
}

export interface GeocodeResult {
  lat: number;
  lng: number;
  /** Adresa asa cum a normalizat-o furnizorul - utila pt. verificare vizuala, nu persistata. */
  formattedAddress: string;
}

/** O varianta de ruta calculata intre doua puncte. */
export interface RouteOption {
  distanceMeters: number;
  durationSeconds: number;
  /** Geometria rutei, encoded polyline (algoritmul Google) - vezi `./polyline.ts`. */
  polyline: string;
  /** Eticheta scurta pt. UI (ex. "Ruta 1", "Ruta 2 (ocolire)") - informativa, nu persistata separat. */
  label: string;
}

export interface ComputeRoutesInput {
  origin: LatLng;
  destination: LatLng;
  /** Momentul de plecare folosit pt. evaluarea traficului (implicit: acum, la apelul providerului). */
  departureTime?: Date;
}

/**
 * Interfata comuna intre logica de business (`service.ts`) si furnizorul real de
 * rutare - acelasi pattern ca `ETransportProvider` (`src/features/deliveries/e-transport.ts`):
 * un singur punct de contact, usor de mock-uit in teste si de inlocuit (ex. HERE, daca
 * restrictiile de tonaj pt. camioane devin necesare - vezi docs/plans/rute-optimizate-livrari.md).
 */
export interface RoutingProvider {
  geocode(input: GeocodeInput): Promise<GeocodeResult>;
  computeRoutes(input: ComputeRoutesInput): Promise<RouteOption[]>;
}

/** Furnizorul de rutare nu e configurat (lipseste GOOGLE_MAPS_API_KEY in productie). */
export class RoutingNotConfiguredError extends Error {
  constructor(message = "Planificarea rutelor nu este configurată (cheie API lipsă).") {
    super(message);
    this.name = "RoutingNotConfiguredError";
  }
}

/** Adresa nu a putut fi geocodata (nu s-au gasit coordonate). */
export class AddressNotFoundError extends Error {
  constructor(message = "Adresa nu a putut fi localizată pe hartă.") {
    super(message);
    this.name = "AddressNotFoundError";
  }
}

/** Furnizorul a raspuns cu o eroare (indisponibilitate, cota depasita, raspuns invalid). */
export class RoutingProviderError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "RoutingProviderError";
  }
}
