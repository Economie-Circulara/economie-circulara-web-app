import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { type ColumnDef } from "@tanstack/react-table";
import { describe, expect, it } from "vitest";
import { DataTable } from "./data-table";

type Row = { name: string; qty: number };

const columns: ColumnDef<Row>[] = [
  { accessorKey: "name", header: "Nume" },
  { accessorKey: "qty", header: "Cantitate" },
];

const data: Row[] = [
  { name: "Beton", qty: 30 },
  { name: "Argilă", qty: 10 },
  { name: "Nisip", qty: 20 },
];

function bodyRowNames() {
  const [, ...bodyRows] = screen.getAllByRole("row"); // prima e header
  return bodyRows.map((row) => within(row).getAllByRole("cell")[0].textContent);
}

describe("DataTable", () => {
  it("randeaza toate randurile", () => {
    render(<DataTable columns={columns} data={data} />);
    expect(bodyRowNames()).toEqual(["Beton", "Argilă", "Nisip"]);
  });

  it("afiseaza mesajul de gol cand nu exista date", () => {
    render(<DataTable columns={columns} data={[]} emptyMessage="Fara loturi" />);
    expect(screen.getByText("Fara loturi")).toBeInTheDocument();
  });

  it("sorteaza la click pe antetul coloanei", async () => {
    const user = userEvent.setup();
    render(<DataTable columns={columns} data={data} />);
    const header = screen.getByRole("button", { name: /Cantitate/ });

    // Coloana numerica: TanStack sorteaza descrescator la primul click.
    await user.click(header);
    expect(bodyRowNames()).toEqual(["Beton", "Nisip", "Argilă"]); // 30, 20, 10

    // Al doilea click inverseaza: crescator.
    await user.click(header);
    expect(bodyRowNames()).toEqual(["Argilă", "Nisip", "Beton"]); // 10, 20, 30
  });
});
