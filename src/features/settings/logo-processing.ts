import sharp from "sharp";

/** Formate raster pe care le decupam; SVG/GIF raman neatinse (vector / animatie). */
const TRIMMABLE_MIME_TYPES = ["image/png", "image/jpeg", "image/webp"] as const;

/**
 * Toleranta fata de culoarea din coltul stanga-sus (fundalul). Logo-urile exportate
 * din generatoare au adesea un fundal "hartie" usor texturat, nu alb pur.
 */
const TRIM_THRESHOLD = 24;

/**
 * Decupeaza marginile uniforme (fundal alb/transparent) din jurul unui logo raster.
 * Logo-urile vin de obicei pe o panza mare cu mult spatiu gol, iar in sidebar /
 * login imaginea e scalata dupa panza, nu dupa desen - decupat, desenul ocupa tot
 * spatiul disponibil. Pastreaza formatul original. La orice eroare (imagine
 * corupta, imagine uniforma) intoarce fisierul neschimbat - decuparea e un bonus,
 * nu o conditie de upload.
 */
export async function trimLogo(input: Buffer, mimeType: string): Promise<Buffer> {
  if (!(TRIMMABLE_MIME_TYPES as readonly string[]).includes(mimeType)) return input;
  try {
    return await sharp(input).trim({ threshold: TRIM_THRESHOLD }).toBuffer();
  } catch {
    return input;
  }
}
