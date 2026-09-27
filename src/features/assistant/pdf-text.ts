import { extractText, getDocumentProxy } from "unpdf";

/**
 * Textul unui PDF, pe pagini (docs/plans/asistent-import-pdf.md). Doar PDF-uri cu
 * TEXT (exportate din Word/Excel): unul scanat da text gol - OCR-ul ar cere un
 * furnizor cu „vedere”, pe care DeepSeek nu il are.
 */

/** Sub atatea caractere pe document, il consideram scanat (fara strat de text). */
const MIN_TEXT_CHARS = 20;

export interface PdfText {
  pages: number;
  text: string;
  /** Adevarat daca PDF-ul pare scanat (practic fara text extras). */
  scanned: boolean;
}

export async function extractPdfText(file: Blob): Promise<PdfText> {
  const pdf = await getDocumentProxy(new Uint8Array(await file.arrayBuffer()));
  const { totalPages, text } = await extractText(pdf, { mergePages: false });
  const pages = (text as string[]).map(
    (page, index) => `--- Pagina ${index + 1} ---\n${page.replace(/[ \t]+/g, " ").trim()}`,
  );
  const joined = pages.join("\n\n");
  const meaningful = (text as string[]).join("").replace(/\s+/g, "").length;
  return { pages: totalPages, text: joined, scanned: meaningful < MIN_TEXT_CHARS };
}

/** O bucata din text, ca modelul sa poata citi documente lungi in mai multi pasi. */
export function textChunk(text: string, from: number, size: number) {
  const start = Math.max(0, Math.min(Math.floor(from), text.length));
  const end = Math.min(text.length, start + size);
  return { start, end, chunk: text.slice(start, end), hasMore: end < text.length };
}
