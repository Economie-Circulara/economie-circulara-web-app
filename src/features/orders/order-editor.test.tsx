import { useState } from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { Client, ClientAddress } from "@/features/clients/types";
import type { ItemOption } from "@/features/items/types";
import { emptyOrderEditorValue, OrderEditor, type OrderEditorValue } from "./order-editor";

function client(overrides: Partial<Client> = {}): Client {
  return {
    id: "c1",
    name: "ACME SRL",
    cui: "111",
    regCom: null,
    isVatPayer: false,
    hqAddress: null,
    email: null,
    phone: null,
    contactPerson: null,
    isSupplier: false,
    notes: null,
    createdAt: "2026-01-01T00:00:00.000Z",
    ...overrides,
  };
}

function address(overrides: Partial<ClientAddress> = {}): ClientAddress {
  return {
    id: "a1",
    clientId: "c1",
    label: "Depozit",
    address: "Str. Exemplu 1",
    isDefault: true,
    createdAt: "2026-01-01T00:00:00.000Z",
    ...overrides,
  };
}

const CLIENTS: Client[] = [client(), client({ id: "c2", name: "Bravo SRL", cui: "222" })];
const ADDRESSES: Record<string, ClientAddress[]> = {
  c1: [address()],
  c2: [address({ id: "a2", clientId: "c2", label: "Șantier", address: "Str. Bravo 2" })],
};
const ITEMS: ItemOption[] = [
  { id: "i1", title: "Agregat reciclat", unit: "tona", kind: "physical" },
  { id: "i2", title: "Abonament", unit: "bucata", kind: "service" },
];

function Harness({
  initial = emptyOrderEditorValue(),
  onChangeSpy,
  nativeFormFields,
}: {
  initial?: OrderEditorValue;
  onChangeSpy?: (value: OrderEditorValue) => void;
  nativeFormFields?: boolean;
}) {
  const [value, setValue] = useState(initial);
  return (
    <OrderEditor
      clients={CLIENTS}
      addressesByClient={ADDRESSES}
      itemOptions={ITEMS}
      value={value}
      onChange={(next) => {
        setValue(next);
        onChangeSpy?.(next);
      }}
      nativeFormFields={nativeFormFields}
    />
  );
}

describe("OrderEditor", () => {
  it("adaugă o linie nouă în starea controlată", () => {
    render(<Harness />);

    fireEvent.change(screen.getByLabelText("Item"), { target: { value: "i1" } });
    fireEvent.change(screen.getByLabelText("Cantitate"), { target: { value: "3" } });
    fireEvent.click(screen.getByRole("button", { name: "Adaugă linie" }));

    expect(screen.getByText("Agregat reciclat")).toBeInTheDocument();
    expect(screen.getByText("3 tona")).toBeInTheDocument();
  });

  it("nu adaugă o linie cu cantitate invalidă sau item lipsă", () => {
    const onChangeSpy = vi.fn();
    render(<Harness onChangeSpy={onChangeSpy} />);

    fireEvent.change(screen.getByLabelText("Cantitate"), { target: { value: "0" } });
    fireEvent.click(screen.getByRole("button", { name: "Adaugă linie" }));

    expect(onChangeSpy).not.toHaveBeenCalled();
    expect(screen.getByText("Nicio linie adăugată încă.")).toBeInTheDocument();
  });

  it("șterge o linie existentă", () => {
    render(
      <Harness
        initial={{
          clientId: "",
          deliveryAddressId: "",
          deliveryDate: "",
          notes: "",
          lines: [{ key: "i1-1", itemId: "i1", quantity: 5 }],
        }}
      />,
    );

    expect(screen.getByText("Agregat reciclat")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Șterge linia" }));

    expect(screen.getByText("Nicio linie adăugată încă.")).toBeInTheDocument();
  });

  it("schimbarea clientului resetează adresa de livrare aleasă", () => {
    const onChangeSpy = vi.fn();
    render(
      <Harness
        initial={{
          clientId: "c1",
          deliveryAddressId: "a1",
          deliveryDate: "",
          notes: "",
          lines: [],
        }}
        onChangeSpy={onChangeSpy}
      />,
    );

    fireEvent.change(screen.getByLabelText("Client", { exact: false }), {
      target: { value: "c2" },
    });

    expect(onChangeSpy).toHaveBeenCalledWith(
      expect.objectContaining({ clientId: "c2", deliveryAddressId: "" }),
    );
    expect(screen.getByRole("option", { name: /Șantier/ })).toBeInTheDocument();
  });

  it("controalele native primesc name= doar cand nativeFormFields e true", () => {
    const { rerender } = render(<Harness nativeFormFields={false} />);
    expect(screen.getByLabelText("Client", { exact: false })).not.toHaveAttribute("name");

    rerender(<Harness nativeFormFields />);
    expect(screen.getByLabelText("Client", { exact: false })).toHaveAttribute("name", "client_id");
  });
});
