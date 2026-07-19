import { describe, expect, it, vi } from "vitest";

// Izolam orchestrarea de randarea reala @react-pdf/renderer — acelasi pattern ca
// `certificates/service.test.ts` (randarea in sine nu se testeaza, doar apelul).
const { renderToBuffer } = vi.hoisted(() => ({ renderToBuffer: vi.fn() }));
vi.mock("@react-pdf/renderer", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@react-pdf/renderer")>();
  return { ...actual, renderToBuffer };
});

import { renderReportPdf } from "./pdf";

describe("renderReportPdf", () => {
  it("randeaza PDF-ul cu datele primite si intoarce buffer-ul", async () => {
    const expectedBuffer = Buffer.from("pdf-content");
    renderToBuffer.mockResolvedValue(expectedBuffer);

    const result = await renderReportPdf({
      reportTitle: "Comenzi pe perioadă",
      reportDescription: "Descriere",
      range: { from: "2026-07-01", to: "2026-07-18" },
      orgName: "Lateris Trace Demo",
      brandColor: "#123456",
      accentColor: "#654321",
      columns: [{ key: "label", header: "Status" }],
      rows: [{ label: "Trimisă" }],
    });

    expect(renderToBuffer).toHaveBeenCalledTimes(1);
    expect(result).toBe(expectedBuffer);
  });
});
