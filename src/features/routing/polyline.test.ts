import { describe, expect, it } from "vitest";
import { decodePolyline, encodePolyline } from "./polyline";

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

describe("decodePolyline", () => {
  it("decodifica exemplul oficial Google", () => {
    const points = decodePolyline("_p~iF~ps|U_ulLnnqC_mqNvxq`@");
    expect(points).toEqual([
      { lat: 38.5, lng: -120.2 },
      { lat: 40.7, lng: -120.95 },
      { lat: 43.252, lng: -126.453 },
    ]);
  });

  it("este inversul lui encodePolyline pentru puncte oarecare", () => {
    const points = [
      { lat: 47.1585, lng: 27.6014 },
      { lat: 47.2, lng: 27.65 },
    ];
    expect(decodePolyline(encodePolyline(points))).toEqual(points);
  });

  it("intoarce lista goala pentru sir gol", () => {
    expect(decodePolyline("")).toEqual([]);
  });
});
