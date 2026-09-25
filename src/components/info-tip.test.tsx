import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { InfoTip } from "./info-tip";

describe("InfoTip", () => {
  it("se deschide la click (merge si pe telefon) si se inchide cu Escape sau click in afara", () => {
    render(
      <div>
        <InfoTip label="Ce sunt creditele AI?">Explicația</InfoTip>
        <p>altceva</p>
      </div>,
    );
    const button = screen.getByRole("button", { name: "Ce sunt creditele AI?" });
    expect(screen.queryByRole("note")).toBeNull();

    fireEvent.click(button);
    expect(screen.getByRole("note").textContent).toBe("Explicația");
    expect(button.getAttribute("aria-expanded")).toBe("true");

    fireEvent.keyDown(document, { key: "Escape" });
    expect(screen.queryByRole("note")).toBeNull();

    fireEvent.click(button);
    fireEvent.pointerDown(screen.getByText("altceva"));
    expect(screen.queryByRole("note")).toBeNull();
  });
});
