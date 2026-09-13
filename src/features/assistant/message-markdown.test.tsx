import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { MessageMarkdown } from "./message-markdown";

describe("MessageMarkdown", () => {
  it("randeaza aldin, liste si tabele GFM", () => {
    const markdown = [
      "**Comanda ta** e gata.",
      "",
      "- primul pas",
      "- al doilea pas",
      "",
      "| Item | Cantitate |",
      "| --- | --- |",
      "| Agregat | 12 |",
    ].join("\n");

    render(<MessageMarkdown content={markdown} />);

    expect(screen.getByText("Comanda ta").tagName).toBe("STRONG");
    expect(screen.getByText("primul pas")).toBeInTheDocument();
    expect(screen.getByRole("table")).toBeInTheDocument();
    expect(screen.getByRole("columnheader", { name: "Item" })).toBeInTheDocument();
  });

  it("randeaza un link intern cu next/link", () => {
    render(<MessageMarkdown content="Vezi [comanda](/comenzi/abc-123)." />);

    expect(screen.getByRole("link", { name: "comanda" })).toHaveAttribute(
      "href",
      "/comenzi/abc-123",
    );
  });

  it("randeaza un link extern cu target blank", () => {
    render(<MessageMarkdown content="Vezi [ANAF](https://anaf.ro)." />);

    const link = screen.getByRole("link", { name: "ANAF" });
    expect(link).toHaveAttribute("href", "https://anaf.ro");
    expect(link).toHaveAttribute("target", "_blank");
    expect(link).toHaveAttribute("rel", "noreferrer");
  });

  it("nu randeaza ca link o adresa relativa fara slash", () => {
    render(<MessageMarkdown content="Fisier [readme](readme.md)." />);

    expect(screen.queryByRole("link", { name: "readme" })).toBeNull();
    expect(screen.getByText((text) => text.includes("readme"))).toBeInTheDocument();
  });

  it("nu randeaza imagini", () => {
    render(<MessageMarkdown content="![captura](https://example.com/img.png)" />);

    expect(screen.queryByRole("img")).toBeNull();
  });

  it("nu randeaza HTML brut - fara rehype-raw", () => {
    render(<MessageMarkdown content="<script>window.__pwned = true;</script>" />);

    expect(document.querySelector("script")).toBeNull();
    expect(screen.getByText(/window.__pwned/)).toBeInTheDocument();
  });
});
