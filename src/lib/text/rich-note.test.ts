import { describe, expect, it } from "vitest";
import { parseInline, parseRichNote } from "./rich-note";

describe("parseInline", () => {
  it("separa textul ingrosat", () => {
    expect(parseInline("Clasa **C25/30** S3")).toEqual([
      { text: "Clasa ", bold: false },
      { text: "C25/30", bold: true },
      { text: " S3", bold: false },
    ]);
  });

  it("lasa ca text simplu un ** fara pereche sau gol", () => {
    expect(parseInline("ritm **20 mc/h")).toEqual([{ text: "ritm **20 mc/h", bold: false }]);
    expect(parseInline("a **** b")).toEqual([{ text: "a **** b", bold: false }]);
  });

  it("mai multe portiuni ingrosate pe acelasi rand", () => {
    expect(parseInline("**A** si **B**")).toEqual([
      { text: "A", bold: true },
      { text: " si ", bold: false },
      { text: "B", bold: true },
    ]);
  });
});

describe("parseRichNote", () => {
  it("text gol -> fara blocuri", () => {
    expect(parseRichNote("")).toEqual([]);
    expect(parseRichNote("   \n  ")).toEqual([]);
    expect(parseRichNote(null)).toEqual([]);
  });

  it("pastreaza randurile in acelasi paragraf si desparte paragrafele la rand gol", () => {
    const blocks = parseRichNote("Lucrare: bloc P+4\nRitm 20 mc/h\n\nRecepție: Ion");
    expect(blocks).toEqual([
      {
        type: "paragraph",
        lines: [
          [{ text: "Lucrare: bloc P+4", bold: false }],
          [{ text: "Ritm 20 mc/h", bold: false }],
        ],
      },
      { type: "paragraph", lines: [[{ text: "Recepție: Ion", bold: false }]] },
    ]);
  });

  it("recunoaste listele cu - si *, si revine la paragraf dupa ele", () => {
    const blocks = parseRichNote("Elemente:\n- planșeu\n* stâlpi\nPompă furnizor");
    expect(blocks.map((b) => b.type)).toEqual(["paragraph", "list", "paragraph"]);
    expect(blocks[1]).toEqual({
      type: "list",
      items: [[{ text: "planșeu", bold: false }], [{ text: "stâlpi", bold: false }]],
    });
  });

  it("normalizeaza CRLF si ignora spatiile de la capatul randului", () => {
    expect(parseRichNote("A  \r\nB")).toEqual([
      {
        type: "paragraph",
        lines: [[{ text: "A", bold: false }], [{ text: "B", bold: false }]],
      },
    ]);
  });

  it("un minus fara spatiu (ex. o valoare negativa) nu e lista", () => {
    expect(parseRichNote("-5 grade")[0].type).toBe("paragraph");
  });
});
