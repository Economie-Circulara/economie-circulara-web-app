import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { ContentError, parseSiteContent } from "./content";
import { availableTenants } from "./site";

function valid(): Record<string, unknown> {
  return {
    name: "Etora",
    appDomain: "circular.etora.ro",
    siteDomain: "etora.ro",
    theme: "teren",
    tagline: "Slogan",
    description: "Descriere",
    about: { title: "Despre", paragraphs: ["Unu"] },
    services: { title: "Servicii", items: [{ title: "A", text: "B" }] },
    portal: { title: "Portal", text: "Text", bullets: [] },
    contact: { email: "office@etora.ro" },
    legal: { companyName: "Etora SRL" },
  };
}

describe("parseSiteContent", () => {
  it("accepta un continut minim si completeaza valorile implicite", () => {
    const c = parseSiteContent("etora", valid());
    expect(c.draft).toBe(false);
    expect(c.logo).toBeNull();
    expect(c.stats).toEqual([]);
    expect(c.euFunding).toBeNull();
    expect(c.contact).toEqual({
      email: "office@etora.ro",
      phone: null,
      address: null,
      hours: null,
    });
  });

  it("tema lipsa -> default; tema necunoscuta -> eroare", () => {
    const { theme: _theme, ...rest } = valid();
    expect(parseSiteContent("etora", rest).theme).toBe("default");
    expect(() => parseSiteContent("etora", { ...valid(), theme: "neon" })).toThrow(/theme/);
  });

  it("refuza campuri obligatorii goale, cu calea campului in mesaj", () => {
    expect(() => parseSiteContent("etora", { ...valid(), tagline: "  " })).toThrow(
      new ContentError("etora", "tagline lipseste sau e gol"),
    );
    expect(() =>
      parseSiteContent("etora", { ...valid(), services: { title: "S", items: [{ title: "A" }] } }),
    ).toThrow(/services\.items\[0\]\.text/);
    expect(() =>
      parseSiteContent("etora", { ...valid(), services: { title: "S", items: [] } }),
    ).toThrow(/cel putin 1/);
  });

  it("cere email sau telefon", () => {
    expect(() => parseSiteContent("etora", { ...valid(), contact: {} })).toThrow(
      /email sau telefon/,
    );
    expect(
      parseSiteContent("etora", { ...valid(), contact: { phone: "0722 000 000" } }).contact.phone,
    ).toBe("0722 000 000");
  });

  it("domeniile sunt doar host, normalizate la litere mici", () => {
    expect(
      parseSiteContent("etora", { ...valid(), appDomain: "Circular.Etora.RO" }).appDomain,
    ).toBe("circular.etora.ro");
    expect(() =>
      parseSiteContent("etora", { ...valid(), appDomain: "https://circular.etora.ro" }),
    ).toThrow(/appDomain/);
    expect(() => parseSiteContent("etora", { ...valid(), siteDomain: "etora.ro/acasa" })).toThrow(
      /siteDomain/,
    );
  });

  it("logo-ul local trebuie sa fie o cale din public/", () => {
    expect(parseSiteContent("etora", { ...valid(), logo: "/etora/logo.svg" }).logo).toBe(
      "/etora/logo.svg",
    );
    expect(() => parseSiteContent("etora", { ...valid(), logo: "logo.svg" })).toThrow(/logo/);
    expect(() => parseSiteContent("etora", { ...valid(), logoSquare: "icon.png" })).toThrow(
      /logoSquare/,
    );
  });

  it("finantarea UE: text obligatoriu, sigle optionale", () => {
    expect(
      parseSiteContent("etora", { ...valid(), euFunding: { text: "Proiect cofinanțat" } })
        .euFunding,
    ).toEqual({
      text: "Proiect cofinanțat",
      logos: [],
    });
    expect(() => parseSiteContent("etora", { ...valid(), euFunding: { logos: [] } })).toThrow(
      /euFunding\.text/,
    );
  });
});

describe("content/*.json din repo", () => {
  const dir = path.join(__dirname, "..", "..", "content");
  it.each(availableTenants(dir))("%s.json e valid", (tenant) => {
    const raw: unknown = JSON.parse(readFileSync(path.join(dir, `${tenant}.json`), "utf8"));
    expect(() => parseSiteContent(tenant, raw)).not.toThrow();
  });
});
