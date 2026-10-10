import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { MODULE_KEYS, hasModule, isModuleKey, resolveModules } from "./modules";

describe("modules", () => {
  it("recunoaste doar cheile definite", () => {
    expect(isModuleKey("fleet")).toBe(true);
    expect(isModuleKey("necunoscut")).toBe(false);
  });

  it("resolveModules ignora cheile necunoscute si valorile lipsa", () => {
    expect(resolveModules(["fleet", "vechi"])).toEqual(["fleet"]);
    expect(resolveModules(null)).toEqual([]);
    expect(resolveModules(undefined)).toEqual([]);
  });

  it("hasModule e fals fara organizatie sau fara modul activ", () => {
    expect(hasModule(null, "fleet")).toBe(false);
    expect(hasModule({ enabledModules: [] }, "fleet")).toBe(false);
    expect(hasModule({ enabledModules: ["fleet"] }, "fleet")).toBe(true);
  });

  it("CHECK-ul din migrarea 0055 contine exact cheile din cod", () => {
    const sql = readFileSync(
      join(process.cwd(), "supabase/migrations/0055_org_modules.sql"),
      "utf8",
    );
    const match = sql.match(/enabled_modules <@ array\[([^\]]*)\]/);
    expect(match).not.toBeNull();
    const keys = [...match![1].matchAll(/'([^']+)'/g)].map((m) => m[1]).sort();
    expect(keys).toEqual([...MODULE_KEYS].sort());
  });
});
