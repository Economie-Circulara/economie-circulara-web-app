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
  { id: "i1", title: "Agregat reciclat", unit: "tona", kind: "physical", isTracked: true },
  { id: "i2", title: "Abonament", unit: "bucata", kind: "service", isTracked: true },
];
/** Itemi fizici nevandabili - oferiti doar pe comenzile de tip `aport` (migrarea 0030). */
const INTAKE_ITEMS: ItemOption[] = [
  { id: "i9", title: "Moloz demolare", unit: "tona", kind: "physical", isTracked: true },
];

/**
 * Majoritatea testelor verifica liniile/adresele, nu selectorul de tip - pornesc
 * deci de la un draft cu tipul deja ales (`material`), fiindca fara tip catalogul
 * de itemi e dezactivat (comportament testat separat mai jos).
 */
function draftValue(overrides: Partial<OrderEditorValue> = {}): OrderEditorValue {
  return { ...emptyOrderEditorValue(), orderType: "material", ...overrides };
}

function Harness({
  initial = draftValue(),
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
      intakeItemOptions={INTAKE_ITEMS}
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
      <Harness initial={draftValue({ lines: [{ key: "i1-1", itemId: "i1", quantity: 5 }] })} />,
    );

    expect(screen.getByText("Agregat reciclat")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Șterge linia" }));

    expect(screen.getByText("Nicio linie adăugată încă.")).toBeInTheDocument();
  });

  it("schimbarea clientului resetează adresa de livrare aleasă", () => {
    const onChangeSpy = vi.fn();
    render(
      <Harness
        initial={draftValue({ clientId: "c1", deliveryAddressId: "a1" })}
        onChangeSpy={onChangeSpy}
      />,
    );

    // `/^Client/` (nu `exact: false`): descrierile tipurilor de comandă conțin și
    // ele cuvântul "client", deci o potrivire pe substring ar prinde și radiourile.
    fireEvent.change(screen.getByLabelText(/^Client/), {
      target: { value: "c2" },
    });

    expect(onChangeSpy).toHaveBeenCalledWith(
      expect.objectContaining({ clientId: "c2", deliveryAddressId: "" }),
    );
    expect(screen.getByRole("option", { name: /Șantier/ })).toBeInTheDocument();
  });

  it("fără tip ales, catalogul de itemi e dezactivat", () => {
    render(<Harness initial={emptyOrderEditorValue()} />);

    expect(screen.getByLabelText("Item")).toBeDisabled();
    expect(screen.getByRole("option", { name: /Alege întâi tipul comenzii/ })).toBeInTheDocument();
  });

  it("tipul `aport` oferă itemii fizici de intrare, nu catalogul vandabil", () => {
    render(<Harness initial={emptyOrderEditorValue()} />);

    fireEvent.click(screen.getByRole("radio", { name: /Aport/ }));

    expect(screen.getByRole("option", { name: /Moloz demolare/ })).toBeInTheDocument();
    expect(screen.queryByRole("option", { name: /Agregat reciclat/ })).not.toBeInTheDocument();
  });

  it("schimbarea sensului comenzii (material -> aport) golește liniile deja adăugate", () => {
    const onChangeSpy = vi.fn();
    render(
      <Harness
        initial={draftValue({ lines: [{ key: "i1-1", itemId: "i1", quantity: 5 }] })}
        onChangeSpy={onChangeSpy}
      />,
    );

    fireEvent.click(screen.getByRole("radio", { name: /Aport/ }));

    expect(onChangeSpy).toHaveBeenCalledWith(
      expect.objectContaining({ orderType: "aport", lines: [] }),
    );
  });

  it("data de retur estimat apare doar pentru tipul `serviciu`", () => {
    render(<Harness initial={draftValue()} />);
    expect(screen.queryByLabelText("Retur estimat")).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("radio", { name: /Serviciu/ }));
    expect(screen.getByLabelText("Retur estimat")).toBeInTheDocument();
  });

  it("controalele native primesc name= doar cand nativeFormFields e true", () => {
    const { rerender } = render(<Harness nativeFormFields={false} />);
    expect(screen.getByLabelText(/^Client/)).not.toHaveAttribute("name");

    rerender(<Harness nativeFormFields />);
    expect(screen.getByLabelText(/^Client/)).toHaveAttribute("name", "client_id");
  });
});
