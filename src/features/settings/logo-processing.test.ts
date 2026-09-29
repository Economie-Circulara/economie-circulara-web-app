import sharp from "sharp";
import { describe, expect, it } from "vitest";
import { trimLogo } from "./logo-processing";

/** Panza alba 200x100 cu un dreptunghi inchis 40x20 la (50, 30). */
async function paddedLogo(format: "png" | "jpeg" | "webp"): Promise<Buffer> {
  const mark = await sharp({
    create: { width: 40, height: 20, channels: 3, background: "#1f4d45" },
  })
    .png()
    .toBuffer();
  return sharp({
    create: { width: 200, height: 100, channels: 3, background: "#ffffff" },
  })
    .composite([{ input: mark, left: 50, top: 30 }])
    .toFormat(format, { quality: 100, ...(format === "webp" ? { lossless: true } : {}) })
    .toBuffer();
}

describe("trimLogo", () => {
  it.each(["png", "webp"] as const)(
    "decupeaza marginile albe (%s) si pastreaza formatul",
    async (format) => {
      const trimmed = await trimLogo(await paddedLogo(format), `image/${format}`);
      const meta = await sharp(trimmed).metadata();

      expect(meta.width).toBe(40);
      expect(meta.height).toBe(20);
      expect(meta.format).toBe(format);
    },
  );

  it("decupeaza si JPEG (cu toleranta la artefactele de compresie)", async () => {
    const trimmed = await trimLogo(await paddedLogo("jpeg"), "image/jpeg");
    const meta = await sharp(trimmed).metadata();

    expect(meta.width).toBeLessThanOrEqual(44);
    expect(meta.height).toBeLessThanOrEqual(24);
  });

  it("lasa SVG-ul neatins", async () => {
    const svg = Buffer.from('<svg xmlns="http://www.w3.org/2000/svg" width="10" height="10"/>');

    expect(await trimLogo(svg, "image/svg+xml")).toBe(svg);
  });

  it("intoarce fisierul original daca imaginea nu poate fi procesata", async () => {
    const broken = Buffer.from("nu e o imagine");

    expect(await trimLogo(broken, "image/png")).toBe(broken);
  });
});
