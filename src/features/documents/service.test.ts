import { afterEach, describe, expect, it, vi } from "vitest";

// Mocks (nu spies — vezi AGENTS.md §2.2): inlocuim clientii Supabase + sesiunea.
const { createClient } = vi.hoisted(() => ({ createClient: vi.fn() }));
vi.mock("@/lib/supabase/server", () => ({ createClient }));

const { createAdminClient } = vi.hoisted(() => ({ createAdminClient: vi.fn() }));
vi.mock("@/lib/supabase/admin", () => ({ createAdminClient }));

const { requireUser, requireRole } = vi.hoisted(() => ({
  requireUser: vi.fn(),
  requireRole: vi.fn(),
}));
vi.mock("@/features/auth/session", () => ({ requireUser, requireRole }));

import {
  DocumentAccessError,
  DocumentOwnerNotFoundError,
  InvalidFileError,
  deleteDocument,
  getDownloadUrl,
  listDocuments,
  uploadDocument,
} from "./service";

afterEach(() => {
  vi.clearAllMocks();
});

function ownerLookupClient(org: { organization_id: string } | null) {
  const single = vi.fn().mockResolvedValue({ data: org, error: org ? null : { message: "no" } });
  const eq = vi.fn().mockReturnValue({ single });
  const select = vi.fn().mockReturnValue({ eq });
  const from = vi.fn().mockReturnValue({ select });
  return from;
}

function documentRow(overrides: Record<string, unknown> = {}) {
  return {
    id: "doc-1",
    organization_id: "org-1",
    owner_type: "client",
    owner_id: "client-1",
    file_path: "org-1/client/client-1/uuid-test.pdf",
    file_name: "test.pdf",
    mime_type: "application/pdf",
    size_bytes: 1024,
    description: null,
    uploaded_by: "user-1",
    created_at: "2026-07-01T00:00:00.000Z",
    ...overrides,
  };
}

describe("uploadDocument", () => {
  it("verifica ownerul prin clientul userului, incarca fisierul si insereaza randul prin admin", async () => {
    requireUser.mockResolvedValue({ id: "user-1" });
    createClient.mockResolvedValue({ from: ownerLookupClient({ organization_id: "org-1" }) });

    const upload = vi.fn().mockResolvedValue({ data: { path: "x" }, error: null });
    const remove = vi.fn();
    const single = vi.fn().mockResolvedValue({ data: documentRow(), error: null });
    const select = vi.fn().mockReturnValue({ single });
    const insert = vi.fn().mockReturnValue({ select });
    const adminFrom = vi.fn().mockReturnValue({ insert });
    createAdminClient.mockReturnValue({
      storage: { from: vi.fn().mockReturnValue({ upload, remove }) },
      from: adminFrom,
    });

    const file = new File(["continut"], "test.pdf", { type: "application/pdf" });
    const result = await uploadDocument({ ownerType: "client", ownerId: "client-1", file });

    expect(upload).toHaveBeenCalledTimes(1);
    const [path, uploadedFile, options] = upload.mock.calls[0];
    expect(path).toMatch(/^org-1\/client\/client-1\/[0-9a-f-]+-test\.pdf$/);
    expect(uploadedFile).toBe(file);
    expect(options).toMatchObject({ contentType: "application/pdf", upsert: false });

    expect(adminFrom).toHaveBeenCalledWith("documents");
    expect(insert).toHaveBeenCalledWith(
      expect.objectContaining({
        organization_id: "org-1",
        owner_type: "client",
        owner_id: "client-1",
        file_name: "test.pdf",
        mime_type: "application/pdf",
        size_bytes: file.size,
        uploaded_by: "user-1",
      }),
    );
    expect(result.id).toBe("doc-1");
    expect(remove).not.toHaveBeenCalled();
  });

  it("arunca DocumentOwnerNotFoundError cand ownerul nu e accesibil (izolare tenant)", async () => {
    requireUser.mockResolvedValue({ id: "user-1" });
    createClient.mockResolvedValue({ from: ownerLookupClient(null) });

    const file = new File(["x"], "test.pdf", { type: "application/pdf" });
    await expect(
      uploadDocument({ ownerType: "order", ownerId: "order-x", file }),
    ).rejects.toBeInstanceOf(DocumentOwnerNotFoundError);
    expect(createAdminClient).not.toHaveBeenCalled();
  });

  it("arunca InvalidFileError pentru un tip de fisier neacceptat, fara sa incarce nimic", async () => {
    requireUser.mockResolvedValue({ id: "user-1" });
    createClient.mockResolvedValue({ from: ownerLookupClient({ organization_id: "org-1" }) });

    const file = new File(["x"], "virus.exe", { type: "application/x-msdownload" });
    await expect(
      uploadDocument({ ownerType: "client", ownerId: "client-1", file }),
    ).rejects.toBeInstanceOf(InvalidFileError);
    expect(createAdminClient).not.toHaveBeenCalled();
  });

  it("sterge fisierul deja incarcat daca insertul in `documents` esueaza (fara obiecte orfane)", async () => {
    requireUser.mockResolvedValue({ id: "user-1" });
    createClient.mockResolvedValue({ from: ownerLookupClient({ organization_id: "org-1" }) });

    const upload = vi.fn().mockResolvedValue({ data: { path: "x" }, error: null });
    const remove = vi.fn().mockResolvedValue({ data: null, error: null });
    const single = vi.fn().mockResolvedValue({ data: null, error: { message: "boom" } });
    const select = vi.fn().mockReturnValue({ single });
    const insert = vi.fn().mockReturnValue({ select });
    createAdminClient.mockReturnValue({
      storage: { from: vi.fn().mockReturnValue({ upload, remove }) },
      from: vi.fn().mockReturnValue({ insert }),
    });

    const file = new File(["x"], "test.pdf", { type: "application/pdf" });
    await expect(
      uploadDocument({ ownerType: "client", ownerId: "client-1", file }),
    ).rejects.toThrow("Nu am putut salva documentul.");
    expect(remove).toHaveBeenCalledWith([expect.stringContaining("org-1/client/client-1/")]);
  });
});

