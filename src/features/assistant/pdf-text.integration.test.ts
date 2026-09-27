// @vitest-environment node
import { describe, expect, it } from "vitest";
import { extractPdfText } from "./pdf-text";

/** Un PDF minimal, valid, cu cate o linie de text (Helvetica) pe pagina. */
function minimalPdf(pages: string[]): Blob {
  const objects: string[] = [
    "<< /Type /Catalog /Pages 2 0 R >>",
    `<< /Type /Pages /Kids [${pages.map((_, i) => `${4 + i * 2} 0 R`).join(" ")}] /Count ${pages.length} >>`,
    "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>",
  ];
  pages.forEach((text, i) => {
    const stream = `BT /F1 12 Tf 50 750 Td (${text}) Tj ET`;
    objects.push(
      `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Contents ${5 + i * 2} 0 R /Resources << /Font << /F1 3 0 R >> >> >>`,
    );
    objects.push(`<< /Length ${stream.length} >>\nstream\n${stream}\nendstream`);
  });
  let body = "%PDF-1.4\n";
  const offsets: number[] = [];
  objects.forEach((object, i) => {
    offsets.push(body.length);
    body += `${i + 1} 0 obj\n${object}\nendobj\n`;
  });
  const xref = body.length;
  body += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
  body += offsets.map((offset) => `${String(offset).padStart(10, "0")} 00000 n \n`).join("");
  body += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`;
  return new Blob([body], { type: "application/pdf" });
}

describe("extractPdfText (unpdf real)", () => {
  it("citeste textul fiecarei pagini", async () => {
    const result = await extractPdfText(
      minimalPdf(["Beton C20: nisip 700 kg, ciment 300 kg", "Mortar: ciment 25 kg"]),
    );

    expect(result.pages).toBe(2);
    expect(result.scanned).toBe(false);
    expect(result.text).toContain("--- Pagina 1 ---\nBeton C20: nisip 700 kg, ciment 300 kg");
    expect(result.text).toContain("--- Pagina 2 ---\nMortar: ciment 25 kg");
  });

  it("o pagina fara text e raportata ca scanata", async () => {
    expect((await extractPdfText(minimalPdf([""]))).scanned).toBe(true);
  });
});
