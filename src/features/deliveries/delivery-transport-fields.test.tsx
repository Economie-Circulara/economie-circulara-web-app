import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { DeliveryTransportFields } from "./delivery-transport-fields";

describe("DeliveryTransportFields", () => {
  it("arata campurile lipsa ca necompletate si ofera completarea", () => {
    render(
      <DeliveryTransportFields
        carrierName={null}
        vehiclePlate={null}
        driverName="Ion"
        saveAction={vi.fn()}
      />,
    );
    expect(screen.getAllByText("necompletat")).toHaveLength(2);
    fireEvent.click(screen.getByRole("button", { name: "Completează transportul" }));
    expect(screen.getByLabelText("Șofer")).toHaveValue("Ion");
    expect(screen.getByRole("button", { name: "Salvează" })).toBeInTheDocument();
  });

  it("doar citire dupa declarare/receptie - fara buton", () => {
    render(<DeliveryTransportFields carrierName="Macon" vehiclePlate="IS 1" driverName="Ion" />);
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
    expect(screen.getByText("Macon")).toBeInTheDocument();
  });
});
