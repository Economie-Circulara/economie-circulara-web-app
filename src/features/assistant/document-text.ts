import { isTextDocument, PDF_MIME_TYPE } from "./attachment-rules";
import { extractPdfText } from "./pdf-text";

/**
 * Textul unui document atasat, indiferent de format (docs/plans/asistent-atasamente.md):
 * PDF (cu strat de text), text simplu, Markdown, CSV/TSV, JSON, XML - asa cum sunt - si
 * HTML convertit la text (fara tag-uri, scripturi, stiluri), ca modelul sa nu plateasca
 * tokeni pe marcaj.
 */

export interface DocumentText {
  text: string;
  /** Doar pentru PDF. */
  pages: number | null;
  /** PDF fara strat de text (scanat) - nu poate fi citit fara OCR. */
  scanned: boolean;
}

const ENTITIES: Record<string, string> = {
  amp: "&",
  lt: "<",
  gt: ">",
  quot: '"',
  apos: "'",
  nbsp: " ",
};

function decodeEntities(text: string): string {
  return text.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (match, entity: string) => {
    if (entity[0] === "#") {
      const code =
        entity[1].toLowerCase() === "x"
          ? parseInt(entity.slice(2), 16)
          : parseInt(entity.slice(1), 10);
      return Number.isFinite(code) && code > 0 && code < 0x110000
        ? String.fromCodePoint(code)
        : match;
    }
    return ENTITIES[entity.toLowerCase()] ?? match;
  });
}

/** HTML -> text lizibil: pastreaza structura de randuri (paragrafe, liste, tabele). */
export function htmlToText(html: string): string {
  return decodeEntities(
    html
      .replace(/<!--[\s\S]*?-->/g, "")
      .replace(/<(script|style|head|noscript|template)\b[\s\S]*?<\/\1>/gi, "")
      .replace(/<br\s*\/?>/gi, "\n")
      .replace(/<\/(td|th)>/gi, " | ")
      .replace(/<li\b[^>]*>/gi, "- ")
      .replace(/<\/(p|div|tr|li|h[1-6]|table|section|article|ul|ol|pre|blockquote)>/gi, "\n")
      .replace(/<[^>]+>/g, ""),
  )
    .replace(/[ \t]+/g, " ")
    .replace(/ *\| *\n/g, "\n")
    .replace(/\n\s*\n\s*\n+/g, "\n\n")
    .split("\n")
    .map((line) => line.trim())
    .join("\n")
    .trim();
}

/** Decodare UTF-8 (fara BOM). Fisierele din Excel „CSV UTF-8” incep des cu BOM. */
export function decodeText(buffer: ArrayBuffer): string {
  return new TextDecoder("utf-8").decode(buffer).replace(/^﻿/, "");
}

export async function extractDocumentText(file: Blob, mimeType: string): Promise<DocumentText> {
  if (mimeType === PDF_MIME_TYPE) {
    const pdf = await extractPdfText(file);
    return { text: pdf.text, pages: pdf.pages, scanned: pdf.scanned };
  }
  if (!isTextDocument(mimeType)) {
    throw new Error(`Tipul ${mimeType} nu poate fi citit ca text.`);
  }
  const raw = decodeText(await file.arrayBuffer());
  return {
    text: mimeType === "text/html" ? htmlToText(raw) : raw.trim(),
    pages: null,
    scanned: false,
  };
}
