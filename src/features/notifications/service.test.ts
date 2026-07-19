import { afterEach, describe, expect, it, vi } from "vitest";

// Mock (nu spy — AGENTS.md §2.2): inlocuim complet clientul admin Supabase.
const { createAdminClient } = vi.hoisted(() => ({ createAdminClient: vi.fn() }));
vi.mock("@/lib/supabase/admin", () => ({ createAdminClient }));

import {
  NotificationOrderNotFoundError,
  NotificationRecipientMissingError,
  sendOrderStatusNotification,
} from "./service";

interface ChainResult {
  data: unknown;
  error?: unknown;
}

/** Chain minimal `.from(table).select/insert/update().eq().order().limit().maybeSingle()/.single()`. */
function makeChain(result: ChainResult) {
  const resolved = { data: result.data ?? null, error: result.error ?? null };
  const chain: Record<string, ReturnType<typeof vi.fn>> = {};
  for (const method of ["select", "insert", "update", "eq", "order", "limit"]) {
    chain[method] = vi.fn(() => chain);
  }
  chain.maybeSingle = vi.fn(async () => resolved);
  chain.single = vi.fn(async () => resolved);
  return chain;
}

/** Client admin mock: fiecare `.from(table)` consuma pe rand din coada configurata pt. acel tabel. */
function makeAdmin(responses: Record<string, ChainResult[]>) {
  const queues = new Map(Object.entries(responses).map(([table, list]) => [table, [...list]]));
  const from = vi.fn((table: string) => {
    const queue = queues.get(table);
    const next = queue?.shift() ?? { data: null, error: null };
    return makeChain(next);
  });
  return { from };
}

const ORDER_ROW = {
  order_number: "CMD-2026-0007",
  clients: { name: "Apex SRL", email: "client@apex.ro" },
  organizations: {
    name: "Reciclare Prod SRL",
    email_from_name: "Reciclare Prod",
    email_from_address: "notificari@reciclare-prod.ro",
  },
};

const EVENT = {
  orderId: "order-1",
  organizationId: "org-1",
  clientId: "client-1",
  toStatus: "accepted" as const,
};

function mockProvider() {
  return { send: vi.fn().mockResolvedValue(undefined) };
}

afterEach(() => {
  vi.clearAllMocks();
});

describe("sendOrderStatusNotification", () => {
  it("nu face nimic pentru statusul 'draft' (nu se notifica niciodata)", async () => {
    const provider = mockProvider();

    const result = await sendOrderStatusNotification({ ...EVENT, toStatus: "draft" }, provider);

    expect(result).toBeNull();
    expect(createAdminClient).not.toHaveBeenCalled();
    expect(provider.send).not.toHaveBeenCalled();
  });

  it("randeaza template-ul, insereaza randul queued, trimite prin provider si marcheaza sent", async () => {
    const admin = makeAdmin({
      notifications: [
        { data: null }, // findAlreadySent: nimic trimis inca
        { data: { id: "notif-1", ...baseNotificationRow(), status: "queued" } }, // insert
        {
          data: {
            id: "notif-1",
            ...baseNotificationRow(),
            status: "sent",
            sent_at: "2026-07-18T00:00:00.000Z",
          },
        }, // update -> sent
      ],
      orders: [{ data: ORDER_ROW }],
    });
    createAdminClient.mockReturnValue(admin);
    const provider = mockProvider();

    const result = await sendOrderStatusNotification(EVENT, provider);

    expect(result).not.toBeNull();
    expect(result?.sent).toBe(true);
    expect(result?.notification.status).toBe("sent");
    expect(result?.notification.recipientEmail).toBe("client@apex.ro");

    expect(provider.send).toHaveBeenCalledWith(
      expect.objectContaining({
        to: "client@apex.ro",
        from: { name: "Reciclare Prod", address: "notificari@reciclare-prod.ro" },
        subject: expect.stringContaining("CMD-2026-0007"),
      }),
    );
  });

  it("marcheaza notificarea 'failed' daca providerul de email esueaza, fara sa arunce", async () => {
    const admin = makeAdmin({
      notifications: [
        { data: null },
        { data: { id: "notif-1", ...baseNotificationRow(), status: "queued" } },
        {
          data: {
            id: "notif-1",
            ...baseNotificationRow(),
            status: "failed",
            error: "provider jos",
          },
        },
      ],
      orders: [{ data: ORDER_ROW }],
    });
    createAdminClient.mockReturnValue(admin);
    const provider = { send: vi.fn().mockRejectedValue(new Error("provider jos")) };

    const result = await sendOrderStatusNotification(EVENT, provider);

    expect(result?.sent).toBe(false);
    expect(result?.notification.status).toBe("failed");
    expect(result?.notification.error).toBe("provider jos");
  });

  it("e idempotent: daca exista deja o notificare 'sent' pt. aceeasi comanda+tip, nu retrimite", async () => {
    const admin = makeAdmin({
      notifications: [{ data: { id: "notif-0", ...baseNotificationRow(), status: "sent" } }],
      orders: [{ data: ORDER_ROW }],
    });
    createAdminClient.mockReturnValue(admin);
    const provider = mockProvider();

    const result = await sendOrderStatusNotification(EVENT, provider);

    expect(result?.notification.id).toBe("notif-0");
    expect(result?.sent).toBe(true);
    expect(provider.send).not.toHaveBeenCalled();
    // Nu s-a mai facut un insert nou — un singur consum din coada "orders" nu are loc
    // (context-ul comenzii nu se mai incarca dupa ce gasim notificarea deja trimisa).
  });

  it("arunca NotificationRecipientMissingError daca clientul comenzii nu are email", async () => {
    const admin = makeAdmin({
      notifications: [{ data: null }],
      orders: [{ data: { ...ORDER_ROW, clients: { name: "Apex SRL", email: null } } }],
    });
    createAdminClient.mockReturnValue(admin);
    const provider = mockProvider();

    await expect(sendOrderStatusNotification(EVENT, provider)).rejects.toBeInstanceOf(
      NotificationRecipientMissingError,
    );
    expect(provider.send).not.toHaveBeenCalled();
  });

  it("arunca NotificationOrderNotFoundError daca comanda nu exista/nu e accesibila", async () => {
    const admin = makeAdmin({
      notifications: [{ data: null }],
      orders: [{ data: null }],
    });
    createAdminClient.mockReturnValue(admin);
    const provider = mockProvider();

    await expect(sendOrderStatusNotification(EVENT, provider)).rejects.toBeInstanceOf(
      NotificationOrderNotFoundError,
    );
  });
});

function baseNotificationRow() {
  return {
    organization_id: "org-1",
    recipient_email: "client@apex.ro",
    type: "order_accepted",
    subject: "Comanda CMD-2026-0007 a fost acceptată",
    body: "<p>...</p>",
    related_order_id: "order-1",
    error: null,
    created_at: "2026-07-18T00:00:00.000Z",
    sent_at: null,
  };
}
