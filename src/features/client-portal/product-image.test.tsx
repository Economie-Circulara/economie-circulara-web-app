import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { ProductImage } from "./product-image";

describe("ProductImage", () => {
  it("afiseaza poza cand itemul are imageUrl", () => {
    render(<ProductImage imageUrl="https://x.test/item-images/1/image?v=1" alt="Nisip" />);
    const img = screen.getByRole("img", { name: "Nisip" });
    expect(img).toHaveAttribute("src", "https://x.test/item-images/1/image?v=1");
    expect(screen.queryByText("foto produs")).not.toBeInTheDocument();
  });

  it("afiseaza placeholder-ul cand itemul nu are poza", () => {
    render(<ProductImage imageUrl={null} alt="Nisip" />);
    expect(screen.queryByRole("img")).not.toBeInTheDocument();
    expect(screen.getByText("foto produs")).toBeInTheDocument();
  });

  it("revine la placeholder daca poza nu se incarca", () => {
    render(<ProductImage imageUrl="https://x.test/lipsa.png" alt="Nisip" />);
    fireEvent.error(screen.getByRole("img", { name: "Nisip" }));
    expect(screen.queryByRole("img")).not.toBeInTheDocument();
    expect(screen.getByText("foto produs")).toBeInTheDocument();
  });
});
