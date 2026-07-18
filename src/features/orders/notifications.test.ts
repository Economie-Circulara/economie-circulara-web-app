import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// Mocks (nu spies — AGENTS.md §2.2): inlocuim complet generarea certificatului si
// trimiterea notificarii — acest fisier testeaza doar ORCHESTRAREA hook-ului
// (ce se apeleaza, cu ce argumente, ca o eroare intr-un apel nu o blocheaza pe
// cealalta), nu logica interna a fiecarui serviciu (testata separat, colocat).
const { generateCertificateForOrder } = vi.hoisted(() => ({
  generateCertificateForOrder: vi.fn(),
}));
vi.mock("@/features/certificates/service", () => ({ generateCertificateForOrder }));

const { sendOrderStatusNotification } = vi.hoisted(() => ({
  sendOrderStatusNotification: vi.fn(),
}));
vi.mock("@/features/notifications/service", () => ({ sendOrderStatusNotification }));

import { onOrderStatusChanged } from "./notifications";

function silenceConsole<T>(fn: () => Promise<T>): Promise<T> {
  const originalInfo = console.info;
  const originalError = console.error;
  console.info = vi.fn();
  console.error = vi.fn();
  return fn().finally(() => {
    console.info = originalInfo;
    console.error = originalError;
  });
}

beforeEach(() => {
  sendOrderStatusNotification.mockResolvedValue({
    notification: { id: "notif-1", status: "sent" },
    sent: true,
  });
});

afterEach(() => {
  vi.clearAllMocks();
});

describe("onOrderStatusChanged", () => {
  it("trimite notificarea de email pentru fiecare tranzitie de status", async () => {
    await silenceConsole(() =>
      onOrderStatusChanged({
        orderId: "order-1",
        organizationId: "org-1",
        clientId: "client-1",
        fromStatus: "sent",
        toStatus: "accepted",
      }),
    );

    expect(sendOrderStatusNotification).toHaveBeenCalledWith({
      orderId: "order-1",
      organizationId: "org-1",
      clientId: "client-1",
      toStatus: "accepted",
    });
  });

  it("nu propaga eroarea daca trimiterea notificarii esueaza (tranzitia ramane sursa de adevar)", async () => {
    sendOrderStatusNotification.mockRejectedValue(new Error("provider jos"));

    await expect(
      silenceConsole(() =>
        onOrderStatusChanged({
          orderId: "order-1",
          organizationId: "org-1",
          clientId: "client-1",
          fromStatus: "sent",
          toStatus: "accepted",
        }),
      ),
    ).resolves.toBeUndefined();
  });

  it("nu declanseaza generarea certificatului pentru tranzitii care nu inchid comanda", async () => {
    await silenceConsole(() =>
      onOrderStatusChanged({
        orderId: "order-1",
        organizationId: "org-1",
        clientId: "client-1",
        fromStatus: "sent",
        toStatus: "accepted",
      }),
    );

    expect(generateCertificateForOrder).not.toHaveBeenCalled();
  });

  it("genereaza certificatul (idempotent — Task G) cand comanda ajunge in closed", async () => {
    generateCertificateForOrder.mockResolvedValue({ created: true });

    await silenceConsole(() =>
      onOrderStatusChanged({
        orderId: "order-1",
        organizationId: "org-1",
        clientId: "client-1",
        fromStatus: "delivered",
        toStatus: "closed",
      }),
    );

    expect(generateCertificateForOrder).toHaveBeenCalledWith("order-1");
  });

  it("nu propaga eroarea daca generarea certificatului esueaza (statusul comenzii ramane sursa de adevar)", async () => {
    generateCertificateForOrder.mockRejectedValue(new Error("boom"));

    await expect(
      silenceConsole(() =>
        onOrderStatusChanged({
          orderId: "order-1",
          organizationId: "org-1",
          clientId: "client-1",
          fromStatus: "delivered",
          toStatus: "closed",
        }),
      ),
    ).resolves.toBeUndefined();
  });

  it("la inchiderea comenzii apeleaza ATAT notificarea CAT SI generarea certificatului (Task X1 + Task G)", async () => {
    generateCertificateForOrder.mockResolvedValue({ created: true });

    await silenceConsole(() =>
      onOrderStatusChanged({
        orderId: "order-1",
        organizationId: "org-1",
        clientId: "client-1",
        fromStatus: "delivered",
        toStatus: "closed",
      }),
    );

    expect(sendOrderStatusNotification).toHaveBeenCalledWith({
      orderId: "order-1",
      organizationId: "org-1",
      clientId: "client-1",
      toStatus: "closed",
    });
    expect(generateCertificateForOrder).toHaveBeenCalledWith("order-1");
  });
});
