/**
 * Serializarea rezultatului unui tool pentru model, cu o limita de caractere.
 *
 * Inainte taiam `JSON.stringify(rezultat).slice(0, N)` - modelul primea JSON rupt la
 * mijlocul unui obiect si il interpreta prost (sau ignora ultimele randuri). Aici
 * rezultatul ramane MEREU JSON valid:
 *  - o lista prea lunga pierde elemente de la coada si primeste o nota
 *    (`trunchiat`, `total`, `afisate`), ca modelul sa stie sa rafineze cautarea;
 *  - orice altceva prea lung devine un obiect cu textul scurtat intr-un camp string.
 */

export const TOOL_RESULT_MAX_CHARS = 6000;

export function serializeToolResult(payload: unknown, maxChars = TOOL_RESULT_MAX_CHARS): string {
  const full = JSON.stringify(payload ?? null);
  if (full.length <= maxChars) return full;

  if (Array.isArray(payload)) {
    // Cautare binara a numarului maxim de elemente care incap, cu tot cu nota.
    let low = 0;
    let high = payload.length;
    const wrap = (count: number) =>
      JSON.stringify({
        rezultate: payload.slice(0, count),
        trunchiat: true,
        total: payload.length,
        afisate: count,
        nota: "Lista a fost scurtată. Restrânge căutarea dacă ai nevoie de alte rezultate.",
      });
    while (low < high) {
      const mid = Math.ceil((low + high) / 2);
      if (wrap(mid).length <= maxChars) low = mid;
      else high = mid - 1;
    }
    const wrapped = wrap(low);
    if (wrapped.length <= maxChars) return wrapped;
  }

  const note = { trunchiat: true, continut: "" };
  const budget = Math.max(0, maxChars - JSON.stringify(note).length);
  // `JSON.stringify` pe string poate lungi textul (escape-uri) - scurtam pana incape.
  let text = full.slice(0, budget);
  while (text.length > 0 && JSON.stringify({ ...note, continut: text }).length > maxChars) {
    text = text.slice(0, Math.floor(text.length * 0.9));
  }
  return JSON.stringify({ ...note, continut: text });
}
