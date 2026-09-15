"use client";

import { useEffect, useMemo } from "react";
import { CircleMarker, MapContainer, Polyline, TileLayer, Tooltip, useMap } from "react-leaflet";
import type { LatLngBoundsExpression, LatLngTuple } from "leaflet";
import "leaflet/dist/leaflet.css";
import { decodePolyline } from "./polyline";
import type { RouteChoiceView } from "./route-actions";

const ALTERNATIVE_ROUTE_COLOR = "#9CA3AF";
const DEFAULT_RECOMMENDED_COLOR = "#2563EB";
const ORIGIN_COLOR = "#16A34A";
const DESTINATION_COLOR = "#DC2626";
/** Centrul Romaniei - vedere initiala, inlocuita imediat de `FitBounds`. */
const FALLBACK_CENTER: LatLngTuple = [45.9443, 25.0094];
const FALLBACK_ZOOM = 6;

function isValidHexColor(hex: string | null | undefined): hex is string {
  return !!hex && /^#[0-9a-fA-F]{6}$/.test(hex);
}

/** Recentreaza/reincadreaza harta ori de cate ori `bounds` se schimba (fara sa remonteze `MapContainer`). */
function FitBounds({ bounds }: { bounds: LatLngBoundsExpression }) {
  const map = useMap();
  useEffect(() => {
    map.fitBounds(bounds, { padding: [24, 24] });
  }, [map, bounds]);
  return null;
}

export interface RouteMapProps {
  routes: readonly RouteChoiceView[];
  selectedIndex: number;
  /** Culoarea primara a tenantului (hex) - implicit un albastru neutru. */
  recommendedColor?: string | null;
  className?: string;
}

/**
 * Harta interactiva (Leaflet + OpenStreetMap, fara cheie API) a variantelor de
 * ruta - inlocuieste imaginea statica generata server-side (Maps Static API):
 * datele (poliliniile) vin deja in raspunsul serverului (`RouteChoiceView.polyline`),
 * deci se actualizeaza live la schimbarea selectiei, fara alt round-trip catre
 * server si fara sa expuna vreo cheie Google in browser.
 */
export function RouteMap({ routes, selectedIndex, recommendedColor, className }: RouteMapProps) {
  const decoded = useMemo(() => routes.map((route) => decodePolyline(route.polyline)), [routes]);

  const bounds = useMemo<LatLngBoundsExpression | null>(() => {
    const points = decoded.flat();
    if (points.length === 0) return null;
    let minLat = points[0].lat;
    let maxLat = points[0].lat;
    let minLng = points[0].lng;
    let maxLng = points[0].lng;
    for (const point of points) {
      minLat = Math.min(minLat, point.lat);
      maxLat = Math.max(maxLat, point.lat);
      minLng = Math.min(minLng, point.lng);
      maxLng = Math.max(maxLng, point.lng);
    }
    return [
      [minLat, minLng],
      [maxLat, maxLng],
    ];
  }, [decoded]);

  // Toate variantele calculate intr-o cerere impart aceeasi origine/destinatie
  // (primul/ultimul punct al oricarei polilinii decodate) - vezi acelasi motiv
  // documentat la `renderStoredRouteStaticMapDataUrl` (route-service.ts).
  const origin = decoded[0]?.[0];
  const destination = decoded[0]?.[decoded[0].length - 1];

  if (!bounds || !origin || !destination) return null;

  const color = isValidHexColor(recommendedColor) ? recommendedColor : DEFAULT_RECOMMENDED_COLOR;
  // Nerecomandatele se deseneaza intai (gri), varianta selectata ULTIMA (deasupra) -
  // acelasi ordonare ca in `static-map.ts#buildUrl`, pastrata pt. consistenta vizuala.
  const ordered = decoded
    .map((points, index) => ({ points, index }))
    .sort((a, b) => Number(a.index === selectedIndex) - Number(b.index === selectedIndex));

  return (
    <div className={className ?? "h-72 w-full overflow-hidden rounded-md border"}>
      <MapContainer
        center={FALLBACK_CENTER}
        zoom={FALLBACK_ZOOM}
        scrollWheelZoom={false}
        className="h-full w-full"
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        <FitBounds bounds={bounds} />
        {ordered.map(({ points, index }) => (
          <Polyline
            key={index}
            positions={points.map((p) => [p.lat, p.lng] as LatLngTuple)}
            pathOptions={{
              color: index === selectedIndex ? color : ALTERNATIVE_ROUTE_COLOR,
              weight: index === selectedIndex ? 5 : 3,
            }}
          />
        ))}
        <CircleMarker
          center={[origin.lat, origin.lng]}
          radius={8}
          pathOptions={{ color: ORIGIN_COLOR, fillColor: ORIGIN_COLOR, fillOpacity: 1 }}
        >
          <Tooltip permanent direction="top" offset={[0, -8]}>
            A
          </Tooltip>
        </CircleMarker>
        <CircleMarker
          center={[destination.lat, destination.lng]}
          radius={8}
          pathOptions={{ color: DESTINATION_COLOR, fillColor: DESTINATION_COLOR, fillOpacity: 1 }}
        >
          <Tooltip permanent direction="top" offset={[0, -8]}>
            B
          </Tooltip>
        </CircleMarker>
      </MapContainer>
    </div>
  );
}
