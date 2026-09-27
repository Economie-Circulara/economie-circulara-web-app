import { describe, expect, it, vi } from "vitest";

vi.mock("unpdf", () => ({
  getDocumentProxy: vi.fn(async () => ({})),
  extractText: vi.fn(),
}));

const { extractText } = await import("unpdf");
const { extractPdfText, textChunk } = await import("./pdf-text");

/** Blob-ul din jsdom n-are `arrayBuffer`; in Node (runtime-ul real) il are. */
const pdfFile = { arrayBuffer: async () => new ArrayBuffer(4) } as unknown as Blob;

describe("extractPdfText", () => {
  it("numeroteaza paginile si compacteaza spatiile", async () => {
    vi.mocked(extractText).mockResolvedValueOnce({
      totalPages: 2,
      text: ["Beton   C20: nisip 700 kg", "Mortar: ciment 25 kg"],
    } as never);

    const result = await extractPdfText(pdfFile);

    expect(result).toEqual({
      pages: 2,
      text: "--- Pagina 1 ---\nBeton C20: nisip 700 kg\n\n--- Pagina 2 ---\nMortar: ciment 25 kg",
      scanned: false,
    });
  });

  it("un PDF fara strat de text e marcat ca scanat", async () => {
    vi.mocked(extractText).mockResolvedValueOnce({ totalPages: 3, text: ["", " ", ""] } as never);
    expect((await extractPdfText(pdfFile)).scanned).toBe(true);
  });
});

describe("textChunk", () => {
  it("imparte textul si spune daca mai urmeaza", () => {
    expect(textChunk("abcdefghij", 0, 4)).toEqual({
      start: 0,
      end: 4,
      chunk: "abcd",
      hasMore: true,
    });
    expect(textChunk("abcdefghij", 8, 4)).toEqual({
      start: 8,
      end: 10,
      chunk: "ij",
      hasMore: false,
    });
    expect(textChunk("abc", 99, 4)).toEqual({ start: 3, end: 3, chunk: "", hasMore: false });
  });
});
