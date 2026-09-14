import { describe, expect, it } from "vitest";
import { pickBestRouteIndex } from "./rank";

describe("pickBestRouteIndex", () => {
  it("intoarce -1 pentru o lista goala", () => {
    expect(pickBestRouteIndex([])).toEqual(-1);
  });

  it("intoarce singurul index disponibil pentru o singura ruta", () => {
    expect(pickBestRouteIndex([{ distanceMeters: 1000, durationSeconds: 600 }])).toEqual(0);
  });

  it("alege ruta cu durata cea mai mica, cand diferenta depaseste toleranta", () => {
    const routes = [
      { distanceMeters: 5000, durationSeconds: 900 },
      { distanceMeters: 6000, durationSeconds: 600 }, // cu 33% mai rapida
    ];
    expect(pickBestRouteIndex(routes)).toEqual(1);
  });

  it("la durate apropiate (in limita a 5%), alege distanta cea mai mica", () => {
    const routes = [
      { distanceMeters: 8000, durationSeconds: 620 },
      { distanceMeters: 7000, durationSeconds: 600 }, // 600*1.05 = 630 >= 620, deci egale
    ];
    expect(pickBestRouteIndex(routes)).toEqual(1);
  });

  it("in afara tolerantei de 5%, distanta mai mica NU castiga daca durata e mult mai mare", () => {
    const routes = [
      { distanceMeters: 4000, durationSeconds: 900 }, // 900 > 600*1.05
      { distanceMeters: 7000, durationSeconds: 600 },
    ];
    expect(pickBestRouteIndex(routes)).toEqual(1);
  });

  it("la egalitate completa, primul index castiga (stabil)", () => {
    const routes = [
      { distanceMeters: 5000, durationSeconds: 600 },
      { distanceMeters: 5000, durationSeconds: 600 },
    ];
    expect(pickBestRouteIndex(routes)).toEqual(0);
  });
});
