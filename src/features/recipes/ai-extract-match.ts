import type { ExtractedComponent, ItemMatchCandidate, MatchedComponent } from "./ai-extract-types";

/**
 * Potrivire fuzzy intre numele extrase dintr-un text liber si materialele
 * existente ale organizatiei (docs/plans/reteta-ai.md). Fara librarie externa
 * (nu era deja o dependinta in repo) - distanta Levenshtein normalizata e suficient
 * de buna pentru nume scurte de materiale ("Ciment CEM II" vs "ciment").
 */
const MATCH_THRESHOLD = 0.6;

/** minuscule, fara diacritice romanesti, spatii normalizate - comparabil intre surse diferite. */
export function normalizeName(value: string): string {
  return value
    .toLowerCase()
    .replace(/[ăâ]/g, "a")
    .replace(/î/g, "i")
    .replace(/ș/g, "s")
    .replace(/ț/g, "t")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "") // diacritice ramase (accente latine generice)
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
    .replace(/\s+/g, " ");
}

/** Distanta Levenshtein (editare) intre doua siruri. */
function levenshtein(a: string, b: string): number {
  if (a === b) return 0;
  if (a.length === 0) return b.length;
  if (b.length === 0) return a.length;

  let previous = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    const current = [i];
    for (let j = 1; j <= b.length; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      current.push(Math.min(current[j - 1] + 1, previous[j] + 1, previous[j - 1] + cost));
    }
    previous = current;
  }
  return previous[b.length];
}

/**
 * Similaritate 0 (fara nicio legatura) - 1 (identice), pe siruri deja normalizate.
 * Cand un sir e complet continut in celalalt (substring), scorul se ridica direct
 * la un prag mare - acopera cazuri des intalnite ca "ciment" in "ciment cem ii 42.5".
 */
export function similarity(a: string, b: string): number {
  if (a === b) return 1;
  if (a.length === 0 || b.length === 0) return 0;
  if (a.includes(b) || b.includes(a)) {
    const shorter = Math.min(a.length, b.length);
    const longer = Math.max(a.length, b.length);
    return 0.85 + 0.15 * (shorter / longer);
  }
  const distance = levenshtein(a, b);
  const maxLength = Math.max(a.length, b.length);
  return 1 - distance / maxLength;
}

/**
 * Potriveste fiecare componenta extrasa cu cel mai apropiat material existent al
 * organizatiei (dupa nume normalizat). Sub `threshold`, componenta ramane
 * nepotrivita (`itemId: null`) - utilizatorul o alege manual sau o ignora in UI.
 * NU filtreaza dupa unitate de masura - potrivirea e doar dupa NUME; UM diferita
 * fata de rețetă se trateaza in editorul de cantitati (modul avansat / dezactivat).
 */
export function matchComponents(
  extracted: ExtractedComponent[],
  candidates: ItemMatchCandidate[],
  threshold = MATCH_THRESHOLD,
): MatchedComponent[] {
  const normalizedCandidates = candidates.map((c) => ({
    ...c,
    normalized: normalizeName(c.title),
  }));

  return extracted.map((component) => {
    const normalizedName = normalizeName(component.name);
    let best: { candidate: (typeof normalizedCandidates)[number]; score: number } | null = null;

    for (const candidate of normalizedCandidates) {
      const score = similarity(normalizedName, candidate.normalized);
      if (!best || score > best.score) best = { candidate, score };
    }

    if (best && best.score >= threshold) {
      return {
        extracted: component,
        itemId: best.candidate.id,
        itemTitle: best.candidate.title,
        itemUnit: best.candidate.unit,
        confidence: Math.round(best.score * 100) / 100,
      };
    }
    return {
      extracted: component,
      itemId: null,
      itemTitle: null,
      itemUnit: null,
      confidence: best ? Math.round(best.score * 100) / 100 : 0,
    };
  });
}
