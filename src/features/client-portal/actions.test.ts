import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { requireRole } = vi.hoisted(() => ({ requireRole: vi.fn() }));
vi.mock("@/features/auth/session", () => ({ requireRole }));

const { createOrderWithItems, sendOrder, deleteDraftOrder } = vi.hoisted(() => ({
  createOrderWithItems: vi.fn(),
  sendOrder: vi.fn(),
  deleteDraftOrder: vi.fn(),
}));
vi.mock("@/features/orders/service", () => ({
  createOrderWithItems,
  sendOrder,
  deleteDraftOrder,
}));

const { listCatalogItems } = vi.hoisted(() => ({ listCatalogItems: vi.fn() }));
vi.mock("./queries", () => ({ listCatalogItems }));

const { listIntakeItemOptions } = vi.hoisted(() => ({ listIntakeItemOptions: vi.fn() }));
vi.mock("@/features/orders/queries", () => ({ listIntakeItemOptions }));

const { confirmClientDeliveryReceipt } = vi.hoisted(() => ({
  confirmClientDeliveryReceipt: vi.fn(),
}));
vi.mock("./delivery-receipt", () => ({ confirmClientDeliveryReceipt }));

const { onOrderStatusChanged } = vi.hoisted(() => ({ onOrderStatusChanged: vi.fn() }));
vi.mock("@/features/orders/notifications", () => ({ onOrderStatusChanged }));

const { listClientAddresses } = vi.hoisted(() => ({ listClientAddresses: vi.fn() }));
vi.mock("@/features/clients/queries", () => ({ listClientAddresses }));

const { upsertAddress, removeAddress } = vi.hoisted(() => ({
  upsertAddress: vi.fn(),
  removeAddress: vi.fn(),
}));
vi.mock("@/features/clients/service", () => ({ upsertAddress, removeAddress }));

const { revalidatePath } = vi.hoisted(() => ({ revalidatePath: vi.fn() }));
vi.mock("next/cache", () => ({ revalidatePath }));

const { redirect } = vi.hoisted(() => ({
  redirect: vi.fn((path: string) => {
    throw new Error(`REDIRECT:${path}`);
  }),
}));
vi.mock("next/navigation", () => ({ redirect }));

import { initialClientOrderFormState, initialClientReceiptFormState } from "./action-state";
import {
  confirmOwnDeliveryReceiptAction,
  createClientAportAction,
  createClientOrderAction,
  deleteOwnAddressAction,
  deleteOwnDraftOrderAction,
  upsertOwnAddressAction,
} from "./actions";

beforeEach(() => {
  // Itemii folositi in teste sunt, implicit, disponibili (necatalogati -> vezi testele dedicate).
  const available = ["item-1", "item-2"].map((id) => ({ id }));
  listCatalogItems.mockResolvedValue(available);
  listIntakeItemOptions.mockResolvedValue(available);
  // Adresa folosita in teste e o adresa activa a clientului.
  listClientAddresses.mockResolvedValue([{ id: "addr-1" }]);
});

afterEach(() => {
  vi.clearAllMocks();
});

function formData(fields: Record<string, string | string[]>): FormData {
  const fd = new FormData();
  for (const [key, value] of Object.entries(fields)) {
    if (Array.isArray(value)) {
      for (const v of value) fd.append(key, v);
    } else {
      fd.set(key, value);
    }
  }
  return fd;
}

const CLIENT_USER = {
  id: "user-1",
  email: "client@example.com",
  role: "client" as const,
  organizationId: "org-1",
  clientId: "client-1",
  fullName: "Client demo",
};

