import path from "node:path";
import { describe, expect, it, vi } from "vitest";

const { register } = vi.hoisted(() => ({ register: vi.fn() }));

vi.mock("@react-pdf/renderer", () => ({
  Font: { register },
}));

import { PDF_FONT_FAMILY, registerPdfFonts } from "./fonts";

describe("registerPdfFonts", () => {
  it("inregistreaza Noto Sans din asset-uri locale", () => {
    registerPdfFonts();

    expect(register).toHaveBeenCalledWith({
      family: PDF_FONT_FAMILY,
      fonts: [
        {
          src: path.join(process.cwd(), "src/assets/fonts/NotoSans-Regular.ttf"),
          fontWeight: 400,
        },
        {
          src: path.join(process.cwd(), "src/assets/fonts/NotoSans-Bold.ttf"),
          fontWeight: 700,
        },
        {
          src: path.join(process.cwd(), "src/assets/fonts/NotoSans-Regular.ttf"),
          fontWeight: 400,
          fontStyle: "italic",
        },
        {
          src: path.join(process.cwd(), "src/assets/fonts/NotoSans-Bold.ttf"),
          fontWeight: 700,
          fontStyle: "italic",
        },
      ],
    });
  });

  it("nu reinregistreaza fontul la apeluri repetate", () => {
    register.mockClear();

    registerPdfFonts();
    registerPdfFonts();

    expect(register).not.toHaveBeenCalled();
  });
});
