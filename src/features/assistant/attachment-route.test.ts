import { afterEach, describe, expect, it, vi } from "vitest";

const getAttachment = vi.fn();
const attachmentSignedUrl = vi.fn();
vi.mock("./attachments", () => ({ getAttachment, attachmentSignedUrl }));

const { attachmentRedirect } = await import("./attachment-route");

const ATTACHMENT = {
  id: "a1",
  fileName: "retete.pdf",
  mimeType: "application/pdf",
  sizeBytes: 10,
  storagePath: "org-1/u1/a1",
};

afterEach(() => {
  vi.clearAllMocks();
});

describe("attachmentRedirect", () => {
  it("atasament strain sau inexistent (RLS) -> 404, fara URL semnat", async () => {
    getAttachment.mockResolvedValue(null);
    const response = await attachmentRedirect("a1", false);
    expect(response.status).toBe(404);
    expect(attachmentSignedUrl).not.toHaveBeenCalled();
  });

  it("deschidere -> redirect catre URL semnat de scurta durata", async () => {
    getAttachment.mockResolvedValue(ATTACHMENT);
    attachmentSignedUrl.mockResolvedValue("https://storage/signed");
    const response = await attachmentRedirect("a1", false);
    expect(response.status).toBe(307);
    expect(response.headers.get("location")).toBe("https://storage/signed");
    expect(attachmentSignedUrl).toHaveBeenCalledWith(ATTACHMENT, {
      expiresInSeconds: 60,
      download: false,
    });
  });

  it("descarcare -> cere URL-ul in modul download", async () => {
    getAttachment.mockResolvedValue(ATTACHMENT);
    attachmentSignedUrl.mockResolvedValue("https://storage/signed?download=retete.pdf");
    await attachmentRedirect("a1", true);
    expect(attachmentSignedUrl).toHaveBeenCalledWith(ATTACHMENT, {
      expiresInSeconds: 60,
      download: true,
    });
  });

  it("URL-ul nu poate fi emis -> 502", async () => {
    getAttachment.mockResolvedValue(ATTACHMENT);
    attachmentSignedUrl.mockResolvedValue(null);
    expect((await attachmentRedirect("a1", false)).status).toBe(502);
  });
});
