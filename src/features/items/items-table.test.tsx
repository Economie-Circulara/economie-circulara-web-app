import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { ItemsTable } from "./items-table";
import type { ItemListRow } from "./types";

function makeItem(overrides: Partial<ItemListRow> = {}): ItemListRow {
  return {
    id: "item-1",
    title: "Ciment CEM II",
    description: null,
    unit: "kg",
    kind: "physical",
    isTracked: true,
    sellable: true,
    imageUrl: null,
    createdAt: "2026-01-01T00:00:00Z",
    updatedAt: "2026-01-01T00:00:00Z",
    hasRecipe: false,
    archivedAt: null,
    ...overrides,
  };
}

describe("ItemsTable", () => {
  it("linkuieste materialele fizice catre /itemi/[id] si arata coloana de reteta", () => {
    render(<ItemsTable items={[makeItem()]} kind="physical" />);

    expect(screen.getByRole("link", { name: "Ciment CEM II" })).toHaveAttribute(
      "href",
      "/itemi/item-1",
    );
    expect(screen.getByText("Are rețetă")).toBeInTheDocument();
  });

  it("linkuieste abonamentele catre /abonamente/[id] si ascunde coloana de reteta", () => {
    render(
      <ItemsTable
        items={[makeItem({ id: "item-2", title: "Mentenanță lunară", kind: "service" })]}
        kind="service"
      />,
    );

    expect(screen.getByRole("link", { name: "Mentenanță lunară" })).toHaveAttribute(
      "href",
      "/abonamente/item-2",
    );
    expect(screen.queryByText("Are rețetă")).not.toBeInTheDocument();
  });

  it("arata starea goala specifica ecranului cand nu exista itemi", () => {
    render(<ItemsTable items={[]} kind="service" />);

    expect(screen.getByText("Niciun abonament în catalog")).toBeInTheDocument();
  });
});

describe("ItemsTable - arhivate", () => {
  it("afiseaza eticheta Arhivat doar pentru itemii arhivati", () => {
    render(
      <ItemsTable
        items={[
          makeItem({ id: "a", title: "Activ" }),
          makeItem({ id: "b", title: "Vechi", archivedAt: "2026-09-01T00:00:00Z" }),
        ]}
        kind="physical"
      />,
    );
    expect(screen.getAllByText("Arhivat")).toHaveLength(1);
  });
});
