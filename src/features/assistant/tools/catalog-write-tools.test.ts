import { afterEach, describe, expect, it, vi } from "vitest";
import type { ToolContext } from "../types";

vi.mock("@/features/clients/queries", () => ({ getClient: vi.fn() }));
vi.mock("@/features/clients/service", () => ({
  updateClientRecord: vi.fn(),
  setClientArchived: vi.fn(),
}));
vi.mock("@/features/items/queries", () => ({ getItemById: vi.fn() }));
vi.mock("@/features/items/service", () => ({
  createItem: vi.fn(),
  updateItem: vi.fn(),
  setItemArchived: vi.fn(),
}));
vi.mock("@/features/recipes/queries", () => ({ getRecipeByItemId: vi.fn() }));
vi.mock("@/features/recipes/service", () => ({ setRecipeArchived: vi.fn() }));

const { getClient } = await import("@/features/clients/queries");
const clientService = await import("@/features/clients/service");
const { getItemById } = await import("@/features/items/queries");
const itemService = await import("@/features/items/service");
const { getRecipeByItemId } = await import("@/features/recipes/queries");
const { setRecipeArchived } = await import("@/features/recipes/service");
const { editeazaClient, creeazaItem, editeazaItem, arhiveaza } =
  await import("./catalog-write-tools");
const { InvalidToolArgumentsError } = await import("./types");

const CTX: ToolContext = { userId: "u1", role: "admin", organizationId: "org-1", clientId: null };

const CLIENT = {
  id: "c1",
  clientType: "juridica",
  cui: "12345678",
  cnp: null,
  name: "ACME SRL",
  regCom: "J40/1/2020",
  isVatPayer: true,
  hqAddress: "București",
  email: "old@acme.ro",
  phone: null,
  contactPerson: null,
  isSupplier: true,
  notes: "client vechi",
  archivedAt: null,
  createdAt: "",
};

const ITEM = {
  id: "i1",
  title: "Nisip",
  description: null,
  unit: "tona",
  kind: "physical",
  isTracked: true,
  sellable: true,
  imageUrl: "img",
};

afterEach(() => {
  vi.clearAllMocks();
});

describe("editeaza_client", () => {
  it("schimba doar campurile propuse si pastreaza restul (inclusiv furnizor/observatii)", async () => {
    vi.mocked(getClient).mockResolvedValue(CLIENT as never);
    vi.mocked(clientService.updateClientRecord).mockResolvedValue({
      id: "c1",
      name: "ACME SRL",
    } as never);

    const input = editeazaClient.parse({ client_id: "c1", email: "nou@acme.ro" });
    await editeazaClient.execute(input, CTX);

    expect(clientService.updateClientRecord).toHaveBeenCalledWith({
      id: "c1",
      clientType: "juridica",
      name: "ACME SRL",
      cui: "12345678",
      cnp: null,
      regCom: "J40/1/2020",
      hqAddress: "București",
      email: "nou@acme.ro",
      phone: null,
      contactPerson: null,
      isVatPayer: true,
      isSupplier: true,
      notes: "client vechi",
    });
  });

  it("cardul arata valorile finale, editabile", async () => {
    vi.mocked(getClient).mockResolvedValue(CLIENT as never);
    const card = await editeazaClient.presentation!(
      editeazaClient.parse({ client_id: "c1", telefon: "0722" }),
      CTX,
    );
    if (card.renderer !== "generic") throw new Error("renderer");
    const telefon = card.fields.find((field) => field.name === "telefon");
    expect(telefon).toMatchObject({ editable: true, value: "0722" });
    expect(card.fields.find((field) => field.name === "email")?.value).toBe("old@acme.ro");
  });
});

