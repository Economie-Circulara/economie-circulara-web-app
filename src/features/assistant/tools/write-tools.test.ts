import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("@/features/clients/service", () => ({ createClientRecord: vi.fn() }));
vi.mock("@/features/clients/queries", () => ({ listClients: vi.fn().mockResolvedValue([]) }));
vi.mock("@/features/orders/queries", () => ({
  listClientAddressesGrouped: vi.fn().mockResolvedValue({}),
  listSellableItemOptions: vi.fn().mockResolvedValue([]),
  getOrderDetail: vi.fn(),
}));
vi.mock("@/features/orders/service", () => ({
  createOrderWithItems: vi.fn(),
  sendOrder: vi.fn(),
}));

import {
  getOrderDetail,
  listClientAddressesGrouped,
  listSellableItemOptions,
} from "@/features/orders/queries";
import { listClients } from "@/features/clients/queries";
import { createOrderWithItems } from "@/features/orders/service";
import { creeazaClient, creeazaComanda, trimiteComanda } from "./write-tools";
import { InvalidToolArgumentsError } from "./types";

afterEach(() => {
  vi.clearAllMocks();
});

describe("creeaza_client - validarea argumentelor propuse de model", () => {
  it("normalizeaza CUI-ul si pastreaza campurile optionale", () => {
    const input = creeazaClient.parse({
      cui: "RO 12345678",
      denumire: "  ACME SRL ",
      email: "contact@acme.ro",
      platitor_tva: true,
    });

    expect(input.cui).toBe("12345678");
    expect(input.denumire).toBe("ACME SRL");
    expect(input.email).toBe("contact@acme.ro");
    expect(input.reg_com).toBeNull();
    expect(input.platitor_tva).toBe(true);
  });

  it("refuza argumentele incomplete sau de tip gresit", () => {
    expect(() => creeazaClient.parse({ denumire: "ACME" })).toThrow(InvalidToolArgumentsError);
    expect(() => creeazaClient.parse({ cui: "123", denumire: "" })).toThrow(
      InvalidToolArgumentsError,
    );
    expect(() => creeazaClient.parse({ cui: "12345678", denumire: "ACME", email: 5 })).toThrow(
      InvalidToolArgumentsError,
    );
    expect(() => creeazaClient.parse("nu e obiect")).toThrow(InvalidToolArgumentsError);
  });

  it("produce un card generic cu boolean-ul platitor_tva editabil (nu text)", async () => {
    const input = creeazaClient.parse({
      cui: "12345678",
      denumire: "ACME SRL",
      platitor_tva: true,
    });

    expect(creeazaClient.summary?.(input)).toContain("ACME SRL");
    const presentation = await creeazaClient.presentation?.(input, {} as never);
    expect(presentation?.renderer).toBe("generic");
    if (presentation?.renderer !== "generic") throw new Error("unreachable");
    const cui = presentation.fields.find((f) => f.name === "cui");
    expect(cui?.editable).toBe(true);
    expect(cui?.kind).toBe("text");
    const vat = presentation.fields.find((f) => f.name === "platitor_tva");
    expect(vat?.kind).toBe("boolean");
    expect(vat?.value).toBe(true);
  });
});

