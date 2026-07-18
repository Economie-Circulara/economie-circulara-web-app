import { afterEach, describe, expect, it, vi } from "vitest";

// Mock (nu spy — AGENTS.md §2.2): inlocuim complet generarea certificatului.
const { generateCertificateForOrder } = vi.hoisted(() => ({
  generateCertificateForOrder: vi.fn(),
}));
vi.mock("@/features/certificates/service", () => ({ generateCertificateForOrder }));

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

afterEach(() => {
  vi.clearAllMocks();
});

describe("onOrderStatusChanged", () => {
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
});
