import { afterEach, describe, expect, it, vi } from "vitest";
import type { ToolContext } from "../types";

vi.mock("@/features/items/queries", () => ({ getItemById: vi.fn() }));
vi.mock("@/features/items/service", () => ({ setItemImageUrl: vi.fn() }));
vi.mock("@/features/items/image-storage", () => ({
  uploadItemImage: vi.fn().mockResolvedValue("https://cdn/item/i1/image?v=1"),
}));
vi.mock("../attachments", () => ({
  getAttachment: vi.fn(),
  downloadAttachment: vi.fn().mockResolvedValue(new Blob(["x"], { type: "image/png" })),
  attachmentPreviewUrl: vi.fn().mockResolvedValue("https://signed/preview"),
}));

const { getItemById } = await import("@/features/items/queries");
const { setItemImageUrl } = await import("@/features/items/service");
const { uploadItemImage } = await import("@/features/items/image-storage");
const { getAttachment } = await import("../attachments");
const { seteazaImagineProdus } = await import("./attachment-write-tools");
const { InvalidToolArgumentsError } = await import("./types");

const CTX: ToolContext = { userId: "u1", role: "admin", organizationId: "org-1", clientId: null };
const ITEM = { id: "i1", title: "Nisip", kind: "physical", imageUrl: null };
const IMAGE = {
  id: "a1",
  fileName: "nisip.png",
  mimeType: "image/png",
  sizeBytes: 10,
  storagePath: "p",
};

afterEach(() => {
  vi.clearAllMocks();
});

describe("seteaza_imagine_produs", () => {
  it("accepta si forma `attachment:<id>` a ID-ului", () => {
    expect(seteazaImagineProdus.parse({ item_id: "i1", attachment_id: "attachment:a1" })).toEqual({
      item_id: "i1",
      attachment_id: "a1",
    });
  });

  it("cardul arata produsul si previzualizarea imaginii", async () => {
    vi.mocked(getItemById).mockResolvedValue(ITEM as never);
    vi.mocked(getAttachment).mockResolvedValue(IMAGE);

    const card = await seteazaImagineProdus.presentation!(
      { item_id: "i1", attachment_id: "a1" },
      CTX,
    );

    if (card.renderer !== "generic") throw new Error("renderer");
    expect(card.fields.find((field) => field.kind === "image")).toMatchObject({
      editable: false,
      previewUrl: "https://signed/preview",
      displayValue: "nisip.png",
    });
    expect(JSON.stringify(card)).toContain("Material: Nisip");
  });

  it("urca imaginea ca poza produsului si seteaza URL-ul", async () => {
    vi.mocked(getItemById).mockResolvedValue(ITEM as never);
    vi.mocked(getAttachment).mockResolvedValue(IMAGE);

    const result = await seteazaImagineProdus.execute({ item_id: "i1", attachment_id: "a1" }, CTX);

    expect(uploadItemImage).toHaveBeenCalledWith("i1", expect.any(Blob), "image/png");
    expect(setItemImageUrl).toHaveBeenCalledWith("i1", "https://cdn/item/i1/image?v=1");
    expect(result).toMatchObject({ item_id: "i1", link: "/itemi/i1" });
  });

  it("un PDF sau un atasament strain nu devine poza", async () => {
    vi.mocked(getItemById).mockResolvedValue(ITEM as never);

    vi.mocked(getAttachment).mockResolvedValueOnce({ ...IMAGE, mimeType: "application/pdf" });
    await expect(
      seteazaImagineProdus.execute({ item_id: "i1", attachment_id: "a1" }, CTX),
    ).rejects.toBeInstanceOf(InvalidToolArgumentsError);

    vi.mocked(getAttachment).mockResolvedValueOnce(null);
    await expect(
      seteazaImagineProdus.execute({ item_id: "i1", attachment_id: "a2" }, CTX),
    ).rejects.toThrow(/nu e al utilizatorului/);

    expect(uploadItemImage).not.toHaveBeenCalled();
    expect(setItemImageUrl).not.toHaveBeenCalled();
  });
});
