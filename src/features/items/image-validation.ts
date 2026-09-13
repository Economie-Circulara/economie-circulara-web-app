/** Marimea maxima a unei poze de item incarcate (bytes). */
export const MAX_ITEM_IMAGE_SIZE_BYTES = 2 * 1024 * 1024; // 2MB

/** Tipuri de fisier acceptate pentru poza unui item. */
export const ALLOWED_ITEM_IMAGE_MIME_TYPES = [
  "image/png",
  "image/jpeg",
  "image/webp",
  "image/gif",
] as const;

/**
 * Valideaza tipul si marimea unei poze de item inainte de upload. Returneaza
 * mesajul de eroare (RO, gata de afisat) sau `null` daca fisierul e valid.
 * Acelasi pattern ca `src/features/settings/logo-validation.ts`.
 */
export function validateItemImageFile(file: { size: number; type: string }): string | null {
  if (file.size > MAX_ITEM_IMAGE_SIZE_BYTES) {
    return `Fișierul depășește limita maximă de ${Math.round(MAX_ITEM_IMAGE_SIZE_BYTES / (1024 * 1024))}MB.`;
  }
  if (!(ALLOWED_ITEM_IMAGE_MIME_TYPES as readonly string[]).includes(file.type)) {
    return "Tip de fișier neacceptat. Sunt permise PNG, JPEG, WEBP sau GIF.";
  }
  return null;
}
