import { describe, expect, it } from "vitest";
import type { OrderStatus } from "@/features/orders/types";
import { notificationTypeForOrderStatus, renderOrderStatusEmail } from "./templates";

const DATA = {
  orderNumber: "CMD-2026-0007",
  clientName: "Apex SRL",
  organizationName: "Reciclare Prod SRL",
};

describe("notificationTypeForOrderStatus", () => {
  it("mapeaza fiecare status notificabil la tipul de notificare corespunzator", () => {
    expect(notificationTypeForOrderStatus("sent")).toBe("order_sent");
    expect(notificationTypeForOrderStatus("accepted")).toBe("order_accepted");
    expect(notificationTypeForOrderStatus("delivered")).toBe("order_delivered");
    expect(notificationTypeForOrderStatus("closed")).toBe("order_closed");
    expect(notificationTypeForOrderStatus("cancelled")).toBe("order_cancelled");
  });

  it("intoarce null pentru 'draft' (status intern, niciodata notificat)", () => {
    expect(notificationTypeForOrderStatus("draft")).toBeNull();
  });
});

describe("renderOrderStatusEmail", () => {
  const statuses: OrderStatus[] = ["sent", "accepted", "delivered", "closed", "cancelled"];

  it.each(statuses)("randeaza subject/html/text nevide pentru statusul '%s'", (status) => {
    const rendered = renderOrderStatusEmail(DATA, status);

    expect(rendered.subject.length).toBeGreaterThan(0);
    expect(rendered.subject).toContain(DATA.orderNumber);
    expect(rendered.html).toContain(DATA.clientName);
    expect(rendered.html).toContain(DATA.organizationName);
    expect(rendered.text).toContain(DATA.clientName);
    expect(rendered.text).toContain(DATA.organizationName);
  });

  it("mentioneaza certificatul de trasabilitate la inchiderea comenzii", () => {
    const rendered = renderOrderStatusEmail(DATA, "closed");
    expect(rendered.text.toLowerCase()).toContain("certificat");
  });

  it("foloseste un text de rezerva cand comanda nu are numar alocat", () => {
    const rendered = renderOrderStatusEmail({ ...DATA, orderNumber: null }, "sent");
    expect(rendered.subject).not.toContain("null");
  });

  it("escapeaza HTML din numele clientului (nu injecteaza markup neasteptat)", () => {
    const rendered = renderOrderStatusEmail(
      { ...DATA, clientName: '<script>alert("x")</script>' },
      "sent",
    );
    expect(rendered.html).not.toContain("<script>");
  });

  it("arunca pentru statusul 'draft' (nu are template — nu ar trebui apelat niciodata)", () => {
    expect(() => renderOrderStatusEmail(DATA, "draft")).toThrow();
  });
});
