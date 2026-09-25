import { afterEach, describe, expect, it, vi } from "vitest";
import type { ToolContext } from "../types";

vi.mock("@/features/items/queries", () => ({
  listItemOptions: vi.fn().mockResolvedValue([
    { id: "beton", title: "Beton C20", unit: "kg", kind: "physical", isTracked: true },
    { id: "nisip", title: "Nisip spălat", unit: "kg", kind: "physical", isTracked: true },
    { id: "ciment", title: "Ciment", unit: "kg", kind: "physical", isTracked: true },
    { id: "mortar", title: "Mortar", unit: "kg", kind: "physical", isTracked: true },
  ]),
}));
vi.mock("@/features/recipes/queries", () => ({
  listRecipes: vi.fn().mockResolvedValue([{ itemId: "mortar" }]),
  getRecipeByItemId: vi.fn().mockResolvedValue(null),
}));
vi.mock("@/features/recipes/service", () => ({
  createRecipe: vi.fn(async (itemId: string) => ({ id: `r-${itemId}`, itemId })),
  addOrUpdateComponents: vi.fn().mockResolvedValue(undefined),
}));
vi.mock("../attachments", () => ({
  getAttachment: vi.fn(),
  downloadAttachment: vi.fn().mockResolvedValue(new Blob(["%PDF"])),
}));
vi.mock("../pdf-text", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../pdf-text")>()),
  extractPdfText: vi.fn(),
}));

const recipeService = await import("@/features/recipes/service");
const { getAttachment } = await import("../attachments");
const { extractPdfText } = await import("../pdf-text");
const { citesteDocument, importaRetete } = await import("./document-tools");
const { InvalidToolArgumentsError } = await import("./types");

const CTX: ToolContext = { userId: "u1", role: "admin", organizationId: "org-1", clientId: null };
const PDF = {
  id: "a1",
  fileName: "retete.pdf",
  mimeType: "application/pdf",
  sizeBytes: 9,
  storagePath: "p",
};

afterEach(() => {
  vi.clearAllMocks();
});

describe("citeste_document", () => {
  it("intoarce textul pe bucati, cu indicatie de continuare", async () => {
    vi.mocked(getAttachment).mockResolvedValue(PDF);
    vi.mocked(extractPdfText).mockResolvedValue({
      pages: 3,
      text: "x".repeat(20000),
      scanned: false,
    });

    const first = (await citesteDocument.execute({ attachment_id: "a1", de_la: 0 }, CTX)) as {
      text: string;
      continuare: { de_la: number } | null;
    };
    expect(first.text).toHaveLength(12000);
    expect(first.continuare).toEqual({ de_la: 12000 });

    const rest = (await citesteDocument.execute({ attachment_id: "a1", de_la: 12000 }, CTX)) as {
      text: string;
      continuare: unknown;
    };
    expect(rest.text).toHaveLength(8000);
    expect(rest.continuare).toBeNull();
  });

  it("imagini, PDF-uri scanate si atasamente straine -> eroare explicativa, nu exceptie", async () => {
    vi.mocked(getAttachment).mockResolvedValueOnce({ ...PDF, mimeType: "image/png" });
    expect(await citesteDocument.execute({ attachment_id: "a1", de_la: 0 }, CTX)).toMatchObject({
      eroare: expect.stringMatching(/imagine/),
    });

    vi.mocked(getAttachment).mockResolvedValueOnce(PDF);
    vi.mocked(extractPdfText).mockResolvedValueOnce({ pages: 2, text: "", scanned: true });
    expect(await citesteDocument.execute({ attachment_id: "a1", de_la: 0 }, CTX)).toMatchObject({
      eroare: expect.stringMatching(/scanat/),
    });

    vi.mocked(getAttachment).mockResolvedValueOnce(null);
    expect(await citesteDocument.execute({ attachment_id: "a2", de_la: 0 }, CTX)).toMatchObject({
      eroare: expect.stringMatching(/nu e al utilizatorului/),
    });
  });

  it("are plafon de rezultat mai mare decat implicitul (textul e rezultatul)", () => {
    expect(citesteDocument.maxResultChars).toBeGreaterThan(12000);
  });
});

