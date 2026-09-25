import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { ActionCard } from "./action-card";
import type { PendingAction } from "./types";

const action: PendingAction = {
  toolCallId: "call-1",
  tool: "creeaza_reteta",
  toolVersion: 1,
  summary: "Creează rețeta",
  presentation: {
    renderer: "recipe_draft",
    itemTitle: "Beton",
    itemUnit: "kg",
    draft: { direction: "compunere", components: [{ itemId: "nisip", percentage: 80 }] },
    componentOptions: [
      { id: "nisip", title: "Nisip", unit: "kg" },
      { id: "ciment", title: "Ciment", unit: "kg" },
    ],
  },
};

describe("ActionCard - randerul recipe_draft", () => {
  it("precompleteaza propunerea si trimite componentele editate ca array structurat", () => {
    const onConfirm = vi.fn();
    render(<ActionCard action={action} busy={false} onConfirm={onConfirm} onReject={vi.fn()} />);

    expect(screen.getByText("Beton (kg)")).toBeTruthy();
    expect(screen.getByText("Total 80%")).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: "Adaugă materie primă" }));
    fireEvent.change(screen.getByLabelText("Materia primă 2"), { target: { value: "ciment" } });
    fireEvent.change(screen.getByLabelText("Procent 2"), { target: { value: "20" } });
    expect(screen.getByText("Total 100%")).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: "Confirmă și execută" }));
    expect(onConfirm).toHaveBeenCalledWith({
      directie: "compunere",
      componente: [
        { item_id: "nisip", procent: 80 },
        { item_id: "ciment", procent: 20 },
      ],
    });
  });

  it("confirmarea e blocata cat timp un rand e incomplet", () => {
    render(<ActionCard action={action} busy={false} onConfirm={vi.fn()} onReject={vi.fn()} />);
    fireEvent.click(screen.getByRole("button", { name: "Adaugă materie primă" }));
    expect(
      (screen.getByRole("button", { name: "Confirmă și execută" }) as HTMLButtonElement).disabled,
    ).toBe(true);
  });
});
