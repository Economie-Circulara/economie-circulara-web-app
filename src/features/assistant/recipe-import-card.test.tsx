import { fireEvent, render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { ActionCard } from "./action-card";
import type { PendingAction } from "./types";

function action(): PendingAction {
  return {
    toolCallId: "call-1",
    tool: "importa_retete",
    toolVersion: 1,
    summary: "Importă 2 rețete",
    presentation: {
      renderer: "recipe_import",
      sourceLabel: "retete.pdf",
      recipes: [
        {
          sourceName: "Beton C20",
          itemId: "beton",
          direction: "compunere",
          included: true,
          components: [
            { sourceName: "nisip", itemId: "nisip", percentage: 70 },
            { sourceName: "bitum", itemId: null, percentage: 30 },
          ],
        },
        {
          sourceName: "Mortar",
          itemId: "mortar",
          direction: "compunere",
          included: false,
          components: [{ sourceName: "ciment", itemId: "ciment", percentage: 25 }],
        },
      ],
      itemOptions: [
        { id: "beton", title: "Beton C20", unit: "kg" },
        { id: "nisip", title: "Nisip", unit: "kg" },
        { id: "ciment", title: "Ciment", unit: "kg" },
        { id: "mortar", title: "Mortar", unit: "kg" },
      ],
      itemsWithRecipe: ["mortar"],
    },
  };
}

describe("ActionCard - randerul recipe_import", () => {
  it("blocheaza importul pana cand fiecare material e ales, apoi trimite totul structurat", () => {
    const onConfirm = vi.fn();
    render(<ActionCard action={action()} busy={false} onConfirm={onConfirm} onReject={vi.fn()} />);

    const button = screen.getByRole("button", { name: "Importă 1 rețetă" }) as HTMLButtonElement;
    expect(button.disabled).toBe(true);
    expect(screen.getByText(/În document: „bitum”/)).toBeTruthy();

    const first = screen.getByRole("region", { name: "Rețeta 1: Beton C20" });
    fireEvent.change(within(first).getByLabelText("Rețeta 1 - Materia primă 2"), {
      target: { value: "ciment" },
    });
    expect(button.disabled).toBe(false);

    fireEvent.click(button);
    expect(onConfirm).toHaveBeenCalledWith({
      retete: [
        {
          produs: "Beton C20",
          item_id: "beton",
          directie: "compunere",
          inclus: true,
          componente: [
            { nume: "nisip", item_id: "nisip", procent: 70 },
            { nume: "bitum", item_id: "ciment", procent: 30 },
          ],
        },
        {
          produs: "Mortar",
          item_id: "mortar",
          directie: "compunere",
          inclus: false,
          componente: [{ nume: "ciment", item_id: "ciment", procent: 25 }],
        },
      ],
    });
  });

  it("bifarea unui produs care are deja reteta blocheaza confirmarea, cu explicatie", () => {
    render(<ActionCard action={action()} busy={false} onConfirm={vi.fn()} onReject={vi.fn()} />);
    fireEvent.click(screen.getByLabelText("Importă „Mortar”"));
    expect(screen.getByText("Produsul are deja o rețetă - debifează-l.")).toBeTruthy();
    expect(
      (screen.getByRole("button", { name: "Importă 2 rețete" }) as HTMLButtonElement).disabled,
    ).toBe(true);
  });
});