describe("importa_retete - parse", () => {
  it("cantitatile devin procente (fata de cantitatea de baza sau suma lor)", () => {
    const input = importaRetete.parse({
      retete: [
        {
          produs: "Beton C20",
          cantitate_baza: 1000,
          componente: [
            { nume: "nisip", cantitate: 700 },
            { nume: "ciment", cantitate: 300 },
          ],
        },
        {
          produs: "Mortar",
          directie: "compunere",
          componente: [
            { nume: "nisip", cantitate: 3 },
            { nume: "ciment", procent: 25 },
            { nume: "var", cantitate: 1 },
          ],
        },
      ],
    });

    expect(input.retete[0].componente.map((c) => c.procent)).toEqual([70, 30]);
    expect(input.retete[0].directie).toBe("compunere");
    expect(input.retete[1].componente.map((c) => c.procent)).toEqual([75, 25, 25]);
  });

  it("refuza materiile prime fara procent/cantitate si importurile prea mari", () => {
    expect(() =>
      importaRetete.parse({ retete: [{ produs: "X", componente: [{ nume: "nisip" }] }] }),
    ).toThrow(InvalidToolArgumentsError);
    expect(() =>
      importaRetete.parse({
        retete: Array.from({ length: 21 }, () => ({
          produs: "X",
          componente: [{ nume: "a", procent: 1 }],
        })),
      }),
    ).toThrow(/Maxim 20/);
  });
});

describe("importa_retete - card si executie", () => {
  const args = {
    attachment_id: "attachment:a1",
    retete: [
      {
        produs: "beton c20",
        componente: [
          { nume: "Nisip spalat", procent: 70 },
          { nume: "ciment", procent: 30 },
        ],
      },
      { produs: "Mortar", componente: [{ nume: "ciment", procent: 25 }] },
      { produs: "Asfalt", componente: [{ nume: "bitum", procent: 5 }] },
    ],
  };

  it("cardul potriveste numele cu materialele si debifeaza produsele care au deja reteta", async () => {
    vi.mocked(getAttachment).mockResolvedValue(PDF);
    const card = await importaRetete.presentation!(importaRetete.parse(args), CTX);

    if (card.renderer !== "recipe_import") throw new Error("renderer");
    expect(card.sourceLabel).toBe("retete.pdf");
    expect(card.recipes[0]).toMatchObject({
      itemId: "beton",
      included: true,
      components: [
        { itemId: "nisip", percentage: 70 },
        { itemId: "ciment", percentage: 30 },
      ],
    });
    expect(card.recipes[1]).toMatchObject({ itemId: "mortar", included: false });
    expect(card.recipes[2]).toMatchObject({
      itemId: null,
      components: [{ sourceName: "bitum", itemId: null }],
    });
    expect(card.itemsWithRecipe).toEqual(["mortar"]);
  });

  it("creeaza retetele valide si raporteaza ce a sarit (fara reteta partiala)", async () => {
    const result = (await importaRetete.execute(importaRetete.parse(args), CTX)) as {
      create: { produs: string }[];
      sarite: { produs: string; motiv: string }[];
      link: string;
    };

    expect(recipeService.createRecipe).toHaveBeenCalledTimes(1);
    expect(recipeService.createRecipe).toHaveBeenCalledWith("beton", "compunere");
    expect(recipeService.addOrUpdateComponents).toHaveBeenCalledWith("r-beton", [
      { componentItemId: "nisip", percentage: 70 },
      { componentItemId: "ciment", percentage: 30 },
    ]);
    expect(result.create).toEqual([
      { produs: "Beton C20", item_id: "beton", link: "/retete/beton" },
    ]);
    expect(result.sarite).toEqual([
      { produs: "Mortar", motiv: "produsul are deja o rețetă" },
      { produs: "Asfalt", motiv: "produsul nu a fost ales" },
    ]);
    expect(result.link).toBe("/retete/beton");
    expect(importaRetete.resultSummary!(importaRetete.parse(args), result)).toContain(
      "Am creat 1 rețetă: **Beton C20**.",
    );
  });

  it("retetele debifate in card sunt ignorate; daca nu ramane nimic -> eroare clara", async () => {
    const input = importaRetete.parse({
      retete: [{ ...args.retete[0], inclus: false }],
    });
    await expect(importaRetete.execute(input, CTX)).rejects.toThrow(/Nicio rețetă bifată/);
    expect(recipeService.createRecipe).not.toHaveBeenCalled();
  });

  it("produsul ca propria materie prima e oprit INAINTE de a crea reteta", async () => {
    const input = importaRetete.parse({
      retete: [{ produs: "Beton C20", componente: [{ nume: "Beton C20", procent: 10 }] }],
    });
    await expect(importaRetete.execute(input, CTX)).rejects.toThrow(/și ca materie primă/);
    expect(recipeService.createRecipe).not.toHaveBeenCalled();
  });
});
