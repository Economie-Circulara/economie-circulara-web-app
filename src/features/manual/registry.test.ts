import { existsSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { MANUAL_DOCS, findManualDoc, manualDocsForRole, slugForFile } from "./registry";

describe("registry manual", () => {
  it("clientul vede doar manualul de portal client", () => {
    expect(manualDocsForRole("client").map((doc) => doc.slug)).toEqual(["utilizare-client"]);
  });

  it("admin si operator vad documentele de organizatie", () => {
    const admin = manualDocsForRole("admin").map((doc) => doc.slug);
    const operator = manualDocsForRole("operator").map((doc) => doc.slug);

    expect(admin).toContain("utilizare-admin-operator");
    expect(admin).toContain("ghid-administrare");
    expect(operator).toContain("utilizare-admin-operator");
    // Ghidul de administrare si planul de instruire sunt doar pentru admin.
    expect(operator).not.toContain("ghid-administrare");
    expect(operator).not.toContain("instruire");
  });

  it("super-adminul vede toate documentele", () => {
    expect(manualDocsForRole("super_admin")).toHaveLength(MANUAL_DOCS.length);
  });

  it("returneaza null si pentru slug interzis, si pentru slug inexistent", () => {
    expect(findManualDoc("ghid-administrare", "client")).toBeNull();
    expect(findManualDoc("document-inexistent", "admin")).toBeNull();
    expect(findManualDoc("utilizare-client", "client")?.file).toBe("utilizare-client.md");
  });

  it("are slug-uri unice, iar slugForFile e inversul fisierului", () => {
    const slugs = MANUAL_DOCS.map((doc) => doc.slug);
    expect(new Set(slugs).size).toBe(slugs.length);

    for (const doc of MANUAL_DOCS) {
      expect(slugForFile(doc.file)).toBe(doc.slug);
    }
    expect(slugForFile("handoff.md")).toBeNull();
  });

  it("fiecare document din catalog exista in docs/manual (drift de fisiere)", () => {
    for (const doc of MANUAL_DOCS) {
      expect(existsSync(path.join(process.cwd(), "docs", "manual", doc.file)), doc.file).toBe(true);
    }
  });
});
