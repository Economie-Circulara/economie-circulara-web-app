import GithubSlugger from "github-slugger";

export interface TocEntry {
  id: string;
  text: string;
  level: 2 | 3;
}

/** Titlu ATX (`## ...`), inclusiv h1/h4+ - le parcurgem pe toate (vezi `extractToc`). */
const HEADING_RE = /^(#{1,6})\s+(.+?)\s*$/;
/** Deschiderea/inchiderea unui bloc de cod (``` sau ~~~). */
const FENCE_RE = /^\s*(?:```|~~~)/;
/** Sufixul de id explicit: `### Titlu {#id-ales-de-mana}`. */
const EXPLICIT_ID_RE = /\s*\{#([^}\s]+)\}\s*$/;

/** Scoate markup-ul inline, ca sa ramana exact textul pe care il vede si `rehype-slug`. */
function stripInlineMarkdown(raw: string): string {
  return raw
    .replace(/!\[([^\]]*)\]\([^)]*\)/g, "$1")
    .replace(/\[([^\]]+)\]\([^)]*\)/g, "$1")
    .replace(/`([^`]+)`/g, "$1")
    .replace(/(\*\*|__)(.+?)\1/g, "$2")
    .replace(/(\*|_)(\S(?:.*?\S)?)\1/g, "$2")
    .replace(/\s+#+\s*$/, "")
    .trim();
}

/**
 * Textul curat + id-ul unui titlu. Sluggerul e pasat din afara si e unul singur
 * per document, ca dedublarea (`-1`, `-2`) sa fie identica cu cea din `rehype-slug`.
 * Un titlu cu id explicit (`{#...}`) NU consuma sluggerul - la fel ca `rehype-slug`,
 * care sare peste titlurile care au deja `id`.
 */
export function headingSlug(raw: string, slugger: GithubSlugger): { text: string; id: string } {
  const explicit = EXPLICIT_ID_RE.exec(raw);
  const text = stripInlineMarkdown(explicit ? raw.replace(EXPLICIT_ID_RE, "") : raw);
  return { text, id: explicit ? explicit[1] : slugger.slug(text) };
}

/**
 * Cuprinsul unui document: titlurile h2/h3, in ordinea din text. Titlurile din
 * blocurile de cod sunt ignorate; h1 si h4+ nu apar in cuprins, dar trec prin
 * slugger fiindca si `rehype-slug` le numeroteaza (conteaza la titluri duplicate).
 */
export function extractToc(markdown: string): TocEntry[] {
  const slugger = new GithubSlugger();
  const entries: TocEntry[] = [];
  let insideFence = false;

  for (const line of markdown.split(/\r?\n/)) {
    if (FENCE_RE.test(line)) {
      insideFence = !insideFence;
      continue;
    }
    if (insideFence) continue;

    const match = HEADING_RE.exec(line);
    if (!match) continue;

    const level = match[1].length;
    const { text, id } = headingSlug(match[2], slugger);
    if (!text || level < 2 || level > 3) continue;

    entries.push({ id, text, level: level as 2 | 3 });
  }

  return entries;
}
