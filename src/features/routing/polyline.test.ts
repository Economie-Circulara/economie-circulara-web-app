import { describe, expect, it } from "vitest";
import { encodePolyline } from "./polyline";

describe("encodePolyline", () => {
  // Exemplul oficial din documentatia Google:
  // https://developers.google.com/maps/documentation/utilities/polylinealgorithm
  it("codifica exemplul oficial Google", () => {
    const points = [
      { lat: 38.5, lng: -120.2 },
      { lat: 40.7, lng: -120.95 },
      { lat: 43.252, lng: -126.453 },
    ];
    expect(encodePolyline(points)).toEqual("_p~iF~ps|U_ulLnnqC_mqNvxq`@");
  });

  it("intoarce sir gol pentru zero puncte", () => {
    expect(encodePolyline([])).toEqual("");
  });
});
