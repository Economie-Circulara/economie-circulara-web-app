import { describe, expect, it, vi } from "vitest";
import type { ToolContext } from "../types";

vi.mock("@/features/clients/queries", () => ({
  listClients: vi
    .fn()
    .mockResolvedValue([
      { id: "client-1", name: "ACME SRL", cui: "12345678", email: "contact@acme.ro" },
    ]),
}));

vi.mock("@/features/items/queries", () => ({
  listItems: vi.fn().mockResolvedValue([{ id: "item-1", title: "Agregat 0-4", unit: "kg" }]),
}));

vi.mock("@/features/stock/queries", () => ({
  listLots: vi.fn().mockResolvedValue([]),
}));

vi.mock("@/features/search/service", () => ({
  globalSearch: vi.fn().mockResolvedValue([
    {
      type: "clients",
      label: "Clienți",
      results: [{ id: "client-1", title: "ACME SRL", href: "/clienti/client-1" }],
    },
  ]),
}));

vi.mock("../docs-search", () => ({ searchManual: vi.fn() }));
vi.mock("@/features/clients/cui-lookup", () => ({
  defaultCuiLookupProvider: { lookup: vi.fn() },
  isValidCuiFormat: vi.fn().mockReturnValue(true),
  normalizeCui: vi.fn((cui: string) => cui),
}));

const { listeazaClienti, itemiVandabili, cauta } = await import("./read-tools");

const CTX: ToolContext = {
  userId: "u1",
  role: "admin",
  organizationId: "org-1",
  clientId: null,
};

describe("listeaza_clienti", () => {
  it("include link-ul catre pagina clientului", async () => {
    const result = await listeazaClienti.execute({ cautare: null }, CTX);
    expect(result).toEqual([
      {
        client_id: "client-1",
        denumire: "ACME SRL",
        cui: "12345678",
        email: "contact@acme.ro",
        link: "/clienti/client-1",
      },
    ]);
  });
});

describe("itemi_vandabili", () => {
  it("include link-ul catre pagina itemului", async () => {
    const result = await itemiVandabili.execute({ cautare: null }, CTX);
    expect(result).toEqual([
      { item_id: "item-1", denumire: "Agregat 0-4", um: "kg", link: "/itemi/item-1" },
    ]);
  });
});

describe("cauta", () => {
  it("remapeaza href in link si nu mai include href", async () => {
    const result = await cauta.execute({ text: "acme" }, CTX);
    expect(result).toEqual([
      {
        type: "clients",
        label: "Clienți",
        results: [{ id: "client-1", title: "ACME SRL", link: "/clienti/client-1" }],
      },
    ]);
  });
});