describe("listDocuments", () => {
  it("filtreaza dupa owner_type/owner_id prin clientul userului (RLS)", async () => {
    const order = vi.fn().mockResolvedValue({ data: [documentRow()], error: null });
    const eqOwnerId = vi.fn().mockReturnValue({ order });
    const eqOwnerType = vi.fn().mockReturnValue({ eq: eqOwnerId });
    const select = vi.fn().mockReturnValue({ eq: eqOwnerType });
    const from = vi.fn().mockReturnValue({ select });
    createClient.mockResolvedValue({ from });

    const result = await listDocuments("client", "client-1");

    expect(from).toHaveBeenCalledWith("documents");
    expect(eqOwnerType).toHaveBeenCalledWith("owner_type", "client");
    expect(eqOwnerId).toHaveBeenCalledWith("owner_id", "client-1");
    expect(result).toHaveLength(1);
    expect(result[0].fileName).toBe("test.pdf");
  });
});

describe("getDownloadUrl", () => {
  it("arunca DocumentAccessError cand RLS nu returneaza randul (fara acces)", async () => {
    const single = vi.fn().mockResolvedValue({ data: null, error: { message: "no rows" } });
    const eq = vi.fn().mockReturnValue({ single });
    const select = vi.fn().mockReturnValue({ eq });
    createClient.mockResolvedValue({ from: vi.fn().mockReturnValue({ select }) });

    await expect(getDownloadUrl("doc-x")).rejects.toBeInstanceOf(DocumentAccessError);
    expect(createAdminClient).not.toHaveBeenCalled();
  });

  it("semneaza URL-ul cu clientul admin dupa ce RLS confirma accesul", async () => {
    const single = vi
      .fn()
      .mockResolvedValue({ data: { file_path: "org-1/client/c1/f.pdf" }, error: null });
    const eq = vi.fn().mockReturnValue({ single });
    const select = vi.fn().mockReturnValue({ eq });
    createClient.mockResolvedValue({ from: vi.fn().mockReturnValue({ select }) });

    const createSignedUrl = vi
      .fn()
      .mockResolvedValue({ data: { signedUrl: "https://signed.example/f.pdf" }, error: null });
    createAdminClient.mockReturnValue({
      storage: { from: vi.fn().mockReturnValue({ createSignedUrl }) },
    });

    const url = await getDownloadUrl("doc-1");

    expect(createSignedUrl).toHaveBeenCalledWith("org-1/client/c1/f.pdf", 60);
    expect(url).toBe("https://signed.example/f.pdf");
  });
});

describe("deleteDocument", () => {
  it("cere rol de staff inainte de orice altceva", async () => {
    requireRole.mockRejectedValue(new Error("REDIRECT"));
    await expect(deleteDocument("doc-1")).rejects.toThrow("REDIRECT");
    expect(createClient).not.toHaveBeenCalled();
  });

  it("sterge obiectul din storage (client admin) si randul din `documents`", async () => {
    requireRole.mockResolvedValue({ id: "user-1", role: "admin" });

    const single = vi
      .fn()
      .mockResolvedValue({ data: { file_path: "org-1/client/c1/f.pdf" }, error: null });
    const eqSelect = vi.fn().mockReturnValue({ single });
    const select = vi.fn().mockReturnValue({ eq: eqSelect });
    const eqDelete = vi.fn().mockResolvedValue({ error: null });
    const del = vi.fn().mockReturnValue({ eq: eqDelete });
    createClient.mockResolvedValue({ from: vi.fn().mockReturnValue({ select, delete: del }) });

    const remove = vi.fn().mockResolvedValue({ data: null, error: null });
    createAdminClient.mockReturnValue({ storage: { from: vi.fn().mockReturnValue({ remove }) } });

    await deleteDocument("doc-1");

    expect(remove).toHaveBeenCalledWith(["org-1/client/c1/f.pdf"]);
    expect(eqDelete).toHaveBeenCalledWith("id", "doc-1");
  });

  it("arunca DocumentAccessError cand documentul nu e accesibil", async () => {
    requireRole.mockResolvedValue({ id: "user-1", role: "admin" });
    const single = vi.fn().mockResolvedValue({ data: null, error: { message: "no rows" } });
    const eq = vi.fn().mockReturnValue({ single });
    const select = vi.fn().mockReturnValue({ eq });
    createClient.mockResolvedValue({ from: vi.fn().mockReturnValue({ select }) });

    await expect(deleteDocument("doc-x")).rejects.toBeInstanceOf(DocumentAccessError);
  });
});
