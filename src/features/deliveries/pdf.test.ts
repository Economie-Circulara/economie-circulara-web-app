import { describe, expect, it } from "vitest";
import { avizUitStatusText } from "./pdf";

describe("avizUitStatusText", () => {
  it("arata codul UIT cand livrarea e declarata", () => {
    expect(
      avizUitStatusText({
        declarationStatus: "declared",
        uitCode: "UIT-123",
        declarationError: null,
      }),
    ).toEqual("UIT-123");
  });

  it("arata mesajul de eroare cand ultima declarare a esuat", () => {
    expect(
      avizUitStatusText({
        declarationStatus: "failed",
        uitCode: null,
        declarationError: "Socrate.io indisponibil",
      }),
    ).toEqual("Eroare declarare: Socrate.io indisponibil");
  });

  it("arata un mesaj implicit cand livrarea nu e inca declarata", () => {
    expect(
      avizUitStatusText({
        declarationStatus: "not_declared",
        uitCode: null,
        declarationError: null,
      }),
    ).toEqual("Nedeclarat încă");
  });
});
