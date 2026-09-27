import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { UserBubbleContent } from "./user-bubble-content";

const ID = "123e4567-e89b-12d3-a456-426614174000";

describe("UserBubbleContent", () => {
  it("numele atasamentului deschide fisierul, iconita il descarca", () => {
    render(<UserBubbleContent content={`Uite reteta\n📎 [retete.pdf](attachment:${ID})`} />);

    expect(screen.getByText("Uite reteta")).toBeTruthy();
    const open = screen.getByRole("link", { name: "retete.pdf" });
    expect(open.getAttribute("href")).toBe(`/asistent/atasamente/${ID}`);
    expect(open.getAttribute("target")).toBe("_blank");
    expect(screen.getByRole("link", { name: "Descarcă retete.pdf" }).getAttribute("href")).toBe(
      `/asistent/atasamente/${ID}?descarca=1`,
    );
  });

  it("fara atasamente afiseaza doar textul", () => {
    render(<UserBubbleContent content="salut" />);
    expect(screen.queryByRole("link")).toBeNull();
  });
});
