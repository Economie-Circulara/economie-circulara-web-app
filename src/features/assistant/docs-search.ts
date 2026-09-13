import GithubSlugger from "github-slugger";
import type { UserRole } from "@/features/auth/session";
import { readManualFile } from "@/features/manual/loader";
import { manualDocsForRole } from "@/features/manual/registry";
import { headingSlug } from "@/features/manual/toc";

/**
 * Cautare in manual, fara vector DB: manualul are ~1000 de linii utile, deci nu
 * justifica pgvector in v1. Impartim documentele pe sectiuni h2/h3 (acelasi slug ca
 * ancorele din `/ajutor`, prin `headingSlug`) si scoram lexical. Rezultatele poarta
 * slug-ul si ancora, ca raspunsul asistentului sa poata trimite la `/ajutor/...#...`.
 *
 * Daca se dovedeste insuficient: embeddings in Supabase (pgvector) ca v2 - contractul
 * functiei ramane acelasi.
 */

export interface ManualSection {
  docSlug: string;
  docTitle: string;
  anchor: string;
  heading: string;
  text: string;
}

const FENCE_RE = /^\s*(?:```|~~~)/;
const HEADING_RE = /^(#{1,6})\s+(.+?)\s*$/;
/** Cuvinte prea comune ca sa spuna ceva despre relevanta. */
const STOP_WORDS = new Set([
  "cum",
  "ce",
  "care",
  "este",
  "sunt",
  "unde",
  "cand",
  "pentru",
  "despre",
  "din",
  "intr",
  "intre",
  "sau",
  "dar",
  "daca",
  "face",
  "fac",
  "pot",
  "poate",
  "vreau",
  "trebuie",
  "aplicatie",
  "platforma",
  "si",
  "la",
  "de",
  "in",
  "pe",
  "cu",
  "un",
  "o",
  "al",
  "ale",
  "lui",
  "mai",
  "nu",
  "se",
  "ca",
  "am",
  "ai",
]);

/** Scoate diacriticele si semnele, ca "producție" si "productie" sa se potriveasca. */
export function normalizeForSearch(text: string): string {
  return text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9\s]/g, " ");
}

function terms(query: string): string[] {
  return normalizeForSearch(query)
    .split(/\s+/)
    .filter((word) => word.length > 2 && !STOP_WORDS.has(word));
}

/** Imparte un document in sectiuni h2/h3, cu acelasi id ca ancorele din `/ajutor`. */
export function splitSections(
  markdown: string,
  doc: { slug: string; title: string },
): ManualSection[] {
  const slugger = new GithubSlugger();
  const sections: ManualSection[] = [];
  let current: ManualSection | null = null;
  let insideFence = false;

  for (const line of markdown.split(/\r?\n/)) {
    if (FENCE_RE.test(line)) {
      insideFence = !insideFence;
      if (current) current.text += `${line}\n`;
      continue;
    }

    const match = insideFence ? null : HEADING_RE.exec(line);
    if (match) {
      const level = match[1].length;
      const { text, id } = headingSlug(match[2], slugger);
      if (level >= 2 && level <= 3) {
        current = { docSlug: doc.slug, docTitle: doc.title, anchor: id, heading: text, text: "" };
        sections.push(current);
        continue;
      }
      // h1 / h4+ raman in textul sectiunii curente (dar au consumat sluggerul).
    }

    if (current) current.text += `${line}\n`;
  }

  return sections.filter((section) => section.text.trim().length > 0);
}

/** Sectiunile din manualele pe care rolul are voie sa le citeasca. */
export async function manualSectionsForRole(role: UserRole): Promise<ManualSection[]> {
  const docs = manualDocsForRole(role);
  const all = await Promise.all(
    docs.map(async (doc) => splitSections(await readManualFile(doc.file), doc)),
  );
  return all.flat();
}

/** Scor simplu: cate ocurente are fiecare termen in titlu (greutate 3) si in text. */
export function scoreSection(section: ManualSection, queryTerms: string[]): number {
  if (queryTerms.length === 0) return 0;
  const heading = normalizeForSearch(section.heading);
  const body = normalizeForSearch(section.text);

  return queryTerms.reduce((score, term) => {
    const inHeading = heading.includes(term) ? 3 : 0;
    const occurrences = body.split(term).length - 1;
    return score + inHeading + Math.min(occurrences, 3);
  }, 0);
}

export interface ManualSearchHit extends ManualSection {
  score: number;
  /** Link direct catre sectiunea din manualul in aplicatie. */
  href: string;
}

/** Cele mai relevante sectiuni pentru intrebare (implicit 4). */
export async function searchManual(
  question: string,
  role: UserRole,
  limit = 4,
): Promise<ManualSearchHit[]> {
  const queryTerms = terms(question);
  if (queryTerms.length === 0) return [];

  const sections = await manualSectionsForRole(role);

  return sections
    .map((section) => ({
      ...section,
      score: scoreSection(section, queryTerms),
      href: `/ajutor/${section.docSlug}#${section.anchor}`,
    }))
    .filter((hit) => hit.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit);
}