describe("createClientOrderAction", () => {
  it("respinge un cos gol fara sa atinga serviciul de comenzi", async () => {
    requireRole.mockResolvedValue(CLIENT_USER);

    const state = await createClientOrderAction(initialClientOrderFormState, formData({}));

    expect(state.error).toMatch(/coșul/i);
    expect(createOrderWithItems).not.toHaveBeenCalled();
  });

  it("respinge un cont client fara clientId/organizationId asociat", async () => {
    requireRole.mockResolvedValue({ ...CLIENT_USER, clientId: null });

    const state = await createClientOrderAction(
      initialClientOrderFormState,
      formData({ item_id: "item-1", quantity: "2" }),
    );

    expect(state.error).toMatch(/firm/i);
    expect(createOrderWithItems).not.toHaveBeenCalled();
  });

  it("creeaza comanda draft cu created_by_admin=false apoi o trimite (draft -> sent)", async () => {
    requireRole.mockResolvedValue(CLIENT_USER);
    createOrderWithItems.mockResolvedValue({ id: "order-1", status: "draft" });
    sendOrder.mockResolvedValue({ id: "order-1", status: "sent" });

    const state = await createClientOrderAction(
      initialClientOrderFormState,
      formData({
        item_id: ["item-1", "item-2"],
        quantity: ["4", "2"],
        delivery_address_id: "addr-1",
        delivery_date: "2026-08-01",
        notes: "Livrare dimineața",
      }),
    );

    expect(createOrderWithItems).toHaveBeenCalledWith({
      organizationId: "org-1",
      clientId: "client-1",
      // Portalul clientului comanda din catalogul vandabil -> vanzare de material.
      orderType: "material",
      createdByAdmin: false,
      deliveryAddressId: "addr-1",
      deliveryDate: "2026-08-01",
      notes: "Livrare dimineața",
      lines: [
        { itemId: "item-1", quantity: 4 },
        { itemId: "item-2", quantity: 2 },
      ],
    });
    expect(sendOrder).toHaveBeenCalledWith("order-1", "org-1");
    expect(revalidatePath).toHaveBeenCalledWith("/comenzile-mele");
    expect(state).toEqual({ error: null, orderId: "order-1" });
  });

  it("ignora liniile incomplete (fara item sau cantitate invalida)", async () => {
    requireRole.mockResolvedValue(CLIENT_USER);
    createOrderWithItems.mockResolvedValue({ id: "order-1", status: "draft" });
    sendOrder.mockResolvedValue({ id: "order-1", status: "sent" });

    await createClientOrderAction(
      initialClientOrderFormState,
      formData({ item_id: ["item-1", ""], quantity: ["3", "0"] }),
    );

    expect(createOrderWithItems).toHaveBeenCalledWith(
      expect.objectContaining({ lines: [{ itemId: "item-1", quantity: 3 }] }),
    );
  });

  it("propaga eroarea daca createOrderWithItems esueaza (fara a incerca sendOrder)", async () => {
    requireRole.mockResolvedValue(CLIENT_USER);
    createOrderWithItems.mockRejectedValue(new Error("Nu am putut crea comanda."));

    const state = await createClientOrderAction(
      initialClientOrderFormState,
      formData({ item_id: "item-1", quantity: "1" }),
    );

    expect(state).toEqual({ error: "Nu am putut crea comanda.", orderId: null });
    expect(sendOrder).not.toHaveBeenCalled();
  });

  it("semnaleaza cand comanda a fost salvata dar trimiterea a esuat (ramane draft)", async () => {
    requireRole.mockResolvedValue(CLIENT_USER);
    createOrderWithItems.mockResolvedValue({ id: "order-1", status: "draft" });
    sendOrder.mockRejectedValue(new Error("Nu am putut genera numărul comenzii."));

    const state = await createClientOrderAction(
      initialClientOrderFormState,
      formData({ item_id: "item-1", quantity: "1" }),
    );

    expect(state.orderId).toBe("order-1");
    expect(state.error).toMatch(/salvată/i);
  });
});

describe("linii indisponibile (item arhivat / scos din catalog)", () => {
  it("comanda din catalog: respinge un item care nu mai e in catalog, fara sa creeze comanda", async () => {
    requireRole.mockResolvedValue(CLIENT_USER);

    const state = await createClientOrderAction(
      initialClientOrderFormState,
      formData({ item_id: ["item-1", "item-arhivat"], quantity: ["1", "2"] }),
    );

    expect(state.error).toMatch(/nu mai sunt disponibile/);
    expect(createOrderWithItems).not.toHaveBeenCalled();
  });

  it("aport: respinge un material care nu mai e in lista de aport (ex. arhivat)", async () => {
    requireRole.mockResolvedValue(CLIENT_USER);

    const state = await createClientAportAction(
      initialClientOrderFormState,
      formData({ item_id: "item-arhivat", quantity: "5" }),
    );

    expect(state.error).toMatch(/nu mai sunt disponibile/);
    expect(listIntakeItemOptions).toHaveBeenCalled();
    expect(createOrderWithItems).not.toHaveBeenCalled();
  });
});

