import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { THEME_KEYS } from "@/lib/content";

// Fiecare cheie de tema are un bloc complet: altfel pagina ar mosteni valori goale.
const css = readFileSync(path.join(__dirname, "themes.css"), "utf8");
const REQUIRED = [
  "--brand",
  "--accent",
  "--accent-soft",
  "--on-accent",
  "--ink",
  "--muted-ink",
  "--line",
  "--paper",
  "--surface",
  "--surface-2",
  "--grid-dot",
  "--font-sans",
  "--radius",
  "--pattern-image",
  "--pattern-size",
];

describe("themes.css", () => {
  it.each(THEME_KEYS)("tema %s defineste toti tokenii", (key) => {
    const block = css.match(new RegExp(`\\[data-theme="${key}"\\]\\s*\\{([^}]*)\\}`))?.[1];
    expect(block, `lipseste blocul [data-theme="${key}"]`).toBeDefined();
    for (const token of REQUIRED) expect(block).toContain(`${token}:`);
  });
});
