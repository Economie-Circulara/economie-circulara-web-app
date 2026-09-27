import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { DEFAULT_THEME, THEMES, THEME_KEYS, isThemeKey, resolveThemeKey } from "./themes";

const APP_DIR = path.join(process.cwd(), "src", "app");
const themesCss = readFileSync(path.join(APP_DIR, "themes.css"), "utf8");
const globalsCss = readFileSync(path.join(APP_DIR, "globals.css"), "utf8");
const migration = readFileSync(
  path.join(process.cwd(), "supabase", "migrations", "0045_org_theme.sql"),
  "utf8",
);

/** Primitivele pe care ORICE tema trebuie sa le defineasca, in light si in dark. */
const COLOR_PRIMITIVES = [
  "--brand",
  "--accent",
  "--accent-soft",
  "--on-accent",
  "--ink",
  "--muted-ink",
  "--faint",
  "--line",
  "--paper",
  "--surface",
  "--surface-2",
  "--grid-dot",
];

/** Corpul blocului CSS care incepe exact cu `selector`. */
function block(css: string, selector: string): string {
  const start = css.indexOf(`${selector} {`);
  expect(start, `lipseste blocul ${selector}`).toBeGreaterThanOrEqual(0);
  const open = css.indexOf("{", start);
  return css.slice(open + 1, css.indexOf("\n}", open));
}

describe("teme - metadate", () => {
  it("fiecare cheie are definitie, iar tema implicita exista", () => {
    for (const key of THEME_KEYS) expect(THEMES[key].key).toBe(key);
    expect(THEMES[DEFAULT_THEME]).toBeDefined();
  });

  it("resolveThemeKey cade pe tema implicita pentru valori necunoscute", () => {
    expect(resolveThemeKey("industrial")).toBe("industrial");
    expect(resolveThemeKey("inexistenta")).toBe(DEFAULT_THEME);
    expect(resolveThemeKey(null)).toBe(DEFAULT_THEME);
    expect(isThemeKey("teren")).toBe(true);
  });

  it("CHECK-ul din migrare accepta exact cheile din cod", () => {
    const check = migration.match(/check \(theme in \(([^)]*)\)\)/)?.[1] ?? "";
    const keys = [...check.matchAll(/'([a-z]+)'/g)].map((m) => m[1]);
    expect(keys.sort()).toEqual([...THEME_KEYS].sort());
  });
});

describe("teme - CSS", () => {
  const nonDefault = THEME_KEYS.filter((k) => k !== DEFAULT_THEME);

  it.each(nonDefault)("tema %s defineste toate primitivele in light si in dark", (key) => {
    const light = block(themesCss, `[data-theme="${key}"]`);
    const dark = block(themesCss, `.dark[data-theme="${key}"],\n.dark [data-theme="${key}"]`);
    for (const token of COLOR_PRIMITIVES) {
      expect(light, `${key} light: ${token}`).toContain(`${token}:`);
      expect(dark, `${key} dark: ${token}`).toContain(`${token}:`);
    }
    expect(light).toContain("--app-font-sans:");
    expect(light).toContain("--radius:");
  });

  it("tema implicita e declarata si ca [data-theme=default] (light + dark)", () => {
    const light = block(globalsCss, `:root,\n[data-theme="default"]`);
    const dark = block(globalsCss, `.dark,\n.dark [data-theme="default"]`);
    for (const token of COLOR_PRIMITIVES) {
      expect(light).toContain(`${token}:`);
      expect(dark).toContain(`${token}:`);
    }
  });
});
