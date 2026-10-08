import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { OrderNoteCard } from "./order-note-card";

describe("OrderNoteCard", () => {
  it("arata nota formatata, fara buton de editare cand e doar citire", () => {
    render(<OrderNoteCard note={"**Lucrare:** bloc P+4\n- planșeu"} />);
    expect(screen.getByText("Lucrare:").tagName).toBe("STRONG");
    expect(screen.getByRole("listitem")).toHaveTextContent("planșeu");
    expect(screen.queryByRole("button", { name: /Editează|Adaugă notă/ })).not.toBeInTheDocument();
  });

  it("staff: „Adaugă notă” deschide formularul cu hint-ul de formatare", () => {
    render(<OrderNoteCard note={null} saveAction={vi.fn()} />);
    expect(screen.getByText("Nicio notă.")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Adaugă notă" }));

    expect(screen.getByRole("textbox", { name: "Notă de comandă" })).toHaveValue("");
    expect(screen.getByText(/Apare pe aviz și clientului/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Salvează" })).toBeInTheDocument();
  });

  it("staff: „Editează” precompleteaza nota existenta, „Renunță” revine la afisare", () => {
    render(<OrderNoteCard note="Ritm 20 mc/h" saveAction={vi.fn()} />);
    fireEvent.click(screen.getByRole("button", { name: "Editează" }));
    expect(screen.getByRole("textbox", { name: "Notă de comandă" })).toHaveValue("Ritm 20 mc/h");

    fireEvent.click(screen.getByRole("button", { name: "Renunță" }));
    expect(screen.queryByRole("textbox")).not.toBeInTheDocument();
    expect(screen.getByText("Ritm 20 mc/h")).toBeInTheDocument();
  });
});
