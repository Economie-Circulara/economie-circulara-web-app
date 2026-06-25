import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { StatusBadge, resolveStatus } from "./status-badge";

describe("resolveStatus", () => {
  it("mapeaza un status de comanda cunoscut", () => {
    expect(resolveStatus("order", "livrata")).toEqual({ label: "Livrată", variant: "ok" });
  });

  it("mapeaza o provenienta cunoscuta", () => {
    expect(resolveStatus("provenance", "reciclare")).toEqual({
      label: "Reciclare",
      variant: "ok",
    });
  });

  it("face fallback la neutral pentru status necunoscut, pastrand textul brut", () => {
    expect(resolveStatus("order", "ceva_nou")).toEqual({
      label: "ceva_nou",
      variant: "neutral",
    });
  });
});

describe("StatusBadge", () => {
  it("afiseaza eticheta in romana", () => {
    render(<StatusBadge group="order" status="anulata" />);
    expect(screen.getByText("Anulată")).toBeInTheDocument();
  });
});
