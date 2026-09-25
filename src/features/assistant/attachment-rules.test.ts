import { describe, expect, it } from "vitest";
import {
  attachmentReference,
  MAX_IMAGE_BYTES,
  MAX_PDF_BYTES,
  sanitizeFileName,
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
