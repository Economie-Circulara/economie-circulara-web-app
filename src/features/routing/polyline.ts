import type { LatLng } from "./types";

/**
 * Encoded Polyline Algorithm Format (Google) - https://developers.google.com/maps/documentation/utilities/polylinealgorithm
 * Reimplementat aici (fara dependenta noua) - ~20 linii, precizie standard (5
 * zecimale). Folosit de `MockRoutingProvider` (rute deterministe, fara retea) si
 * de teste - `GoogleRoutingProvider` primeste polilinia deja encodata de API si
 * nu trece prin aceasta functie.
 */
function encodeSignedNumber(num: number): string {
  let sgnNum = num << 1;
  if (num < 0) sgnNum = ~sgnNum;
  let result = "";
  while (sgnNum >= 0x20) {
    result += String.fromCharCode((0x20 | (sgnNum & 0x1f)) + 63);
    sgnNum >>= 5;
  }
  result += String.fromCharCode(sgnNum + 63);
  return result;
}

export function encodePolyline(points: readonly LatLng[]): string {
  let lastLat = 0;
  let lastLng = 0;
  let encoded = "";

  for (const point of points) {
    const lat = Math.round(point.lat * 1e5);
    const lng = Math.round(point.lng * 1e5);
    encoded += encodeSignedNumber(lat - lastLat);
    encoded += encodeSignedNumber(lng - lastLng);
    lastLat = lat;
    lastLng = lng;
  }

  return encoded;
}
