import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import type { ClientAddress } from "@/features/clients/types";
import { DeliveryAddressField, NEW_ADDRESS_OPTION } from "./delivery-address-field";

function address(overrides: Partial<ClientAddress> = {}): ClientAddress {
  return {
    id: "a1",
    clientId: "c1",
    label: null,
    address: "Str. A 1",
    isDefault: false,
    createdAt: "2026-09-01T00:00:00Z",
    ...overrides,
  };
}

describe("DeliveryAddressField", () => {
  it("preselecteaza adresa implicita", () => {
    render(
      <DeliveryAddressField
        addresses={[address(), address({ id: "a2", address: "Str. B 2", isDefault: true })]}
      />,
    );
    expect(screen.getByLabelText("Adresă livrare")).toHaveValue("a2");
  });

  it("fara adrese: optiunea goala si '+ Adresă nouă…'", () => {
    render(<DeliveryAddressField addresses={[]} />);
    expect(screen.getByLabelText("Adresă livrare")).toHaveValue("");
    expect(screen.getByRole("option", { name: "+ Adresă nouă…" })).toBeInTheDocument();
  });

  it("'+ Adresă nouă…' deschide campurile adresei noi, cu 'Salvează' bifat implicit", () => {
    render(<DeliveryAddressField addresses={[address()]} />);
    expect(screen.queryByLabelText(/Adresa nouă/)).not.toBeInTheDocument();

    fireEvent.change(screen.getByLabelText("Adresă livrare"), {
      target: { value: NEW_ADDRESS_OPTION },
    });

    expect(screen.getByLabelText(/Adresa nouă/)).toBeInTheDocument();
    expect(screen.getByLabelText("Salvează în adresele mele")).toBeChecked();
  });
});
