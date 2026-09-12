import path from "node:path";
import { Font } from "@react-pdf/renderer";

export const PDF_FONT_FAMILY = "NotoSans";

let fontsRegistered = false;

export function registerPdfFonts(): void {
  if (fontsRegistered) return;

  const fontDir = path.join(process.cwd(), "src/assets/fonts");

  Font.register({
    family: PDF_FONT_FAMILY,
    fonts: [
      { src: path.join(fontDir, "NotoSans-Regular.ttf"), fontWeight: 400 },
      { src: path.join(fontDir, "NotoSans-Bold.ttf"), fontWeight: 700 },
    ],
  });

  fontsRegistered = true;
}