describe("createClientAportAction", () => {
  it("respinge o cerere fara materiale fara sa atinga serviciul de comenzi", async () => {
    requireRole.mockResolvedValue(CLIENT_USER);

    const state = await createClientAportAction(initialClientOrderFormState, formData({}));

    expect(state.error).toMatch(/material/i);
    expect(createOrderWithItems).not.toHaveBeenCalled();
  });

  it("respinge un cont client fara clientId/organizationId asociat", async () => {
    requireRole.mockResolvedValue({ ...CLIENT_USER, clientId: null });

    const state = await createClientAportAction(
      initialClientOrderFormState,
      formData({ item_id: "item-1", quantity: "2" }),
    );

    expect(state.error).toMatch(/firm/i);
    expect(createOrderWithItems).not.toHaveBeenCalled();
  });

  it("creeaza comanda aport cu created_by_admin=false apoi o trimite (draft -> sent)", async () => {
    requireRole.mockResolvedValue(CLIENT_USER);
    createOrderWithItems.mockResolvedValue({ id: "order-2", status: "draft" });
    sendOrder.mockResolvedValue({ id: "order-2", status: "sent" });

    const state = await createClientAportAction(
      initialClientOrderFormState,
      formData({
        item_id: ["item-1"],
        quantity: ["500"],
        delivery_address_id: "addr-1",
        delivery_date: "2026-10-01",
        notes: "Moloz de demolare",
      }),
    );

    expect(createOrderWithItems).toHaveBeenCalledWith({
      organizationId: "org-1",
      clientId: "client-1",
      orderType: "aport",
      createdByAdmin: false,
      deliveryAddressId: "addr-1",
      deliveryDate: "2026-10-01",
      notes: "Moloz de demolare",
      lines: [{ itemId: "item-1", quantity: 500 }],
    });
    // Pentru client cererea e trimisa spre aprobare, nu ciorna (migrarea 0042).
    expect(sendOrder).toHaveBeenCalledWith("order-2", "org-1");
    expect(revalidatePath).toHaveBeenCalledWith("/comenzile-mele");
    expect(state).toEqual({ error: null, orderId: "order-2" });
  });

  it("suporta mai multe linii (materiale diferite)", async () => {
    requireRole.mockResolvedValue(CLIENT_USER);
    createOrderWithItems.mockResolvedValue({ id: "order-2", status: "draft" });

    await createClientAportAction(
      initialClientOrderFormState,
      formData({ item_id: ["item-1", "item-2"], quantity: ["500", "12"] }),
    );

    expect(createOrderWithItems).toHaveBeenCalledWith(
      expect.objectContaining({
        lines: [
          { itemId: "item-1", quantity: 500 },
          { itemId: "item-2", quantity: 12 },
        ],
      }),
    );
  });

  it("propaga eroarea daca createOrderWithItems esueaza", async () => {
    requireRole.mockResolvedValue(CLIENT_USER);
    createOrderWithItems.mockRejectedValue(new Error("Nu am putut crea comanda."));

    const state = await createClientAportAction(
      initialClientOrderFormState,
      formData({ item_id: "item-1", quantity: "1" }),
    );

    expect(state).toEqual({ error: "Nu am putut crea comanda.", orderId: null });
    expect(sendOrder).not.toHaveBeenCalled();
  });

  it("daca trimiterea esueaza, semnaleaza eroarea dar pastreaza orderId", async () => {
    requireRole.mockResolvedValue(CLIENT_USER);
    createOrderWithItems.mockResolvedValue({ id: "order-2", status: "draft" });
    sendOrder.mockRejectedValueOnce(new Error("numar indisponibil"));

    const state = await createClientAportAction(
      initialClientOrderFormState,
      formData({ item_id: "item-1", quantity: "1" }),
    );

    expect(state).toEqual({
      error: "Comanda a fost salvată, dar nu a putut fi trimisă: numar indisponibil",
      orderId: "order-2",
    });
  });
});

describe("deleteOwnDraftOrderAction (migrarea 0035)", () => {
  it("doar rolul client; la succes sterge ciorna si duce la /comenzile-mele", async () => {
    requireRole.mockResolvedValue({ id: "u-client", role: "client", clientId: "c1" });
    deleteDraftOrder.mockResolvedValue(undefined);

    await expect(deleteOwnDraftOrderAction("order-1")).rejects.toThrow("REDIRECT:/comenzile-mele");
    expect(requireRole).toHaveBeenCalledWith(["client"]);
    expect(deleteDraftOrder).toHaveBeenCalledWith("order-1");
    expect(revalidatePath).toHaveBeenCalledWith("/comenzile-mele");
  });

  it("comanda straina / non-ciorna: intoarce eroarea serviciului, fara redirect", async () => {
    requireRole.mockResolvedValue({ id: "u-client", role: "client", clientId: "c1" });
    deleteDraftOrder.mockRejectedValue(
      new Error('Doar o comandă în status "Ciornă" poate fi ștearsă.'),
    );

    const result = await deleteOwnDraftOrderAction("order-2");

    expect(result.error).toMatch(/Ciornă/);
    expect(redirect).not.toHaveBeenCalled();
  });

  it("id lipsa => eroare, fara apel la serviciu", async () => {
    requireRole.mockResolvedValue({ id: "u-client", role: "client", clientId: "c1" });
    const result = await deleteOwnDraftOrderAction("");
    expect(result.error).toMatch(/invalidă/);
    expect(deleteDraftOrder).not.toHaveBeenCalled();
  });
});

