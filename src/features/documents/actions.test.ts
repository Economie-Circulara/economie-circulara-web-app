import { afterEach, describe, expect, it, vi } from "vitest";

const { uploadDocument, deleteDocument, getDownloadUrl } = vi.hoisted(() => ({
  uploadDocument: vi.fn(),
  deleteDocument: vi.fn(),
  getDownloadUrl: vi.fn(),
}));
vi.mock("./service", () => ({ uploadDocument, deleteDocument, getDownloadUrl }));

const { revalidatePath } = vi.hoisted(() => ({ revalidatePath: vi.fn() }));
vi.mock("next/cache", () => ({ revalidatePath }));

import { initialDocumentActionState } from "./action-state";
import { deleteDocumentAction, getDownloadUrlAction, uploadDocumentAction } from "./actions";

afterEach(() => {
  vi.clearAllMocks();
});

function formData(fields: Record<string, string | File>): FormData {
  const fd = new FormData();
  for (const [key, value] of Object.entries(fields)) fd.set(key, value);
  return fd;
}

describe("uploadDocumentAction", () => {
  it("respinge un owner_type invalid", async () => {
    const state = await uploadDocumentAction(
      initialDocumentActionState,
      formData({
        owner_type: "not-a-real-type",
        owner_id: "client-1",
        file: new File(["x"], "a.pdf", { type: "application/pdf" }),
      }),
    );
    expect(state.error).toMatch(/entitate/i);
    expect(uploadDocument).not.toHaveBeenCalled();
  });

  it("cere un fisier", async () => {
    const state = await uploadDocumentAction(
      initialDocumentActionState,
      formData({ owner_type: "client", owner_id: "client-1" }),
    );
    expect(state.error).toMatch(/fișier/i);
    expect(uploadDocument).not.toHaveBeenCalled();
  });

  it("incarca documentul si revalideaza path-ul cerut", async () => {
    uploadDocument.mockResolvedValue({ id: "doc-1" });
    const file = new File(["x"], "contract.pdf", { type: "application/pdf" });

    const state = await uploadDocumentAction(
      initialDocumentActionState,
      formData({
        owner_type: "client",
        owner_id: "client-1",
        file,
        description: "Contract",
        revalidate_path: "/clienti/client-1",
      }),
    );

    expect(uploadDocument).toHaveBeenCalledWith({
      ownerType: "client",
      ownerId: "client-1",
      file,
      description: "Contract",
    });
    expect(revalidatePath).toHaveBeenCalledWith("/clienti/client-1");
    expect(state.error).toBeNull();
  });

  it("propaga eroarea serviciului (ex. tip fisier neacceptat)", async () => {
    uploadDocument.mockRejectedValue(new Error("Tip de fișier neacceptat."));

    const state = await uploadDocumentAction(
      initialDocumentActionState,
      formData({
        owner_type: "client",
        owner_id: "client-1",
        file: new File(["x"], "a.exe", { type: "application/x-msdownload" }),
      }),
    );

    expect(state.error).toBe("Tip de fișier neacceptat.");
    expect(revalidatePath).not.toHaveBeenCalled();
  });
});

describe("deleteDocumentAction", () => {
  it("cere un document valid", async () => {
    const state = await deleteDocumentAction(initialDocumentActionState, formData({}));
    expect(state.error).toMatch(/document/i);
    expect(deleteDocument).not.toHaveBeenCalled();
  });

  it("sterge documentul si revalideaza", async () => {
    deleteDocument.mockResolvedValue(undefined);
    const state = await deleteDocumentAction(
      initialDocumentActionState,
      formData({ document_id: "doc-1", revalidate_path: "/clienti/client-1" }),
    );
    expect(deleteDocument).toHaveBeenCalledWith("doc-1");
    expect(revalidatePath).toHaveBeenCalledWith("/clienti/client-1");
    expect(state.error).toBeNull();
  });

  it("propaga eroarea serviciului (ex. acces interzis)", async () => {
    deleteDocument.mockRejectedValue(new Error("Document inexistent sau fara acces."));
    const state = await deleteDocumentAction(
      initialDocumentActionState,
      formData({ document_id: "doc-x" }),
    );
    expect(state.error).toBe("Document inexistent sau fara acces.");
  });
});

describe("getDownloadUrlAction", () => {
  it("returneaza URL-ul semnat", async () => {
    getDownloadUrl.mockResolvedValue("https://signed.example/f.pdf");
    const result = await getDownloadUrlAction("doc-1");
    expect(result).toEqual({ url: "https://signed.example/f.pdf", error: null });
  });

  it("mapeaza eroarea serviciului la un mesaj gata de afisat", async () => {
    getDownloadUrl.mockRejectedValue(new Error("Document inexistent sau fara acces."));
    const result = await getDownloadUrlAction("doc-x");
    expect(result).toEqual({ url: null, error: "Document inexistent sau fara acces." });
  });
});
