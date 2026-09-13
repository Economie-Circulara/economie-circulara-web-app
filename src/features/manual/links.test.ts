import { describe, expect, it } from "vitest";
import { manualImageSrc, manualLinkHref } from "./links";

describe("manualImageSrc", () => {
  it("rescrie capturile locale catre ruta autentificata", () => {
    expect(manualImageSrc("img/admin-settings.png")).toBe("/ajutor/img/admin-settings.png");
  });

  it("ignora orice nu e captura din manual", () => {
    expect(manualImageSrc("https://exemplu.ro/x.png")).toBeNull();
    expect(manualImageSrc("img/../../.env")).toBeNull();
    expect(manualImageSrc("img/sub/x.png")).toBeNull();
    expect(manualImageSrc(undefined)).toBeNull();
  });
});

describe("manualLinkHref", () => {
  it("rescrie link-urile catre alte documente din manual", () => {
    expect(manualLinkHref("utilizare-client.md")).toEqual({
      kind: "internal",
      href: "/ajutor/utilizare-client",
    });
    expect(manualLinkHref("ghid-administrare.md#gap-cunoscut-invitarea-unui-client")).toEqual({
      kind: "internal",
      href: "/ajutor/ghid-administrare#gap-cunoscut-invitarea-unui-client",
    });
  });

  it("pastreaza ancorele si link-urile externe", () => {
    expect(manualLinkHref("#2-catalog")).toEqual({ kind: "anchor", href: "#2-catalog" });
    expect(manualLinkHref("https://supabase.com")).toEqual({
      kind: "external",
      href: "https://supabase.com",
    });
  });

  it("marcheaza ca text documentele de repo, fara corespondent in aplicatie", () => {
    expect(manualLinkHref("../handoff.md")).toEqual({ kind: "plain" });
    expect(manualLinkHref("../../AGENTS.md")).toEqual({ kind: "plain" });
    expect(manualLinkHref(undefined)).toEqual({ kind: "plain" });
  });
});
