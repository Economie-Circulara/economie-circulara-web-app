import { describe, expect, it } from "vitest";
import { encodePolyline } from "./polyline";
import { buildStaticMapUrl } from "./static-map";

const ORIGIN = { lat: 47.1, lng: 27.5 };
const DESTINATION = { lat: 47.2, lng: 27.6 };

describe("buildStaticMapUrl", () => {
  it("include markerii de origine si destinatie", () => {
    const url = buildStaticMapUrl({
      origin: ORIGIN,
      destination: DESTINATION,
      routes: [{ polyline: "abc", recommended: true }],
      apiKey: "test-key",
    });

    expect(url).toContain("markers=color%3Agreen%7Clabel%3AA%7C47.1%2C27.5");
    expect(url).toContain("markers=color%3Ared%7Clabel%3AB%7C47.2%2C27.6");
    expect(url).toContain("key=test-key");
  });

  it("deseneaza ruta recomandata cu culoarea tenantului, dupa alternative (deasupra lor)", () => {
    const url = buildStaticMapUrl({
      origin: ORIGIN,
      destination: DESTINATION,
      routes: [
        { polyline: "alt1", recommended: false },
        { polyline: "best", recommended: true },
      ],
      apiKey: "test-key",
      recommendedColor: "#FF8800",
    });

    const paths = new URL(url).searchParams.getAll("path");
    expect(paths).toHaveLength(2);
    expect(paths[0]).toContain("enc:alt1");
    expect(paths[0]).toContain("color:0x9CA3AF");
    expect(paths[1]).toContain("enc:best");
    expect(paths[1]).toContain("color:0xFF8800");
  });

  it("foloseste o culoare implicita cand tenantul nu are una configurata sau e invalida", () => {
    const url = buildStaticMapUrl({
      origin: ORIGIN,
      destination: DESTINATION,
      routes: [{ polyline: "best", recommended: true }],
      apiKey: "test-key",
      recommendedColor: "not-a-color",
    });

    expect(new URL(url).searchParams.getAll("path")[0]).toContain("color:0x2563EB");
  });

  it("respecta dimensiunile implicite si pe cele custom", () => {
    const defaultUrl = buildStaticMapUrl({
      origin: ORIGIN,
      destination: DESTINATION,
      routes: [],
      apiKey: "k",
    });
    expect(new URL(defaultUrl).searchParams.get("size")).toEqual("640x400");

    const customUrl = buildStaticMapUrl({
      origin: ORIGIN,
      destination: DESTINATION,
      routes: [],
      apiKey: "k",
      width: 320,
      height: 200,
    });
    expect(new URL(customUrl).searchParams.get("size")).toEqual("320x200");
  });

  it("simplifica poliliniile lungi (rute reale) ca sa incapa sub limita Maps Static API", () => {
    // O ruta reala (Google Routes API) poate avea sute/mii de puncte - spre
    // deosebire de poliliniile mock (2-3 puncte) care nu s-au apropiat niciodata
    // de limita de 8192 caractere a Maps Static API.
    const longRoute = Array.from({ length: 5000 }, (_, i) => ({
      lat: ORIGIN.lat + i * 0.0001,
      lng: ORIGIN.lng + i * 0.0001,
    }));
    const longPolyline = encodePolyline(longRoute);
    expect(longPolyline.length).toBeGreaterThan(8000);

    const url = buildStaticMapUrl({
      origin: ORIGIN,
      destination: DESTINATION,
      routes: [
        { polyline: longPolyline, recommended: true },
        { polyline: longPolyline, recommended: false },
      ],
      apiKey: "test-key",
    });

    expect(url.length).toBeLessThanOrEqual(8000);
    // Traseul ramane intact la capete, doar simplificat pe drum.
    const [recommendedPath] = new URL(url).searchParams.getAll("path").slice(-1);
    expect(recommendedPath).toContain("enc:");
  });
});
