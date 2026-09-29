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

/**
 * Variantele de logo ale organizatiei (migrarea 0049): `inline` = orizontal
 * (`logo_url`), `square` = patrat (`logo_square_url`). Fiecare are fisierul ei in
 * bucket, la un path fix per organizatie.
 */
export type LogoVariant = "inline" | "square";

export const LOGO_VARIANTS: Record<LogoVariant, { fileName: string }> = {
  inline: { fileName: "logo" },
  square: { fileName: "logo-square" },
};

/** Varianta primita din formular; orice valoare necunoscuta -> `null`. */
export function parseLogoVariant(value: unknown): LogoVariant | null {
  return value === "inline" || value === "square" ? value : null;
}

/** Update-ul pe `organizations` care seteaza (sau goleste) coloana variantei. */
export function logoColumnPatch(
  variant: LogoVariant,
  url: string | null,
): { logo_url: string | null } | { logo_square_url: string | null } {
  return variant === "inline" ? { logo_url: url } : { logo_square_url: url };
}
