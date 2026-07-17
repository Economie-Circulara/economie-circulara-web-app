import { describe, expect, it, vi } from "vitest";
import { onOrderStatusChanged } from "./notifications";

describe("onOrderStatusChanged", () => {
  it("nu arunca (implementare goala/log — Task X1 va inlocui corpul)", async () => {
    // Mock direct (nu spy — vezi AGENTS.md §2.2), doar ca sa nu polueze output-ul testelor.
    const originalInfo = console.info;
    console.info = vi.fn();

    try {
      await expect(
        onOrderStatusChanged({
          orderId: "order-1",
          organizationId: "org-1",
          clientId: "client-1",
          fromStatus: "sent",
          toStatus: "accepted",
        }),
      ).resolves.toBeUndefined();
    } finally {
      console.info = originalInfo;
    }
  });
});
