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
    expect(c.heroImages).toEqual([]);
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

  it("heroImages: cai din public/ cu text alternativ", () => {
    const img = { src: "/etora/hero/a.webp", alt: "Stația" };
    expect(parseSiteContent("etora", { ...valid(), heroImages: [img] }).heroImages).toEqual([img]);
    expect(() =>
      parseSiteContent("etora", { ...valid(), heroImages: [{ ...img, src: "hero/a.webp" }] }),
    ).toThrow(/heroImages\[0\]\.src/);
    expect(() => parseSiteContent("etora", { ...valid(), heroImages: [{ src: img.src }] })).toThrow(
      /heroImages\[0\]\.alt/,
    );
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

  it("sectiunile optionale lipsesc implicit", () => {
    const c = parseSiteContent("etora", valid());
    expect(c.circular).toBeNull();
    expect(c.quote).toBeNull();
    expect(c.services.items[0].tag).toBeNull();
  });

  it("fluxul circular: minim doi pasi, fiecare complet", () => {
    const step = { label: "Intrare", title: "Moloz", text: "Colectat" };
    const circular = { title: "Circular", intro: "Intro", steps: [step, step] };
    expect(parseSiteContent("etora", { ...valid(), circular }).circular).toEqual({
      ...circular,
      note: null,
    });
    expect(() =>
      parseSiteContent("etora", { ...valid(), circular: { ...circular, steps: [step] } }),
    ).toThrow(/circular\.steps/);
    expect(() =>
      parseSiteContent("etora", {
        ...valid(),
        circular: { ...circular, steps: [step, { label: "X", title: "Y" }] },
      }),
    ).toThrow(/circular\.steps\[1\]\.text/);
  });

  it("formularul de oferta cere servicii, fara duplicate", () => {
    expect(
      parseSiteContent("etora", { ...valid(), quote: { services: ["Beton", "Transport"] } }).quote,
    ).toEqual({ services: ["Beton", "Transport"] });
    expect(() => parseSiteContent("etora", { ...valid(), quote: { services: [] } })).toThrow(
      /quote\.services/,
    );
    expect(() =>
      parseSiteContent("etora", { ...valid(), quote: { services: ["Beton", "Beton"] } }),
    ).toThrow(/duplicate/);
  });

  it("eticheta serviciului e optionala", () => {
    const services = { title: "S", items: [{ title: "A", text: "B", tag: "Stație proprie" }] };
    expect(parseSiteContent("etora", { ...valid(), services }).services.items[0].tag).toBe(
      "Stație proprie",
    );
  });
});

describe("content/*.json din repo", () => {
  const dir = path.join(__dirname, "..", "..", "content");
  it.each(availableTenants(dir))("%s.json e valid", (tenant) => {
    const raw: unknown = JSON.parse(readFileSync(path.join(dir, `${tenant}.json`), "utf8"));
    expect(() => parseSiteContent(tenant, raw)).not.toThrow();
  });

  it.each(availableTenants(dir))(
    "%s.json foloseste hello@<siteDomain> ca email de contact",
    (tenant) => {
      const c = parseSiteContent(
        tenant,
        JSON.parse(readFileSync(path.join(dir, `${tenant}.json`), "utf8")),
      );
      expect(c.contact.email).toBe(`hello@${c.siteDomain}`);
    },
  );
});
