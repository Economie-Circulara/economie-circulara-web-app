import { describe, expect, it } from "vitest";
import { PLATFORM_NAME } from "@/lib/brand";
import { pdfBrandFor } from "./pdf-brand";
import { DEFAULT_DOCUMENT_TAGLINE, type TenantProfile } from "./tenant-profiles";
import { THEMES } from "./themes";

const PROFILES: Record<string, TenantProfile> = {
  etora: { documentTagline: "Agregate reciclate", documentFooterNote: "office@etora.ro" },
};

const base = { slug: "etora", name: "Etora SRL", customDomain: "app.etora.ro" };

describe("pdfBrandFor", () => {
  it("fara organizatie: tema implicita si creditul platformei", () => {
    const brand = pdfBrandFor(null, PROFILES);
    expect(brand.headerVariant).toBe("bar");
    expect(brand.brandColor).toBe(THEMES.default.swatches.brand);
    expect(brand.tagline).toBe(DEFAULT_DOCUMENT_TAGLINE);
    expect(brand.footerNote).toBeNull();
    expect(brand.issuerCredit).toBe(PLATFORM_NAME);
  });

  it("antetul si culorile implicite vin din tema, textele din profil", () => {
    const brand = pdfBrandFor({ ...base, theme: "industrial" }, PROFILES);
    expect(brand.headerVariant).toBe("rule");
    expect(brand.brandColor).toBe(THEMES.industrial.swatches.brand);
    expect(brand.accentColor).toBe(THEMES.industrial.swatches.accent);
    expect(brand.tagline).toBe("Agregate reciclate");
    expect(brand.footerNote).toBe("office@etora.ro");
    expect(brand.issuerCredit).toBeNull();
  });

  it("culorile hex ale organizatiei au prioritate; valorile ne-hex sunt ignorate", () => {
    const brand = pdfBrandFor(
      { ...base, theme: "teren", primaryColor: "#123456", secondaryColor: "oklch(0.7 0.1 60)" },
      PROFILES,
    );
    expect(brand.brandColor).toBe("#123456");
    expect(brand.accentColor).toBe(THEMES.teren.swatches.accent);
  });
});
