import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { logoShapeFromSize, OrgBrand } from "./org-brand";

/** Simuleaza incarcarea imaginii cu dimensiunile naturale date. */
function loadImage(img: HTMLImageElement, width: number, height: number) {
  Object.defineProperty(img, "naturalWidth", { value: width, configurable: true });
  Object.defineProperty(img, "naturalHeight", { value: height, configurable: true });
  fireEvent.load(img);
}

describe("logoShapeFromSize", () => {
  it("trateaza ca orizontal un logo de cel putin 2:1", () => {
    expect(logoShapeFromSize(1546, 405)).toBe("wide");
    expect(logoShapeFromSize(200, 100)).toBe("wide");
  });

  it("trateaza ca compact un logo patrat sau aproape patrat", () => {
    expect(logoShapeFromSize(1097, 784)).toBe("compact");
    expect(logoShapeFromSize(512, 512)).toBe("compact");
    expect(logoShapeFromSize(0, 0)).toBe("compact");
  });
});

describe("OrgBrand", () => {
  it("fara logo afiseaza numele si fallback-ul (initialele)", () => {
    const { container } = render(
      <OrgBrand name="Etora" variant="sidebar" fallback={<span>ET</span>} />,
    );

    expect(screen.getByText("Etora")).not.toHaveClass("sr-only");
    expect(screen.getByText("ET")).toBeInTheDocument();
    expect(container.querySelector("img")).toBeNull();
  });

  it("logo orizontal: logo-ul ocupa latimea, numele ramane doar pt. cititoare de ecran", () => {
    const { container } = render(
      <OrgBrand name="Etora" logoUrl="https://x/logo.png" variant="sidebar" />,
    );
    const img = container.querySelector("img")!;
    loadImage(img, 1546, 405);

    expect(img).toHaveAttribute("data-shape", "wide");
    expect(img).toHaveClass("max-w-full");
    expect(screen.getByText("Etora")).toHaveClass("sr-only");
  });

  it("logo compact: logo marit + numele scris langa el", () => {
    const { container } = render(
      <OrgBrand name="Macon XCX" logoUrl="https://x/logo.png" variant="sidebar" />,
    );
    const img = container.querySelector("img")!;
    loadImage(img, 1097, 784);

    expect(img).toHaveAttribute("data-shape", "compact");
    expect(img).toHaveClass("size-12");
    expect(screen.getByText("Macon XCX")).not.toHaveClass("sr-only");
  });

  it("pe login pastreaza numele ca heading, chiar si cand e ascuns vizual", () => {
    render(<OrgBrand name="Etora" logoUrl="https://x/logo.png" variant="login" nameAs="h1" />);

    expect(screen.getByRole("heading", { level: 1, name: "Etora" })).toBeInTheDocument();
  });
});
