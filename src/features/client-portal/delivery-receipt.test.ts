import { afterEach, describe, expect, it, vi } from "vitest";

const { createClient } = vi.hoisted(() => ({ createClient: vi.fn() }));
vi.mock("@/lib/supabase/server", () => ({ createClient }));

import { confirmClientDeliveryReceipt } from "./delivery-receipt";

afterEach(() => {
  vi.clearAllMocks();
});

describe("confirmClientDeliveryReceipt", () => {
  it("apeleaza RPC-ul client_confirm_delivery_receipt", async () => {
    const rpc = vi.fn(() => Promise.resolve({ data: null, error: null }));
    createClient.mockResolvedValue({ rpc });

    await confirmClientDeliveryReceipt("order-1", "Maria Pop", null);

    expect(rpc).toHaveBeenCalledWith("client_confirm_delivery_receipt", {
      p_order_id: "order-1",
      p_received_by_name: "Maria Pop",
      p_notes: undefined,
    });
  });

  it("propaga mesajul RO al RPC-ului", async () => {
    const rpc = vi.fn(() =>
      Promise.resolve({ data: null, error: { message: "Recepția a fost deja confirmată." } }),
    );
    createClient.mockResolvedValue({ rpc });

    await expect(confirmClientDeliveryReceipt("order-1", "Maria", "x")).rejects.toThrow(
      "Recepția a fost deja confirmată.",
    );
  });
});
