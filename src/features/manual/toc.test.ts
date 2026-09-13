import GithubSlugger from "github-slugger";
import { describe, expect, it } from "vitest";
import { extractToc, headingSlug } from "./toc";

describe("extractToc", () => {
  it("ia doar h2 si h3, in ordinea din document", () => {
    const toc = extractToc(
      ["# Titlu", "## Unu", "text", "### Unu punct unu", "#### Prea adanc", "## Doi"].join("\n"),
    );

    expect(toc).toEqual([
      { id: "unu", text: "Unu", level: 2 },
      { id: "unu-punct-unu", text: "Unu punct unu", level: 3 },
      { id: "doi", text: "Doi", level: 2 },
    ]);
  });

  it("pastreaza diacriticele in slug", () => {
    expect(extractToc("## 1. Setări organizație")).toEqual([
      { id: "1-setări-organizație", text: "1. Setări organizație", level: 2 },
    ]);
  });

  it("foloseste id-ul explicit {#...} si il scoate din text", () => {
    expect(extractToc("### 2.2 Gap cunoscut {#gap-cunoscut-invitarea-unui-client}")).toEqual([
      { id: "gap-cunoscut-invitarea-unui-client", text: "2.2 Gap cunoscut", level: 3 },
    ]);
  });

  it("curata markup-ul inline din titlu", () => {
    expect(extractToc("## **Stoc** si `loturi` cu [link](x.md)")).toEqual([
      { id: "stoc-si-loturi-cu-link", text: "Stoc si loturi cu link", level: 2 },
    ]);
  });

  it("ignora titlurile din blocurile de cod", () => {
    const toc = extractToc(["## Real", "```bash", "## Fals", "```", "## Iar real"].join("\n"));
    expect(toc.map((entry) => entry.text)).toEqual(["Real", "Iar real"]);
  });

  it("dedubleaza titlurile identice ca rehype-slug", () => {
    expect(extractToc(["## Livrări", "## Livrări"].join("\n")).map((entry) => entry.id)).toEqual([
      "livrări",
      "livrări-1",
    ]);
  });
});

describe("headingSlug", () => {
  it("nu consuma sluggerul pentru id-uri explicite", () => {
    const slugger = new GithubSlugger();

    expect(headingSlug("Titlu {#custom}", slugger)).toEqual({ text: "Titlu", id: "custom" });
    // Daca sluggerul ar fi fost consumat mai sus, aici am primi "titlu-1".
    expect(headingSlug("Titlu", slugger).id).toBe("titlu");
  });
});
