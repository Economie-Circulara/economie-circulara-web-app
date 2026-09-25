import { afterEach, describe, expect, it, vi } from "vitest";
import type { ToolContext } from "./types";

const insert = vi.fn();
const maybeSingle = vi.fn();
vi.mock("./db", () => ({
  assistantDb: vi.fn(async () => ({
    from: () => ({
      insert,
      select: () => ({ eq: () => ({ maybeSingle }) }),
    }),
  })),
}));

const createSignedUploadUrl = vi.fn();
const download = vi.fn();
vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: () => ({
    storage: { from: () => ({ createSignedUploadUrl, download }) },
  }),
}));

const { registerAttachment, getAttachment, downloadAttachment, AttachmentError } =
  await import("./attachments");

const CTX: ToolContext = { userId: "u1", role: "admin", organizationId: "org-1", clientId: null };

afterEach(() => {
  vi.clearAllMocks();
});

describe("registerAttachment", () => {
  it("inregistreaza pe sesiune si emite URL semnat, pe path-ul organizatie/utilizator/id", async () => {
    insert.mockResolvedValue({ error: null });
    createSignedUploadUrl.mockResolvedValue({ data: { token: "tok" }, error: null });

    const result = await registerAttachment(CTX, {
      name: "rețete [v2].pdf",
      type: "application/pdf",
      size: 1000,
    });

    const row = insert.mock.calls[0][0];
    expect(row).toMatchObject({
      organization_id: "org-1",
      user_id: "u1",
      file_name: "rețete v2.pdf",
      mime_type: "application/pdf",
      size_bytes: 1000,
    });
    expect(row.storage_path).toBe(`org-1/u1/${row.id}`);
    expect(createSignedUploadUrl).toHaveBeenCalledWith(row.storage_path);
    expect(result).toMatchObject({ path: row.storage_path, token: "tok" });
    expect(result.attachment.id).toBe(row.id);
  });

  it("salveaza tipul canonic (un `.md` fara tip din browser devine text/markdown)", async () => {
    insert.mockResolvedValue({ error: null });
    createSignedUploadUrl.mockResolvedValue({ data: { token: "tok" }, error: null });

    const result = await registerAttachment(CTX, { name: "note.md", type: "", size: 10 });

    expect(insert.mock.calls[0][0].mime_type).toBe("text/markdown");
    expect(result.attachment.mimeType).toBe("text/markdown");
  });

  it("refuza un fisier invalid inainte de orice scriere", async () => {
    await expect(
      registerAttachment(CTX, { name: "a.exe", type: "application/x-msdownload", size: 5 }),
    ).rejects.toBeInstanceOf(AttachmentError);
    expect(insert).not.toHaveBeenCalled();
    expect(createSignedUploadUrl).not.toHaveBeenCalled();
  });
});

describe("getAttachment / downloadAttachment", () => {
  it("un ID malformat nu atinge baza de date", async () => {
    expect(await getAttachment("../alt-tenant")).toBeNull();
    expect(maybeSingle).not.toHaveBeenCalled();
  });

  it("ce nu vede RLS-ul (atasamentul altcuiva) e `null`", async () => {
    maybeSingle.mockResolvedValue({ data: null });
    expect(await getAttachment("3f1c2d4e-5a6b-4c7d-8e9f-0a1b2c3d4e5f")).toBeNull();
  });

  it("descarcarea esuata da un mesaj clar", async () => {
    download.mockResolvedValue({ data: null, error: { message: "not found" } });
    await expect(
      downloadAttachment({
        id: "x",
        fileName: "poza.png",
        mimeType: "image/png",
        sizeBytes: 1,
        storagePath: "p",
      }),
    ).rejects.toThrow(/poza\.png/);
  });
});
