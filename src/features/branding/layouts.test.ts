import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { DEFAULT_LAYOUT, LAYOUTS, LAYOUT_KEYS, resolveLayoutKey } from "./layouts";

const migration = readFileSync(
  path.join(process.cwd(), "supabase", "migrations", "0037_org_layout.sql"),
  "utf8",
);

describe("organizari", () => {
  it("fiecare cheie are definitie", () => {
    for (const key of LAYOUT_KEYS) expect(LAYOUTS[key].key).toBe(key);
  });

  it("valorile necunoscute cad pe organizarea standard", () => {
    expect(resolveLayoutKey("flux")).toBe("flux");
    expect(resolveLayoutKey("altceva")).toBe(DEFAULT_LAYOUT);
    expect(resolveLayoutKey(null)).toBe(DEFAULT_LAYOUT);
  });

  it("CHECK-ul din migrare accepta exact cheile din cod", () => {
    const check = migration.match(/check \(layout in \(([^)]*)\)\)/)?.[1] ?? "";
    const keys = [...check.matchAll(/'([a-z]+)'/g)].map((m) => m[1]);
    expect(keys.sort()).toEqual([...LAYOUT_KEYS].sort());
  });
});
