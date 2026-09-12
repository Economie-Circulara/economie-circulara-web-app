/** Marimea maxima a unui logo incarcat (bytes). */
export const MAX_LOGO_SIZE_BYTES = 2 * 1024 * 1024; // 2MB

/** Tipuri de fisier acceptate pentru logo - doar imagini. */
export const ALLOWED_LOGO_MIME_TYPES = [
  "image/png",
  "image/jpeg",
  "image/webp",
  "image/svg+xml",
  "image/gif",
] as const;

/**
 * Valideaza tipul si marimea unui logo inainte de upload. Returneaza mesajul de
 * eroare (RO, gata de afisat) sau `null` daca fisierul e valid.
 */
export function validateLogoFile(file: { size: number; type: string }): string | null {
  if (file.size > MAX_LOGO_SIZE_BYTES) {
    return `Fișierul depășește limita maximă de ${Math.round(MAX_LOGO_SIZE_BYTES / (1024 * 1024))}MB.`;
  }
  if (!(ALLOWED_LOGO_MIME_TYPES as readonly string[]).includes(file.type)) {
    return "Tip de fișier neacceptat. Sunt permise PNG, JPEG, WEBP, SVG sau GIF.";
  }
  return null;
}