describe("confirmOwnDeliveryReceiptAction (migrarea 0045)", () => {
  it("cere numele persoanei, fara sa apeleze RPC-ul", async () => {
    requireRole.mockResolvedValue(CLIENT_USER);

    const state = await confirmOwnDeliveryReceiptAction(
      "order-1",
      initialClientReceiptFormState,
      formData({ received_by_name: "  " }),
    );

    expect(state.error).toMatch(/numele/i);
    expect(confirmClientDeliveryReceipt).not.toHaveBeenCalled();
  });

  it("confirma receptia prin RPC si trimite emailul 'Livrată'", async () => {
    requireRole.mockResolvedValue(CLIENT_USER);
    confirmClientDeliveryReceipt.mockResolvedValue(undefined);

    const state = await confirmOwnDeliveryReceiptAction(
      "order-1",
      initialClientReceiptFormState,
      formData({ received_by_name: " Maria Pop ", notes: "2 paleti deteriorati" }),
    );

    expect(requireRole).toHaveBeenCalledWith(["client"]);
    expect(confirmClientDeliveryReceipt).toHaveBeenCalledWith(
      "order-1",
      "Maria Pop",
      "2 paleti deteriorati",
    );
    expect(onOrderStatusChanged).toHaveBeenCalledWith({
      orderId: "order-1",
      organizationId: "org-1",
      clientId: "client-1",
      fromStatus: "accepted",
      toStatus: "delivered",
    });
    expect(revalidatePath).toHaveBeenCalledWith("/comenzile-mele/order-1");
    expect(state).toEqual({ error: null, done: true });
  });

  it("intoarce mesajul RPC-ului (ex. receptie deja confirmata), fara email", async () => {
    requireRole.mockResolvedValue(CLIENT_USER);
    confirmClientDeliveryReceipt.mockRejectedValueOnce(
      new Error("Recepția acestei livrări a fost deja confirmată."),
    );

    const state = await confirmOwnDeliveryReceiptAction(
      "order-1",
      initialClientReceiptFormState,
      formData({ received_by_name: "Maria Pop" }),
    );

    expect(state).toEqual({
      error: "Recepția acestei livrări a fost deja confirmată.",
      done: false,
    });
    expect(onOrderStatusChanged).not.toHaveBeenCalled();
  });

  it("o eroare la email nu anuleaza confirmarea deja salvata", async () => {
    requireRole.mockResolvedValue(CLIENT_USER);
    confirmClientDeliveryReceipt.mockResolvedValue(undefined);
    onOrderStatusChanged.mockRejectedValueOnce(new Error("smtp down"));
    const consoleError = vi.fn();
    vi.stubGlobal("console", { ...console, error: consoleError });

    const state = await confirmOwnDeliveryReceiptAction(
      "order-1",
      initialClientReceiptFormState,
      formData({ received_by_name: "Maria Pop" }),
    );

    vi.unstubAllGlobals();
    expect(state).toEqual({ error: null, done: true });
    expect(consoleError).toHaveBeenCalled();
  });
});

