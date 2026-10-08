import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { RichNote } from "./rich-note";

describe("RichNote", () => {
  it("randeaza paragrafe, liste si text ingrosat", () => {
    const { container } = render(
      <RichNote text={"**Lucrare:** bloc P+4\nRitm 20 mc/h\n\n- planșeu\n- stâlpi"} />,
    );
    expect(screen.getByText("Lucrare:").tagName).toBe("STRONG");
    expect(container.querySelectorAll("br")).toHaveLength(1);
    expect(screen.getAllByRole("listitem").map((li) => li.textContent)).toEqual([
      "planșeu",
      "stâlpi",
    ]);
  });

  it("nu interpreteaza HTML din text", () => {
    const { container } = render(<RichNote text={"<b>nu</b> e markup"} />);
    expect(container.querySelector("b")).toBeNull();
    expect(container.textContent).toContain("<b>nu</b> e markup");
  });

  it("nu randeaza nimic pentru o nota goala", () => {
    const { container } = render(<RichNote text={"  "} />);
    expect(container).toBeEmptyDOMElement();
  });
});
