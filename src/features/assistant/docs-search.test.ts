import { describe, expect, it } from "vitest";
import { normalizeForSearch, scoreSection, searchManual, splitSections } from "./docs-search";

const DOC = { slug: "utilizare-admin-operator", title: "Manual admin" };

describe("splitSections", () => {
  it("imparte pe h2/h3 si pastreaza ancorele din /ajutor", () => {
    const sections = splitSections(
      ["# Titlu", "intro", "## Stoc", "text stoc", "### Adăugare lot", "pasii"].join("\n"),
      DOC,
    );

    expect(sections.map((section) => section.anchor)).toEqual(["stoc", "adăugare-lot"]);
    expect(sections[0].text).toContain("text stoc");
    expect(sections[1].heading).toBe("Adăugare lot");
  });

  it("nu rupe sectiunea pe titlurile din blocuri de cod", () => {
    const sections = splitSections(
      ["## Real", "```bash", "## Fals", "```", "gata"].join("\n"),
      DOC,
    );

    expect(sections).toHaveLength(1);
    expect(sections[0].text).toContain("## Fals");
  });
});

describe("scoreSection", () => {
  it("da greutate mai mare potrivirilor din titlu", () => {
    const [inHeading, inBody] = [
      { docSlug: "d", docTitle: "D", anchor: "a", heading: "Stoc", text: "altceva" },
      { docSlug: "d", docTitle: "D", anchor: "b", heading: "Altceva", text: "stoc" },
    ];

    expect(scoreSection(inHeading, ["stoc"])).toBeGreaterThan(scoreSection(inBody, ["stoc"]));
  });
});

describe("normalizeForSearch", () => {
  it('ignora diacriticele, ca „producție" sa gaseasca „productie"', () => {
    expect(normalizeForSearch("Producție și Livrări")).toBe("productie si livrari");
  });
});

describe("searchManual (pe manualele reale)", () => {
  it("gaseste sectiunea de stoc pentru un operator si intoarce link-ul ei", async () => {
    const hits = await searchManual("cum adaug un lot in stoc?", "operator");

    expect(hits.length).toBeGreaterThan(0);
    expect(hits[0].href).toMatch(/^\/ajutor\/[a-z-]+#/);
    expect(hits.some((hit) => /stoc|lot/i.test(hit.heading))).toBe(true);
  });

  it("cauta doar in manualele permise rolului", async () => {
    const hits = await searchManual("utilizatori organizație setări", "client");

    // Ghidul de administrare nu e vizibil clientului.
    expect(hits.every((hit) => hit.docSlug === "utilizare-client")).toBe(true);
  });

  it("intoarce gol pentru o intrebare fara cuvinte utile", async () => {
    expect(await searchManual("ce si cum", "admin")).toEqual([]);
  });
});
