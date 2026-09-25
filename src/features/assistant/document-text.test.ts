import { describe, expect, it, vi } from "vitest";

vi.mock("./pdf-text", () => ({
  extractPdfText: vi.fn().mockResolvedValue({ pages: 2, text: "pdf", scanned: false }),
}));

const { extractPdfText } = await import("./pdf-text");
const { decodeText, extractDocumentText, htmlToText } = await import("./document-text");

/** Blob-ul din jsdom n-are `arrayBuffer`; in Node (runtime-ul real) il are. */
function file(text: string): Blob {
  return { arrayBuffer: async () => new TextEncoder().encode(text).buffer } as unknown as Blob;
}

describe("htmlToText", () => {
  it("pastreaza structura (titluri, paragrafe, liste, tabele), fara script/stil/entitati", () => {
    const html = `<html><head><title>x</title><style>p{color:red}</style></head><body>
      <h1>Rețete &amp; fișe</h1>
      <p>Beton&nbsp;C20<br>la 1000 kg</p>
      <ul><li>nisip</li><li>ciment</li></ul>
      <table><tr><th>Material</th><th>kg</th></tr><tr><td>Nisip</td><td>700</td></tr></table>
      <script>alert("x")</script><!-- comentariu -->
      <p>&#259;&#x219;</p></body></html>`;

    expect(htmlToText(html)).toBe(
      [
        "Rețete & fișe",
        "",
        "Beton C20",
        "la 1000 kg",
        "",
        "- nisip",
        "- ciment",
        "",
        "Material | kg",
        "Nisip | 700",
        "",
        "ăș",
      ].join("\n"),
    );
  });
});

describe("decodeText", () => {
  it("elimina BOM-ul UTF-8 (CSV UTF-8 din Excel)", () => {
    expect(decodeText(new TextEncoder().encode("﻿a;b").buffer)).toBe("a;b");
  });
});

describe("extractDocumentText", () => {
  it("PDF -> pdf-text; text -> continutul; HTML -> text; imagine -> eroare", async () => {
    expect(await extractDocumentText(file("x"), "application/pdf")).toEqual({
      text: "pdf",
      pages: 2,
      scanned: false,
    });
    expect(extractPdfText).toHaveBeenCalledTimes(1);

    expect(await extractDocumentText(file("# Titlu\n\ntext\n"), "text/markdown")).toEqual({
      text: "# Titlu\n\ntext",
      pages: null,
      scanned: false,
    });
    expect((await extractDocumentText(file("<p>a</p><p>b</p>"), "text/html")).text).toBe("a\nb");
    await expect(extractDocumentText(file("x"), "image/png")).rejects.toThrow(/nu poate fi citit/);
  });
});
