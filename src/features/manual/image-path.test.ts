import { describe, expect, it } from "vitest";
import { MANUAL_IMAGE_DIR, resolveManualImagePath } from "./image-path";

describe("resolveManualImagePath", () => {
  it("rezolva o captura valida sub docs/manual/img", () => {
    expect(resolveManualImagePath(["admin-settings.png"])).toBe(
      `${MANUAL_IMAGE_DIR}/admin-settings.png`,
    );
  });

  it("respinge traversal, cai absolute si segmente codificate", () => {
    expect(resolveManualImagePath(["..", "..", ".env"])).toBeNull();
    expect(resolveManualImagePath(["../.env"])).toBeNull();
    expect(resolveManualImagePath(["/etc/passwd"])).toBeNull();
    expect(resolveManualImagePath(["%2e%2e", "x.png"])).toBeNull();
    expect(resolveManualImagePath(["img", "x.png"])).toBeNull();
  });

  it("respinge alte extensii si numele goale", () => {
    expect(resolveManualImagePath(["x.svg"])).toBeNull();
    expect(resolveManualImagePath(["admin-settings.png.txt"])).toBeNull();
    expect(resolveManualImagePath([])).toBeNull();
  });
});
