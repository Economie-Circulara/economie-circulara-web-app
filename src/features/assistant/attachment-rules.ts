/**
 * Reguli pure pentru atasamentele din chat - folosite si in browser (validare inainte
 * de upload, randarea etichetelor) si pe server (validare autoritara, referinte in
 * mesaj). Plan: docs/plans/asistent-atasamente.md.
 */

export const ATTACHMENT_BUCKET = "assistant-attachments";

export const IMAGE_MIME_TYPES = ["image/png", "image/jpeg", "image/webp", "image/gif"] as const;
export const PDF_MIME_TYPE = "application/pdf";

/** Imaginile au limita pozei de produs (singura lor utilizare, `seteaza_imagine_produs`). */
export const MAX_IMAGE_BYTES = 2 * 1024 * 1024;
export const MAX_PDF_BYTES = 10 * 1024 * 1024;
/** Cate atasamente pot insoti un singur mesaj. */
export const MAX_ATTACHMENTS_PER_MESSAGE = 3;

/**
 * Documente text (docs/plans/asistent-atasamente.md): fisiere intalnite in practica -
 * exporturi CSV din Excel, note Markdown, pagini HTML salvate, JSON/XML din alte sisteme.
 * Tipul canonic se deduce din EXTENSIE: browserele dau des un tip gol sau generic
 * (`.md` -> "", `.csv` -> "application/vnd.ms-excel" pe Windows).
 */
export const TEXT_TYPES_BY_EXTENSION: Record<string, string> = {
  txt: "text/plain",
  md: "text/markdown",
  markdown: "text/markdown",
  csv: "text/csv",
  tsv: "text/tab-separated-values",
  html: "text/html",
  htm: "text/html",
  json: "application/json",
  xml: "application/xml",
};
export const TEXT_MIME_TYPES = [...new Set(Object.values(TEXT_TYPES_BY_EXTENSION))];
/** Text brut: 2MB inseamna deja sute de pagini - modelul il citeste oricum pe bucati. */
export const MAX_TEXT_BYTES = 2 * 1024 * 1024;

export const ATTACHMENT_ACCEPT = [
  ...IMAGE_MIME_TYPES,
  PDF_MIME_TYPE,
  ...TEXT_MIME_TYPES,
  ...Object.keys(TEXT_TYPES_BY_EXTENSION).map((extension) => `.${extension}`),
].join(",");

export function isTextDocument(mimeType: string): boolean {
  return TEXT_MIME_TYPES.includes(mimeType);
}

/** Un document pe care `citeste_document` il poate citi (PDF sau text). */
export function isReadableDocument(mimeType: string): boolean {
  return mimeType === PDF_MIME_TYPE || isTextDocument(mimeType);
}

/**
 * Tipul canonic al fisierului: pentru documentele text, dupa extensie (vezi mai sus);
 * pentru restul, tipul dat de browser. Folosit si la validare, si la upload (bucket-ul
 * accepta doar tipurile canonice).
 */
export function resolveMimeType(fileName: string, browserType: string): string {
  const extension = fileName.toLowerCase().split(".").pop() ?? "";
  if (fileName.includes(".") && TEXT_TYPES_BY_EXTENSION[extension]) {
    return TEXT_TYPES_BY_EXTENSION[extension];
  }
  return browserType;
}

export interface AttachmentMeta {
  id: string;
  fileName: string;
  mimeType: string;
  sizeBytes: number;
}

export function isImage(mimeType: string): boolean {
  return (IMAGE_MIME_TYPES as readonly string[]).includes(mimeType);
}

/** Mesajul de eroare (RO) sau `null` daca fisierul poate fi atasat. */
export function validateAttachment(file: {
  name: string;
  type: string;
  size: number;
}): string | null {
  if (!file.name.trim()) return "Fișierul nu are nume.";
  if (file.size <= 0) return "Fișierul e gol.";
  const type = resolveMimeType(file.name, file.type);
  if (isTextDocument(type)) {
    return file.size > MAX_TEXT_BYTES
      ? `Fișierul text depășește ${MAX_TEXT_BYTES / (1024 * 1024)}MB.`
      : null;
  }
  if (isImage(file.type)) {
    return file.size > MAX_IMAGE_BYTES
      ? `Imaginea depășește ${MAX_IMAGE_BYTES / (1024 * 1024)}MB.`
      : null;
  }
  if (file.type === PDF_MIME_TYPE) {
    return file.size > MAX_PDF_BYTES
      ? `PDF-ul depășește ${MAX_PDF_BYTES / (1024 * 1024)}MB.`
      : null;
  }
  return (
    "Tip de fișier neacceptat. Poți atașa imagini (PNG, JPEG, WEBP, GIF), PDF sau fișiere " +
    "text (TXT, Markdown, CSV, TSV, HTML, JSON, XML)."
  );
}

/** Numele pastrat: fara caractere de control si fara `[]()` (ar rupe referinta markdown). */
export function sanitizeFileName(name: string): string {
  const cleaned = name.replace(/[\u0000-\u001f\u007f[\]()]/g, "").trim();
  return (cleaned || "fisier").slice(0, 200);
}

/** Linia adaugata in mesajul utilizatorului - modelul vede ID-ul, UI-ul o eticheta. */
export function attachmentReference(attachment: Pick<AttachmentMeta, "id" | "fileName">): string {
  return `📎 [${sanitizeFileName(attachment.fileName)}](attachment:${attachment.id})`;
}

const REFERENCE_LINE = /^📎 \[([^\]]+)\]\(attachment:([0-9a-f-]{36})\)$/;

/** Separa textul mesajului de referintele la atasamente (pentru bulele din chat). */
export function splitAttachmentReferences(content: string): {
  text: string;
  attachments: { id: string; fileName: string }[];
} {
  const attachments: { id: string; fileName: string }[] = [];
  const lines = content.split("\n").filter((line) => {
    const match = REFERENCE_LINE.exec(line.trim());
    if (!match) return true;
    attachments.push({ fileName: match[1], id: match[2] });
    return false;
  });
  return { text: lines.join("\n").trim(), attachments };
}
