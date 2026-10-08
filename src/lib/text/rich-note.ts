/**
 * Formatare minima pentru notele libere (nota de comanda, observatiile livrarii) -
 * decizie 2026-10-08: text liber, fara editor vizual, dar afisat „frumos” pe ecran si
 * pe aviz. Sintaxa (un subset mic de Markdown, explicat langa campuri):
 *   - randurile se pastreaza; un rand gol desparte paragrafele;
 *   - un rand care incepe cu `- ` sau `* ` e un element de lista;
 *   - `**text**` = ingrosat.
 *
 * Parserul intoarce STRUCTURA (blocuri + segmente), nu HTML: randarea pe ecran
 * (`RichNote`) si in PDF (`PdfRichNote`) folosesc aceleasi blocuri, iar textul
 * utilizatorului nu ajunge niciodata interpretat ca markup (nimic de curatat).
 */

export interface RichNoteSegment {
  text: string;
  bold: boolean;
}

/** Un rand de text, impartit in segmente normale/ingrosate. */
export type RichNoteLine = RichNoteSegment[];

export type RichNoteBlock =
  | { type: "paragraph"; lines: RichNoteLine[] }
  | { type: "list"; items: RichNoteLine[] };

const LIST_ITEM = /^\s*[-*]\s+(.*)$/;

/** Imparte un rand in segmente; un `**` fara pereche ramane text simplu. */
export function parseInline(line: string): RichNoteLine {
  const segments: RichNoteLine = [];
  let rest = line;
  while (rest.length > 0) {
    const start = rest.indexOf("**");
    const end = start === -1 ? -1 : rest.indexOf("**", start + 2);
    if (start === -1 || end === -1 || end === start + 2) {
      segments.push({ text: rest, bold: false });
      break;
    }
    if (start > 0) segments.push({ text: rest.slice(0, start), bold: false });
    segments.push({ text: rest.slice(start + 2, end), bold: true });
    rest = rest.slice(end + 2);
  }
  return segments;
}

/** Textul brut -> blocuri. Text gol (sau doar spatii) -> lista goala. */
export function parseRichNote(text: string | null | undefined): RichNoteBlock[] {
  const blocks: RichNoteBlock[] = [];
  let current: RichNoteBlock | null = null;

  for (const rawLine of (text ?? "").replace(/\r\n?/g, "\n").split("\n")) {
    const line = rawLine.trimEnd();
    if (!line.trim()) {
      current = null;
      continue;
    }
    const listMatch = LIST_ITEM.exec(line);
    if (listMatch) {
      if (current?.type !== "list") {
        current = { type: "list", items: [] };
        blocks.push(current);
      }
      current.items.push(parseInline(listMatch[1]));
    } else {
      if (current?.type !== "paragraph") {
        current = { type: "paragraph", lines: [] };
        blocks.push(current);
      }
      current.lines.push(parseInline(line.trim()));
    }
  }
  return blocks;
}

/** Hint-ul afisat sub campurile de note (aceeasi formulare peste tot). */
export const RICH_NOTE_HINT =
  "Rând nou păstrat; „- ” la început de rând = listă; **text** = îngroșat.";
