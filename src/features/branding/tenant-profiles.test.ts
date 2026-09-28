import { describe, expect, it } from "vitest";
import { PLATFORM_NAME } from "@/lib/brand";
import {
  DEFAULT_PROFILE,
  PLATFORM_ICON_PATH,
  faviconFor,
  getTenantProfile,
  issuerCreditFor,
  productNameFor,
  type TenantProfile,
} from "./tenant-profiles";

const PROFILES: Record<string, TenantProfile> = { "firma-a": { productName: "Trasabil A" } };

const orgA = { slug: "firma-a", name: "Firma A SRL", customDomain: "trace.firma-a.ro" };
const orgB = { slug: "firma-b", name: "Firma B SRL", customDomain: "trace.firma-b.ro" };
const hosted = { slug: "firma-c", name: "Firma C SRL", customDomain: null };

describe("getTenantProfile", () => {
  it("intoarce profilul organizatiei sau profilul implicit", () => {
    expect(getTenantProfile("firma-a", PROFILES)).toEqual({ productName: "Trasabil A" });
    expect(getTenantProfile("necunoscut", PROFILES)).toBe(DEFAULT_PROFILE);
    expect(getTenantProfile(null, PROFILES)).toBe(DEFAULT_PROFILE);
  });
});

describe("productNameFor", () => {
  it("prefera numele de produs din profil", () => {
    expect(productNameFor(orgA, PROFILES)).toBe("Trasabil A");
  });

  it("pe domeniu propriu, fara profil, foloseste numele organizatiei (nu platforma)", () => {
    expect(productNameFor(orgB, PROFILES)).toBe("Firma B SRL");
  });

  it("organizatiile de pe domeniul platformei si lipsa tenantului raman pe platforma", () => {
    expect(productNameFor(hosted, PROFILES)).toBe(PLATFORM_NAME);
    expect(productNameFor(null, PROFILES)).toBe(PLATFORM_NAME);
  });
});

describe("issuerCreditFor", () => {
  it("omite creditul cand produsul poarta chiar numele organizatiei", () => {
    expect(issuerCreditFor(orgB, PROFILES)).toBeNull();
  });

  it("pastreaza creditul cand numele difera", () => {
    expect(issuerCreditFor(orgA, PROFILES)).toBe("Trasabil A");
    expect(issuerCreditFor(hosted, PROFILES)).toBe(PLATFORM_NAME);
    expect(issuerCreditFor(null, PROFILES)).toBe(PLATFORM_NAME);
  });
});

describe("faviconFor", () => {
  it("platforma -> iconita platformei; tenant cu logo -> logo-ul", () => {
    expect(faviconFor(null, "#000")).toBe(PLATFORM_ICON_PATH);
    expect(faviconFor({ name: "Etora SRL", logoUrl: "https://x/logo.png" }, "#000")).toBe(
      "https://x/logo.png",
    );
  });

  it("tenant fara logo -> initialele pe culoarea brandului, fara marca platformei", () => {
    const icon = decodeURIComponent(faviconFor({ name: "Etora SRL" }, "#9a4a2c"));
    expect(icon).toMatch(/^data:image\/svg\+xml,/);
    expect(icon).toContain('fill="#9a4a2c"');
    expect(icon).toContain(">ES<");
    expect(icon).not.toContain("Lot cu Lot");
  });
});
