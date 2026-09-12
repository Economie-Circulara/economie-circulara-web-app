import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import Home from "./page";

describe("Home", () => {
  it("afiseaza titlul aplicatiei", () => {
    render(<Home />);
    expect(screen.getByRole("heading", { name: "Lateris Trace", level: 1 })).toBeInTheDocument();
  });

  it("duce spre autentificare, nu spre showcase (care e 404 in productie)", () => {
    render(<Home />);
    const links = screen.getAllByRole("link");
    expect(links.length).toBeGreaterThan(0);
    for (const link of links) {
      expect(link).toHaveAttribute("href", "/login");
    }
  });

  it("descrie capabilitatile platformei", () => {
    render(<Home />);
    expect(
      screen.getByRole("heading", { name: "Certificat de trasabilitate" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { name: "Livrări, avize și e-Transport" }),
    ).toBeInTheDocument();
  });
});
