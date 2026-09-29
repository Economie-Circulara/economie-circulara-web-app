import { describe, expect, it } from "vitest";
import {
  localPartOf,
  mapProviderStatus,
  normalizeEmailDomain,
  normalizeLocalPart,
  parseStoredRecords,
  resolveEmailDomainStatus,
} from "./email-domain";

describe("normalizeEmailDomain", () => {
  it("accepta domeniul, il curata (schema, adresa intreaga, majuscule)", () => {
    expect(normalizeEmailDomain(" Etora.RO ")).toEqual({ ok: true, value: "etora.ro" });
    expect(normalizeEmailDomain("notificari@etora.ro")).toEqual({ ok: true, value: "etora.ro" });
    expect(normalizeEmailDomain("https://etora.ro/")).toEqual({ ok: true, value: "etora.ro" });
  });

  it("gol = fara domeniu; invalid = eroare", () => {
    expect(normalizeEmailDomain("")).toEqual({ ok: true, value: null });
    expect(normalizeEmailDomain("nu e domeniu").ok).toBe(false);
  });
});

describe("normalizeLocalPart", () => {
  it("implicit `notificari`, taie domeniul, respinge caractere invalide", () => {
    expect(normalizeLocalPart("")).toEqual({ ok: true, value: "notificari" });
    expect(normalizeLocalPart("Comenzi@x.ro")).toEqual({ ok: true, value: "comenzi" });
    expect(normalizeLocalPart("a b").ok).toBe(false);
    expect(normalizeLocalPart("a..b").ok).toBe(false);
  });
});

describe("statusuri si inregistrari", () => {
  it("mapeaza statusurile Resend", () => {
    expect(mapProviderStatus("verified")).toBe("verified");
    expect(mapProviderStatus("failed")).toBe("failed");
    expect(mapProviderStatus("not_started")).toBe("pending");
    expect(mapProviderStatus("temporary_failure")).toBe("pending");
  });

  it("statusul din DB necunoscut -> not_configured", () => {
    expect(resolveEmailDomainStatus("ceva")).toBe("not_configured");
    expect(resolveEmailDomainStatus("pending")).toBe("pending");
  });

  it("parseaza inregistrarile salvate, ignorand randurile invalide", () => {
    expect(
      parseStoredRecords([
        {
          type: "MX",
          name: "send",
          value: "feedback-smtp.eu-west-1.amazonses.com",
          priority: 10,
          status: "pending",
        },
        { type: "TXT" },
        "x",
      ]),
    ).toEqual([
      {
        type: "MX",
        name: "send",
        value: "feedback-smtp.eu-west-1.amazonses.com",
        priority: 10,
        status: "pending",
      },
    ]);
    expect(parseStoredRecords(null)).toEqual([]);
  });

  it("partea locala a unei adrese", () => {
    expect(localPartOf("comenzi@etora.ro")).toBe("comenzi");
    expect(localPartOf(null)).toBe("notificari");
  });
});
