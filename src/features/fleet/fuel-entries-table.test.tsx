import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { FuelEntriesTable } from "./fuel-entries-table";
import type { FuelEntry } from "./types";

const ENTRY: FuelEntry = {
  id: "f1",
  vehicleId: "v1",
  vehicleName: "Basculanta 1",
  vehiclePlate: "IS-12-ABC",
  filledOn: "2026-10-12",
  liters: 80,
  amount: 600,
  odometerKm: 120500,
  station: "OMV Iași",
  notes: null,
  receipt: { path: "org/x.jpg", fileName: "x.jpg", mimeType: "image/jpeg" },
  createdAt: "2026-10-12T10:00:00Z",
  updatedAt: "2026-10-12T10:00:00Z",
};

describe("FuelEntriesTable", () => {
  it("arata data, vehiculul, pretul pe litru si linkul catre bon", () => {
    render(<FuelEntriesTable entries={[ENTRY]} />);
    expect(screen.getByRole("link", { name: "12.10.2026" })).toHaveAttribute(
      "href",
      "/flota/alimentari/f1",
    );
    expect(screen.getByText("Basculanta 1 (IS-12-ABC)")).toBeInTheDocument();
    expect(screen.getByText("7,50 lei")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Vezi" })).toHaveAttribute(
      "href",
      "/flota/alimentari/f1/bon",
    );
  });

  it("fara coloana de vehicul pe pagina vehiculului; stare goala", () => {
    const { rerender } = render(<FuelEntriesTable entries={[ENTRY]} showVehicle={false} />);
    expect(screen.queryByText("Basculanta 1 (IS-12-ABC)")).not.toBeInTheDocument();
    rerender(<FuelEntriesTable entries={[]} />);
    expect(screen.getByText("Nicio alimentare")).toBeInTheDocument();
  });
});
