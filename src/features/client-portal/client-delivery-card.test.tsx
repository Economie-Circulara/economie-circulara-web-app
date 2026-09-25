import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { ClientDeliveryCard } from "./client-delivery-card";
import type { ClientOrderDelivery } from "./types";

function delivery(overrides: Partial<ClientOrderDelivery> = {}): ClientOrderDelivery {
  return {
    scheduledDate: "2026-10-04",
    carrierName: "Fan Courier",
    vehiclePlate: "B33GRD",
    driverName: "Ionel Mihai",
    destination: "Iași, Strada Otilia Cazimir 1",
    uitCode: null,
    receivedAt: null,
    receivedByName: null,
    ...overrides,
  };
}

describe("ClientDeliveryCard", () => {
  it("afiseaza transportatorul, vehiculul, soferul si destinatia", () => {
    render(<ClientDeliveryCard delivery={delivery()} />);
    expect(screen.getByText("Fan Courier")).toBeInTheDocument();
    expect(screen.getByText("B33GRD")).toBeInTheDocument();
    expect(screen.getByText("Ionel Mihai")).toBeInTheDocument();
    expect(screen.getByText("Iași, Strada Otilia Cazimir 1")).toBeInTheDocument();
    expect(screen.getByText("neconfirmată")).toBeInTheDocument();
  });

  it("ascunde codul UIT cand livrarea nu e declarata", () => {
    render(<ClientDeliveryCard delivery={delivery()} />);
    expect(screen.queryByText(/Cod UIT/)).not.toBeInTheDocument();
  });

  it("afiseaza codul UIT si receptia confirmata", () => {
    render(
      <ClientDeliveryCard
        delivery={delivery({
          uitCode: "UIT123",
          receivedAt: "2026-10-04T10:00:00Z",
          receivedByName: "Maria Pop",
        })}
      />,
    );
    expect(screen.getByText("UIT123")).toBeInTheDocument();
    expect(screen.getByText(/confirmată de Maria Pop/)).toBeInTheDocument();
  });
});
