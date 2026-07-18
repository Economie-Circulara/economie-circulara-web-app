/** Marimea maxima a unui document incarcat (bytes). */
export const MAX_FILE_SIZE_BYTES = 10 * 1024 * 1024; // 10MB

/** Tipuri de fisier acceptate: PDF, imagini uzuale, documente Office. */
export const ALLOWED_MIME_TYPES = [
  "application/pdf",
  "image/png",
  "image/jpeg",
  "image/webp",
  "image/gif",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.ms-excel",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
] as const;

export type FileValidationErrorCode = "too_large" | "unsupported_type";

export interface FileValidationError {
  code: FileValidationErrorCode;
  message: string;
}

function formatMb(bytes: number): string {
  return `${Math.round(bytes / (1024 * 1024))}MB`;
}

/**
 * Valideaza tipul si marimea unui fisier inainte de upload. Returneaza `null`
 * daca fisierul e valid, altfel eroarea (tip + mesaj RO gata de afisat).
 */
export function validateFile(file: { size: number; type: string }): FileValidationError | null {
  if (file.size > MAX_FILE_SIZE_BYTES) {
    return {
      code: "too_large",
      message: `Fișierul depășește limita maximă de ${formatMb(MAX_FILE_SIZE_BYTES)}.`,
    };
  }

  if (!(ALLOWED_MIME_TYPES as readonly string[]).includes(file.type)) {
    return {
      code: "unsupported_type",
      message: "Tip de fișier neacceptat. Sunt permise PDF, imagini și documente Office.",
    };
  }

  return null;
}
