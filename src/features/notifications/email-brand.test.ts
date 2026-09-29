import { describe, expect, it } from "vitest";
import { emailBrandFor, type OrgEmailRow } from "./email-brand";
import { renderEmailLayout } from "./layout";

const ORG: OrgEmailRow = {
  name: "Etora SRL",
  slug: "etora",
  custom_domain: "circular.etora.ro",
  logo_url: "https://cdn.exemplu.ro/logo.png",
  logo_square_url: null,
  primary_color: "#123456",
  secondary_color: null,
  theme: "industrial",
  email_from_name: null,
  email_from_address: "notificari@etora.ro",
  email_domain: "etora.ro",
  email_domain_status: "verified",
  email_reply_to: null,
  cui: "RO111",
  reg_com: "J40/1/2020",
  address: "Str. Exemplu 1, București",
};

describe("emailBrandFor", () => {
  it("organizatie cu domeniu propriu: nume, logo, culoarea temei, expeditor, origine", () => {
    const brand = emailBrandFor(ORG, "notificari@lotculot.eu");
    expect(brand.productName).toBe("Etora SRL");
    expect(brand.logoUrl).toBe("https://cdn.exemplu.ro/logo.png");
    // Tema aleasa de platforma are prioritate fata de culorile adminului.
    expect(brand.brandColor).toBe("#2e3440");
    expect(brand.from).toEqual({ name: "Etora SRL", address: "notificari@etora.ro" });
    expect(brand.customOrigin).toBe("https://circular.etora.ro");
    expect(brand.footerLines).toEqual([
      "CUI RO111 · Reg. Com. J40/1/2020",
      "Str. Exemplu 1, București",
    ]);
  });

  it("fara organizatie: brandul platformei", () => {
    const brand = emailBrandFor(null, "notificari@lotculot.eu");
    expect(brand.productName).toBe("Lot cu Lot");
    expect(brand.from).toEqual({ name: "Lot cu Lot", address: "notificari@lotculot.eu" });
    expect(brand.customOrigin).toBeNull();
  });
});

describe("renderEmailLayout", () => {
  const brand = emailBrandFor(ORG, "notificari@lotculot.eu");

  it("pune logo-ul, butonul si subsolul; textul contine linkul", () => {
    const out = renderEmailLayout(brand, {
      paragraphs: ["Salut"],
      action: { label: "Deschide", url: "https://circular.etora.ro/x" },
    });
    expect(out.html).toContain('src="https://cdn.exemplu.ro/logo.png"');
    expect(out.html).toContain('href="https://circular.etora.ro/x"');
    expect(out.html).toContain("CUI RO111");
    expect(out.html).not.toContain("Lot cu Lot");
    expect(out.text).toContain("Deschide: https://circular.etora.ro/x");
  });

  it("nu accepta linkuri ne-http si escapeaza textul", () => {
    const out = renderEmailLayout(brand, {
      paragraphs: ["<b>x</b>"],
      action: { label: "Rau", url: "javascript:alert(1)" },
    });
    expect(out.html).not.toContain("javascript:");
    expect(out.html).toContain("&lt;b&gt;x&lt;/b&gt;");
  });

  it("fara logo: numele produsului in antet", () => {
    const out = renderEmailLayout({ ...brand, logoUrl: null }, { paragraphs: ["a"] });
    expect(out.html).not.toContain("<img");
    expect(out.html).toContain("Etora SRL");
  });
});