describe("adresa de livrare/aport din portal (0046)", () => {
  const LINE = { item_id: "item-1", quantity: "1" };

  it("respinge o adresa care nu e (sau nu mai e) a clientului, fara sa creeze comanda", async () => {
    requireRole.mockResolvedValue(CLIENT_USER);

    const state = await createClientOrderAction(
      initialClientOrderFormState,
      formData({ ...LINE, delivery_address_id: "addr-strain" }),
    );

    expect(listClientAddresses).toHaveBeenCalledWith("client-1");
    expect(state.error).toMatch(/nu mai este disponibilă/);
    expect(createOrderWithItems).not.toHaveBeenCalled();
  });

  it("adresa noua bifata 'Salvează' -> in agenda, apoi pe comanda", async () => {
    requireRole.mockResolvedValue(CLIENT_USER);
    upsertAddress.mockResolvedValue({ id: "addr-new" });
    createOrderWithItems.mockResolvedValue({ id: "order-1" });
    sendOrder.mockResolvedValue({ id: "order-1", status: "sent" });

    await createClientOrderAction(
      initialClientOrderFormState,
      formData({
        ...LINE,
        delivery_address_id: "__new__",
        new_address: " Str. Noua 5, Iași ",
        new_address_label: "Șantier",
        save_address: "on",
      }),
    );

    expect(upsertAddress).toHaveBeenCalledWith({
      clientId: "client-1",
      organizationId: "org-1",
      label: "Șantier",
      address: "Str. Noua 5, Iași",
      isDefault: false,
      adHoc: false,
    });
    expect(createOrderWithItems).toHaveBeenCalledWith(
      expect.objectContaining({ deliveryAddressId: "addr-new" }),
    );
  });

  it("adresa noua nebifata -> ad hoc (doar pe aceasta cerere de aport)", async () => {
    requireRole.mockResolvedValue(CLIENT_USER);
    upsertAddress.mockResolvedValue({ id: "addr-adhoc" });
    createOrderWithItems.mockResolvedValue({ id: "order-2" });
    sendOrder.mockResolvedValue({ id: "order-2", status: "sent" });

    await createClientAportAction(
      initialClientOrderFormState,
      formData({ ...LINE, delivery_address_id: "__new__", new_address: "Str. X 1" }),
    );

    expect(upsertAddress).toHaveBeenCalledWith(expect.objectContaining({ adHoc: true }));
    expect(createOrderWithItems).toHaveBeenCalledWith(
      expect.objectContaining({ orderType: "aport", deliveryAddressId: "addr-adhoc" }),
    );
  });

  it("adresa noua goala -> eroare, nimic creat", async () => {
    requireRole.mockResolvedValue(CLIENT_USER);

    const state = await createClientOrderAction(
      initialClientOrderFormState,
      formData({ ...LINE, delivery_address_id: "__new__", new_address: "  " }),
    );

    expect(state.error).toMatch(/adresa nouă/);
    expect(upsertAddress).not.toHaveBeenCalled();
    expect(createOrderWithItems).not.toHaveBeenCalled();
  });

  it("fara adresa aleasa -> comanda fara adresa, fara verificari suplimentare", async () => {
    requireRole.mockResolvedValue(CLIENT_USER);
    createOrderWithItems.mockResolvedValue({ id: "order-3" });
    sendOrder.mockResolvedValue({ id: "order-3", status: "sent" });

    await createClientOrderAction(initialClientOrderFormState, formData(LINE));

    expect(listClientAddresses).not.toHaveBeenCalled();
    expect(createOrderWithItems).toHaveBeenCalledWith(
      expect.objectContaining({ deliveryAddressId: null }),
    );
  });
});

describe("agenda de adrese a clientului (/adresele-mele, 0046)", () => {
  it("salveaza adresa pe firma din sesiune (ignora client_id din formular)", async () => {
    requireRole.mockResolvedValue(CLIENT_USER);
    upsertAddress.mockResolvedValue({ id: "addr-1" });

    const state = await upsertOwnAddressAction(
      { error: null },
      formData({ client_id: "alt-client", address: "Str. A 1", is_default: "on" }),
    );

    expect(requireRole).toHaveBeenCalledWith(["client"]);
    expect(upsertAddress).toHaveBeenCalledWith({
      id: undefined,
      clientId: "client-1",
      organizationId: "org-1",
      label: null,
      address: "Str. A 1",
      isDefault: true,
    });
    expect(revalidatePath).toHaveBeenCalledWith("/adresele-mele");
    expect(state.error).toBeNull();
  });

  it("adresa goala -> eroare", async () => {
    requireRole.mockResolvedValue(CLIENT_USER);
    const state = await upsertOwnAddressAction({ error: null }, formData({ address: " " }));
    expect(state.error).toMatch(/obligatorie/);
    expect(upsertAddress).not.toHaveBeenCalled();
  });

  it("stergerea trece prin removeAddress (arhivare daca e folosita pe comenzi)", async () => {
    requireRole.mockResolvedValue(CLIENT_USER);
    removeAddress.mockResolvedValue("archived");

    const state = await deleteOwnAddressAction({ error: null }, formData({ id: "addr-1" }));

    expect(removeAddress).toHaveBeenCalledWith("addr-1");
    expect(state.error).toBeNull();
  });
});
