import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("@/features/clients/service", () => ({ createClientRecord: vi.fn() }));
vi.mock("@/features/clients/queries", () => ({ listClients: vi.fn().mockResolvedValue([]) }));
vi.mock("@/features/orders/queries", () => ({
  listClientAddressesGrouped: vi.fn().mockResolvedValue({}),
  listSellableItemOptions: vi.fn().mockResolvedValue([]),
  listIntakeItemOptions: vi.fn().mockResolvedValue([]),
  getOrderDetail: vi.fn(),
}));
vi.mock("@/features/orders/service", () => ({
  createOrderWithItems: vi.fn(),
  sendOrder: vi.fn(),
}));
vi.mock("@/features/deliveries/service", () => ({ planDelivery: vi.fn() }));
vi.mock("@/features/routing/route-service", () => ({ computeRouteBetween: vi.fn() }));
vi.mock("@/features/routing/site-queries", () => ({
  getDefaultSite: vi.fn().mockResolvedValue(null),
  getSiteById: vi.fn().mockResolvedValue(null),
}));

import {
  getOrderDetail,
  listClientAddressesGrouped,
  listIntakeItemOptions,
  listSellableItemOptions,
} from "@/features/orders/queries";
import { listClients } from "@/features/clients/queries";
import { createOrderWithItems } from "@/features/orders/service";
import { planDelivery } from "@/features/deliveries/service";
import { computeRouteBetween } from "@/features/routing/route-service";
import { getDefaultSite, getSiteById } from "@/features/routing/site-queries";
import { creeazaClient, creeazaComanda, planificaLivrare, trimiteComanda } from "./write-tools";
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
      // Fara `tip_comanda` in argumente -> `material` (compatibilitate cu apelurile
      // de dinaintea migrarii 0030, vezi DEFAULT_ORDER_TYPE).
      orderType: "material",
      clientId: "c1",
      deliveryAddressId: "addr-1",
      deliveryDate: "",
      expectedReturnDate: "",
      notes: "",
      lines: [{ itemId: "i1", quantity: 2 }],
    });
    expect(presentation.options.clients).toHaveLength(1);
  });

  it("presentation() trimite si catalogul de APORT, ca liniile nevandabile sa fie afisabile", async () => {
    // Regresie: pana acum cardul primea doar itemii vandabili, asa ca o comanda
    // `aport` cu un item nevandabil (ex. moloz - exista tocmai ca sa fie ADUS)
    // ajungea intr-un editor care nu-i stia denumirea si nu-l mai putea re-adauga.
    const moloz = {
      id: "i-moloz",
      title: "Moloz",
      unit: "tona",
      kind: "physical",
      isTracked: true,
    };
    vi.mocked(listClients).mockResolvedValue([]);
    vi.mocked(listClientAddressesGrouped).mockResolvedValue({});
    vi.mocked(listSellableItemOptions).mockResolvedValue([]);
    vi.mocked(listIntakeItemOptions).mockResolvedValue([moloz as never]);

    const input = creeazaComanda.parse({
      client_id: "c1",
      tip_comanda: "aport",
      linii: [{ item_id: "i-moloz", cantitate: 5 }],
    });
    const presentation = await creeazaComanda.presentation?.(input, {} as never);

    expect(presentation?.renderer).toBe("order_draft");
    if (presentation?.renderer !== "order_draft") throw new Error("unreachable");
    expect(presentation.draft.orderType).toBe("aport");
    expect(presentation.options.itemOptions).toEqual([]);
    expect(presentation.options.intakeItemOptions).toEqual([moloz]);
  });

  it("parse() acceptă tip_comanda explicit si respinge o valoare necunoscuta", () => {
    expect(
      creeazaComanda.parse({
        client_id: "c1",
        tip_comanda: "aport",
        linii: [{ item_id: "i1", cantitate: 2 }],
      }).tip_comanda,
    ).toBe("aport");

    expect(() =>
      creeazaComanda.parse({
        client_id: "c1",
        tip_comanda: "inchiriere",
        linii: [{ item_id: "i1", cantitate: 2 }],
      }),
    ).toThrow(/tip_comanda/);
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
      expect.objectContaining({ deliveryAddressId: "addr-1", orderType: "material" }),
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

describe("planifica_livrare - propunerea unei livrari pentru o comanda acceptata", () => {
  const ORDER = {
    id: "o1",
    orderNumber: "CMD-2026-0003",
    clientName: "Client Demo SRL",
    deliveryAddress: "Str. Livrării 10, București",
  };
  const SITE = {
    id: "site-1",
    name: "Stația Otopeni",
    address: "DN1 km 12, Otopeni",
    isDefault: true,
  };

  it("cere campurile obligatorii si valideaza formatul datei", () => {
    expect(() => planificaLivrare.parse({ order_id: "o1", data_programata: "2026-10-01" })).toThrow(
      InvalidToolArgumentsError,
    );
    expect(() =>
      planificaLivrare.parse({
        order_id: "o1",
        data_programata: "01.10.2026",
        transportator: "Transport SRL",
        nr_inmatriculare: "B 123 ABC",
        sofer: "Ion Pop",
      }),
    ).toThrow(/data_programata/);

    const input = planificaLivrare.parse({
      order_id: "o1",
      data_programata: "2026-10-01",
      transportator: " Transport SRL ",
      nr_inmatriculare: "B 123 ABC",
      sofer: "Ion Pop",
    });
    expect(input.transportator).toBe("Transport SRL");
    expect(input.punct_plecare_id).toBeNull();
    expect(input.punct_sosire).toBeNull();
  });

  it("presentation() completeaza plecarea cu statia implicita si sosirea cu adresa comenzii", async () => {
    vi.mocked(getOrderDetail).mockResolvedValue(ORDER as never);
    vi.mocked(getDefaultSite).mockResolvedValue(SITE as never);

    const input = planificaLivrare.parse({
      order_id: "o1",
      data_programata: "2026-10-01",
      transportator: "Transport SRL",
      nr_inmatriculare: "B 123 ABC",
      sofer: "Ion Pop",
    });
    const presentation = await planificaLivrare.presentation?.(input, {} as never);

    expect(presentation?.renderer).toBe("generic");
    if (presentation?.renderer !== "generic") throw new Error("unreachable");
    const byName = (name: string) => presentation.fields.find((field) => field.name === name);
    // Comanda ramane needitabila (ca la `trimite_comanda`), restul se poate corecta.
    expect(byName("order_id")?.editable).toBe(false);
    expect(byName("order_id")?.displayValue).toBe("CMD-2026-0003 · Client Demo SRL");
    expect(byName("punct_plecare")?.value).toBe("DN1 km 12, Otopeni");
    expect(byName("punct_sosire")?.value).toBe("Str. Livrării 10, București");
    expect(byName("statie_plecare")?.displayValue).toBe("Stația Otopeni");
  });

  it("execute() calculeaza ruta din statia aleasa si o salveaza pe livrare", async () => {
    vi.mocked(getOrderDetail).mockResolvedValue(ORDER as never);
    vi.mocked(getSiteById).mockResolvedValue(SITE as never);
    vi.mocked(computeRouteBetween).mockResolvedValue({
      routes: [
        { distanceMeters: 20000, durationSeconds: 1800, polyline: "abc", label: "Ruta 1" },
        { distanceMeters: 30000, durationSeconds: 2400, polyline: "def", label: "Ruta 2" },
      ],
      bestIndex: 0,
    } as never);
    vi.mocked(planDelivery).mockResolvedValue({
      id: "d1",
      scheduledDate: "2026-10-01",
      routeOrigin: "DN1 km 12, Otopeni",
      routeDestination: "Str. Livrării 10, București",
    } as never);

    const input = planificaLivrare.parse({
      order_id: "o1",
      data_programata: "2026-10-01",
      transportator: "Transport SRL",
      nr_inmatriculare: "B 123 ABC",
      sofer: "Ion Pop",
      punct_plecare_id: "site-1",
    });
    const result = await planificaLivrare.execute(input, {
      organizationId: "org-1",
      userId: "u1",
    } as never);

    expect(planDelivery).toHaveBeenCalledWith(
      expect.objectContaining({
        orderId: "o1",
        scheduledDate: "2026-10-01",
        carrierName: "Transport SRL",
        vehiclePlate: "B 123 ABC",
        driverName: "Ion Pop",
        routeOrigin: "DN1 km 12, Otopeni",
        routeDestination: "Str. Livrării 10, București",
        createdBy: "u1",
        route: expect.objectContaining({
          originSiteId: "site-1",
          distanceMeters: 20000,
          selectedIndex: 0,
          selection: "auto",
        }),
      }),
    );
    expect(result).toMatchObject({ livrare_id: "d1", ruta_calculata: true, distanta_km: 20 });
  });

  it("execute() planifica livrarea si daca furnizorul de rute esueaza (best-effort)", async () => {
    vi.mocked(getOrderDetail).mockResolvedValue(ORDER as never);
    vi.mocked(getSiteById).mockResolvedValue(SITE as never);
    vi.mocked(computeRouteBetween).mockRejectedValue(
      new Error("Planificarea rutelor nu este configurată (cheie API lipsă)."),
    );
    vi.mocked(planDelivery).mockResolvedValue({
      id: "d2",
      scheduledDate: "2026-10-01",
      routeOrigin: "DN1 km 12, Otopeni",
      routeDestination: "Str. Livrării 10, București",
    } as never);

    const input = planificaLivrare.parse({
      order_id: "o1",
      data_programata: "2026-10-01",
      transportator: "Transport SRL",
      nr_inmatriculare: "B 123 ABC",
      sofer: "Ion Pop",
      punct_plecare_id: "site-1",
    });
    const result = await planificaLivrare.execute(input, {
      organizationId: "org-1",
      userId: "u1",
    } as never);

    expect(planDelivery).toHaveBeenCalledWith(expect.objectContaining({ route: null }));
    expect(result).toMatchObject({ livrare_id: "d2", ruta_calculata: false });
    expect((result as { ruta_eroare: string }).ruta_eroare).toContain("cheie API");
  });
});