describe("creeaza_comanda - validarea liniilor si adresa de livrare", () => {
  it("acceapta linii corecte, data in format ISO si adresa de livrare", () => {
    const input = creeazaComanda.parse({
      client_id: "c1",
      linii: [{ item_id: "i1", cantitate: 2 }],
      data_livrare: "2026-10-01",
      adresa_livrare_id: "addr-1",
    });

    expect(input.linii).toEqual([{ item_id: "i1", cantitate: 2 }]);
    expect(input.data_livrare).toBe("2026-10-01");
    expect(input.adresa_livrare_id).toBe("addr-1");
  });

  it("adresa de livrare e optionala", () => {
    const input = creeazaComanda.parse({
      client_id: "c1",
      linii: [{ item_id: "i1", cantitate: 1 }],
    });
    expect(input.adresa_livrare_id).toBeNull();
  });

  it("refuza comanda fara linii, cantitati invalide sau data gresita", () => {
    expect(() => creeazaComanda.parse({ client_id: "c1", linii: [] })).toThrow(
      InvalidToolArgumentsError,
    );
    expect(() =>
      creeazaComanda.parse({ client_id: "c1", linii: [{ item_id: "i1", cantitate: 0 }] }),
    ).toThrow(InvalidToolArgumentsError);
    expect(() =>
      creeazaComanda.parse({
        client_id: "c1",
        linii: [{ item_id: "i1", cantitate: 1 }],
        data_livrare: "01.10.2026",
      }),
    ).toThrow(InvalidToolArgumentsError);
  });

  it("schema JSON e stricta (additionalProperties:false, limite pe linii)", () => {
    const params = creeazaComanda.parameters as {
      additionalProperties: boolean;
      properties: { linii: { minItems: number; items: { additionalProperties: boolean } } };
    };
    expect(params.additionalProperties).toBe(false);
    expect(params.properties.linii.minItems).toBe(1);
    expect(params.properties.linii.items.additionalProperties).toBe(false);
  });

  it("presentation() incarca optiunile editorului (clienti/adrese/itemi) si mapeaza draftul din argumente", async () => {
    vi.mocked(listClients).mockResolvedValue([{ id: "c1", name: "ACME", cui: "1" } as never]);
    vi.mocked(listClientAddressesGrouped).mockResolvedValue({ c1: [] });
    vi.mocked(listSellableItemOptions).mockResolvedValue([]);

    const input = creeazaComanda.parse({
      client_id: "c1",
      linii: [{ item_id: "i1", cantitate: 2 }],
      adresa_livrare_id: "addr-1",
    });
    const presentation = await creeazaComanda.presentation?.(input, {} as never);

    expect(presentation?.renderer).toBe("order_draft");
    if (presentation?.renderer !== "order_draft") throw new Error("unreachable");
    expect(presentation.draft).toEqual({
      clientId: "c1",
      deliveryAddressId: "addr-1",
      deliveryDate: "",
      notes: "",
      lines: [{ itemId: "i1", quantity: 2 }],
    });
    expect(presentation.options.clients).toHaveLength(1);
  });

  it("execute() trece adresa de livrare la createOrderWithItems", async () => {
    vi.mocked(createOrderWithItems).mockResolvedValue({
      id: "o1",
      orderNumber: "CMD-1",
    } as never);

    const input = creeazaComanda.parse({
      client_id: "c1",
      linii: [{ item_id: "i1", cantitate: 2 }],
      adresa_livrare_id: "addr-1",
    });
    await creeazaComanda.execute(input, { organizationId: "org-1" } as never);

    expect(createOrderWithItems).toHaveBeenCalledWith(
      expect.objectContaining({ deliveryAddressId: "addr-1" }),
    );
  });
});

describe("trimite_comanda - rezolvarea etichetei comenzii (fara ID brut in UI)", () => {
  it("afiseaza numarul comenzii si clientul, camp needitabil", async () => {
    vi.mocked(getOrderDetail).mockResolvedValue({
      orderNumber: "CMD-2026-0002",
      clientName: "Client Demo SRL",
    } as never);

    const input = trimiteComanda.parse({ order_id: "o1" });
    const presentation = await trimiteComanda.presentation?.(input, {} as never);

    expect(presentation?.renderer).toBe("generic");
    if (presentation?.renderer !== "generic") throw new Error("unreachable");
    expect(presentation.fields).toEqual([
      {
        name: "order_id",
        label: "Comandă",
        displayValue: "CMD-2026-0002 · Client Demo SRL",
        editable: false,
        kind: "text",
      },
    ]);
  });
});
