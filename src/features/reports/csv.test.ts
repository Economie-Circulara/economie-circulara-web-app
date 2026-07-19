import { describe, expect, it } from "vitest";
import { buildReportCsv } from "./csv";

describe("buildReportCsv", () => {
  it("genereaza CSV cu BOM, CRLF si headere", () => {
    const csv = buildReportCsv(
      ["Status", "Număr"],
      [
        ["Trimisă", "2"],
        ["Acceptată", "1"],
      ],
    );
    expect(csv.charCodeAt(0)).toBe(0xfeff);
    expect(csv).toContain("Status,Număr\r\n");
    expect(csv).toContain("Trimisă,2\r\n");
    expect(csv.endsWith("\r\n")).toBe(true);
  });

  it("incadreaza in ghilimele campurile cu virgula/ghilimele/newline (RFC 4180)", () => {
    const csv = buildReportCsv(["A"], [["cu, virgula"], ['cu "ghilimele"'], ["cu\nnewline"]]);
    expect(csv).toContain('"cu, virgula"');
    expect(csv).toContain('"cu ""ghilimele"""');
    expect(csv).toContain('"cu\nnewline"');
  });

  it("genereaza doar antetul pentru o lista goala de randuri", () => {
    const csv = buildReportCsv(["A", "B"], []);
    expect(csv).toBe(`${String.fromCharCode(0xfeff)}A,B\r\n`);
  });
});
