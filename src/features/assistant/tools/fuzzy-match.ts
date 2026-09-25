/**
 * Potrivire toleranta pentru cautarile asistentului. Modelul scrie des altfel decat e
 * salvat in DB („Beton SRL” vs „SC BETON S.R.L.”, „pietris” vs „Pietriș 4-8”), iar
 * `ilike '%...%'` pe tot textul nu gaseste nimic - fiecare cautare goala costa o runda
 * de model. Aici: fara diacritice, fara majuscule/punctuatie, fara forma juridica, si
 * TOATE cuvintele cautate trebuie sa apara (in orice ordine).
 */

/** Forme juridice si cuvinte de umplutura ignorate la potrivire. */
const STOPWORDS = new Set([
  "sc",
  "srl",
  "sa",
  "pfa",
  "ii",
  "if",
  "snc",
  "sca",
  "firma",
  "societatea",
]);

export function normalizeText(text: string): string {
  return (
    text
      .normalize("NFD")
      .replace(/[̀-ͯ]/g, "")
      .toLowerCase()
      // „S.R.L.” -> „srl” inainte de a transforma restul punctuatiei in spatii.
      .replace(/\b([a-z])\.(?=[a-z]\.)/g, "$1")
      .replace(/\b([a-z])\.(?=\s|$)/g, "$1")
      .replace(/[^a-z0-9]+/g, " ")
      .trim()
  );
}

export function searchTokens(query: string): string[] {
  return normalizeText(query)
    .split(" ")
    .filter((token) => token && !STOPWORDS.has(token));
}

/** Adevarat daca TOATE cuvintele semnificative din `query` apar in `text`. */
export function fuzzyMatches(text: string, query: string): boolean {
  const tokens = searchTokens(query);
  if (tokens.length === 0) return true;
  const haystack = normalizeText(text);
  return tokens.every((token) => haystack.includes(token));
}

export function fuzzyFilter<T>(rows: T[], query: string, textOf: (row: T) => string): T[] {
  return rows.filter((row) => fuzzyMatches(textOf(row), query));
}