describe("editeaza_client - persoana fizica (0051)", () => {
  const PERSON = {
    ...CLIENT,
    id: "p1",
    clientType: "fizica",
    cui: null,
    cnp: "1900101000006",
    name: "Ion Popescu",
    regCom: null,
    isVatPayer: false,
  };

  it("schimba CNP-ul si ignora CUI / reg. com. / TVA propuse", async () => {
    vi.mocked(getClient).mockResolvedValue(PERSON as never);
    vi.mocked(clientService.updateClientRecord).mockResolvedValue({ id: "p1" } as never);

    const input = editeazaClient.parse({
      client_id: "p1",
      cnp: "2900215 123459",
      cui: "12345678",
      platitor_tva: true,
    });
    await editeazaClient.execute(input, CTX);

    expect(clientService.updateClientRecord).toHaveBeenCalledWith(
      expect.objectContaining({
        clientType: "fizica",
        cnp: "2900215123459",
        cui: null,
        regCom: null,
        isVatPayer: false,
      }),
    );
  });

  it("refuza un CNP invalid", () => {
    expect(() => editeazaClient.parse({ client_id: "p1", cnp: "1900101000000" })).toThrow(
      InvalidToolArgumentsError,
    );
  });

  it("cardul are CNP in loc de CUI, fara TVA, si semnaleaza campurile ignorate", async () => {
    vi.mocked(getClient).mockResolvedValue(PERSON as never);
    const card = await editeazaClient.presentation!(
      editeazaClient.parse({ client_id: "p1", cui: "12345678" }),
      CTX,
    );
    if (card.renderer !== "generic") throw new Error("renderer");
    const names = card.fields.map((field) => field.name);
    expect(names).toContain("cnp");
    expect(names).not.toContain("cui");
    expect(names).not.toContain("platitor_tva");
    expect(card.fields.find((field) => field.name === "client_id")?.displayValue).toBe(
      "Ion Popescu (Persoană fizică)",
    );
    expect(card.fields.find((field) => field.name === "ignorat")?.displayValue).toContain("CUI");
  });
});

describe("creeaza_item", () => {
  it("abonament -> kind service, fara `nelimitat`; material nelimitat -> is_tracked false", async () => {
    vi.mocked(itemService.createItem).mockResolvedValue({ ...ITEM, id: "n1" } as never);

    await creeazaItem.execute(
      creeazaItem.parse({
        tip: "abonament",
        denumire: "Mentenanță",
        um: "bucata",
        nelimitat: true,
      }),
      CTX,
    );
    expect(vi.mocked(itemService.createItem).mock.calls[0][0]).toMatchObject({
      kind: "service",
      isTracked: true,
      sellable: true,
      organizationId: "org-1",
    });

    await creeazaItem.execute(
      creeazaItem.parse({ tip: "material", denumire: "Apă", um: "litru", nelimitat: true }),
      CTX,
    );
    expect(vi.mocked(itemService.createItem).mock.calls[1][0]).toMatchObject({
      kind: "physical",
      isTracked: false,
    });
  });

  it("refuza o UM necunoscuta", () => {
    expect(() => creeazaItem.parse({ tip: "material", denumire: "X", um: "galon" })).toThrow(
      InvalidToolArgumentsError,
    );
  });
});

describe("editeaza_item", () => {
  it("pastreaza tipul si NU atinge poza (fara cheia imageUrl)", async () => {
    vi.mocked(getItemById).mockResolvedValue(ITEM as never);
    vi.mocked(itemService.updateItem).mockResolvedValue(ITEM as never);

    await editeazaItem.execute(
      editeazaItem.parse({ item_id: "i1", denumire: "Nisip spălat" }),
      CTX,
    );

    const [, patch] = vi.mocked(itemService.updateItem).mock.calls[0];
    expect(patch).toEqual({
      title: "Nisip spălat",
      description: null,
      unit: "tona",
      kind: "physical",
      isTracked: true,
      sellable: true,
    });
    expect(patch).not.toHaveProperty("imageUrl");
  });
});

describe("arhiveaza", () => {
  it("arhiveaza clientul / produsul prin serviciile de soft-delete", async () => {
    await arhiveaza.execute({ tip: "client", id: "c1" }, CTX);
    await arhiveaza.execute({ tip: "item", id: "i1" }, CTX);
    expect(clientService.setClientArchived).toHaveBeenCalledWith("c1", true);
    expect(itemService.setItemArchived).toHaveBeenCalledWith("i1", true);
  });

  it("reteta: dupa item_id; fara reteta -> eroare, nimic arhivat", async () => {
    vi.mocked(getRecipeByItemId).mockResolvedValueOnce({ recipeId: "r1" } as never);
    await arhiveaza.execute({ tip: "reteta", id: "i1" }, CTX);
    expect(setRecipeArchived).toHaveBeenCalledWith("r1", true);

    vi.mocked(getRecipeByItemId).mockResolvedValueOnce(null);
    await expect(arhiveaza.execute({ tip: "reteta", id: "i2" }, CTX)).rejects.toBeInstanceOf(
      InvalidToolArgumentsError,
    );
    expect(setRecipeArchived).toHaveBeenCalledTimes(1);
  });

  it("refuza un tip necunoscut", () => {
    expect(() => arhiveaza.parse({ tip: "comanda", id: "o1" })).toThrow(InvalidToolArgumentsError);
  });
});
