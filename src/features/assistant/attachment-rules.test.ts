import { describe, expect, it } from "vitest";
import {
  ATTACHMENT_ACCEPT,
  attachmentReference,
  isReadableDocument,
  MAX_TEXT_BYTES,
  resolveMimeType,
  MAX_IMAGE_BYTES,
  MAX_PDF_BYTES,
  sanitizeFileName,
  attachmentHref,
  splitAttachmentReferences,
  validateAttachment,
} from "./attachment-rules";

const ID = "3f1c2d4e-5a6b-4c7d-8e9f-0a1b2c3d4e5f";

describe("validateAttachment", () => {
  it("accepta imagini pana la 2MB si PDF-uri pana la 10MB", () => {
    expect(
      validateAttachment({ name: "a.png", type: "image/png", size: MAX_IMAGE_BYTES }),
    ).toBeNull();
    expect(
      validateAttachment({ name: "r.pdf", type: "application/pdf", size: MAX_PDF_BYTES }),
    ).toBeNull();
  });

  it("refuza fisierele prea mari, goale sau de alt tip", () => {
    expect(
      validateAttachment({ name: "a.png", type: "image/png", size: MAX_IMAGE_BYTES + 1 }),
    ).toMatch(/2MB/);
    expect(
      validateAttachment({ name: "r.pdf", type: "application/pdf", size: MAX_PDF_BYTES + 1 }),
    ).toMatch(/10MB/);
    expect(validateAttachment({ name: "a.png", type: "image/png", size: 0 })).toMatch(/gol/);
    expect(
      validateAttachment({ name: "a.exe", type: "application/x-msdownload", size: 10 }),
    ).toMatch(/neacceptat/);
  });
});

describe("documente text", () => {
  it("tipul se deduce din extensie (browserele dau des tip gol sau gresit)", () => {
    expect(resolveMimeType("note.md", "")).toBe("text/markdown");
    expect(resolveMimeType("export.CSV", "application/vnd.ms-excel")).toBe("text/csv");
    expect(resolveMimeType("pagina.htm", "text/html")).toBe("text/html");
    expect(resolveMimeType("poza.png", "image/png")).toBe("image/png");
    expect(resolveMimeType("fara-extensie", "text/plain")).toBe("text/plain");
  });

  it("accepta fisiere text pana la 2MB, refuza tipurile necunoscute", () => {
    expect(validateAttachment({ name: "r.md", type: "", size: MAX_TEXT_BYTES })).toBeNull();
    expect(
      validateAttachment({ name: "r.csv", type: "text/csv", size: MAX_TEXT_BYTES + 1 }),
    ).toMatch(/2MB/);
    expect(
      validateAttachment({ name: "r.docx", type: "application/octet-stream", size: 10 }),
    ).toMatch(/neacceptat/);
  });

  it("selectorul de fisiere accepta si extensiile (nu doar tipurile)", () => {
    expect(ATTACHMENT_ACCEPT).toContain(".md");
    expect(ATTACHMENT_ACCEPT).toContain("text/csv");
    expect(isReadableDocument("application/pdf")).toBe(true);
    expect(isReadableDocument("application/json")).toBe(true);
    expect(isReadableDocument("image/png")).toBe(false);
  });
});

describe("referintele la atasamente din mesaj", () => {
  it("numele nu poate rupe markdown-ul referintei", () => {
    expect(sanitizeFileName("poză [final](v2).png")).toBe("poză finalv2.png");
    expect(sanitizeFileName("   ")).toBe("fisier");
  });

  it("dus-intors: textul si etichetele se separa corect", () => {
    const content = [
      "pune poza pe nisip",
      attachmentReference({ id: ID, fileName: "nisip.jpg" }),
    ].join("\n");

    expect(content).toContain(`📎 [nisip.jpg](attachment:${ID})`);
    expect(splitAttachmentReferences(content)).toEqual({
      text: "pune poza pe nisip",
      attachments: [{ id: ID, fileName: "nisip.jpg" }],
    });
  });

  it("un mesaj fara atasamente ramane neschimbat", () => {
    expect(splitAttachmentReferences("salut\nce faci")).toEqual({
      text: "salut\nce faci",
      attachments: [],
    });
  });
});

describe("attachmentHref", () => {
  it("deschide sau descarca prin ruta autentificata", () => {
    const id = "123e4567-e89b-12d3-a456-426614174000";
    expect(attachmentHref(id)).toBe(`/asistent/atasamente/${id}`);
    expect(attachmentHref(id, { download: true })).toBe(`/asistent/atasamente/${id}?descarca=1`);
  });
});
