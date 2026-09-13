import path from "node:path";
import { Font } from "@react-pdf/renderer";

export const PDF_FONT_FAMILY = "NotoSans";

let fontsRegistered = false;

export function registerPdfFonts(): void {
  if (fontsRegistered) return;

  const fontDir = path.join(process.cwd(), "src/assets/fonts");
  const regular = path.join(fontDir, "NotoSans-Regular.ttf");
  const bold = path.join(fontDir, "NotoSans-Bold.ttf");

  // Nu avem fisiere italic: le mapam pe cele drepte. Fara aceste intrari, orice stil cu
  // `fontStyle: "italic"` (linia de semnatura din certificat si aviz) arunca la randare
  // "Could not resolve font for NotoSans, fontStyle italic" si PDF-ul nu se genereaza.
  Font.register({
    family: PDF_FONT_FAMILY,
    fonts: [
      { src: regular, fontWeight: 400 },
      { src: bold, fontWeight: 700 },
      { src: regular, fontWeight: 400, fontStyle: "italic" },
      { src: bold, fontWeight: 700, fontStyle: "italic" },
    ],
  });

  fontsRegistered = true;
}
