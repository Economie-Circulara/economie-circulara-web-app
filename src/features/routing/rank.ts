/** Subsetul de campuri necesar clasificarii - orice ruta cu distanta+durata poate fi clasificata. */
export interface RankableRoute {
  distanceMeters: number;
  durationSeconds: number;
}

/** Toleranta de egalitate a duratei (decizia 3 din docs/plans/rute-optimizate-livrari.md). */
const DURATION_TIE_TOLERANCE = 0.05;

/**
 * Alege ruta "cea mai buna" dintr-o lista, pastrand ORDINEA originala (indexul
 * intors se refera la `routes`, nu la o copie sortata - UI-ul afiseaza rutele in
 * ordinea primita de la furnizor, doar marcheaza una ca "Recomandata").
 *
 * Criteriu (decizia 3): castiga durata cea mai mica; daca doua sau mai multe rute
 * au durata in limita a 5% fata de minim, castiga distanta cea mai mica dintre ele.
 * La egalitate totala, primul index (stabil).
 *
 * Intoarce -1 pt. o lista goala (apelantul decide ce inseamna "nicio ruta").
 */
export function pickBestRouteIndex(routes: readonly RankableRoute[]): number {
  if (routes.length === 0) return -1;

  const minDuration = Math.min(...routes.map((r) => r.durationSeconds));
  const durationThreshold = minDuration * (1 + DURATION_TIE_TOLERANCE);

  let bestIndex = 0;
  let bestDistance = Infinity;

  routes.forEach((route, index) => {
    if (route.durationSeconds > durationThreshold) return;
    if (route.distanceMeters < bestDistance) {
      bestDistance = route.distanceMeters;
      bestIndex = index;
    }
  });

  return bestIndex;
}
