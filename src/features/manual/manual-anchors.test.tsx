import { readFileSync } from "node:fs";
import path from "node:path";
import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { ManualContent } from "./manual-content";
import { MANUAL_DOCS } from "./registry";
import { extractToc } from "./toc";

/**
 * Test de integrare pe documentele REALE din `docs/manual/`: cuprinsul e generat
 * din markdown-ul brut, iar id-urile titlurilor de `rehype-slug`, la randare - doua
 * drumuri diferite care trebuie sa dea acelasi rezultat, altfel ancorele din cuprins
 * duc in gol. Prinde si documentele noi adaugate in catalog.
 */
describe("ancorele cuprinsului pe documentele reale", () => {
  for (const doc of MANUAL_DOCS) {
    it(`${doc.file}: fiecare intrare din cuprins are titlul ei randat`, () => {
      const markdown = readFileSync(path.join(process.cwd(), "docs", "manual", doc.file), "utf8");
      const toc = extractToc(markdown);
      expect(toc.length).toBeGreaterThan(0);

      const { container } = render(<ManualContent markdown={markdown} />);
      const renderedIds = [...container.querySelectorAll("h2[id], h3[id]")].map((el) => el.id);

      expect(renderedIds).toEqual(toc.map((entry) => entry.id));
    });
  }
});
