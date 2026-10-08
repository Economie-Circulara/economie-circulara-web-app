import { describe, expect, it } from "vitest";
import { avizObservationLines, avizScheduleText, avizUitStatusText } from "./pdf";

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

describe("avizScheduleText", () => {
  it("adauga ora langa data cand exista", () => {
    expect(avizScheduleText({ scheduledDate: "2026-10-12", scheduledTime: "08:30" })).toMatch(
      /2026, ora 08:30$/,
    );
  });

  it("arata doar data cand ora lipseste", () => {
    expect(avizScheduleText({ scheduledDate: "2026-10-12", scheduledTime: null })).not.toContain(
      "ora",
    );
  });
});

describe("avizObservationLines", () => {
  it("preia observatiile comenzii, pomparea si observatiile livrarii, in aceasta ordine", () => {
    expect(
      avizObservationLines({
        orderNotes: "Planșeu etaj 2, ritm 20 mc/h",
        pumping: "Pompă furnizor 36 m",
        notes: "Recepție: Ion Pop, 0722 000 000",
      }),
    ).toEqual([
      { label: "Comandă", text: "Planșeu etaj 2, ritm 20 mc/h" },
      { label: "Pompare", text: "Pompă furnizor 36 m" },
      { label: "Livrare", text: "Recepție: Ion Pop, 0722 000 000" },
    ]);
  });

  it("omite campurile goale - fara observatii, sectiunea nu apare", () => {
    expect(avizObservationLines({ orderNotes: "  ", pumping: null, notes: "" })).toEqual([]);
    expect(
      avizObservationLines({ orderNotes: null, pumping: "Pompă beneficiar", notes: null }),
    ).toEqual([{ label: "Pompare", text: "Pompă beneficiar" }]);
  });
});
