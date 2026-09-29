import { describe, expect, it } from "vitest";
import { canSendFromOrgDomain, isAddressOnDomain, resolveEmailSender } from "./sender";

const FALLBACK = { name: "Lot cu Lot", address: "notificari@lotculot.eu" };
const VERIFIED = {
  fromName: "Etora",
  fromAddress: "notificari@etora.ro",
  emailDomain: "etora.ro",
  emailDomainStatus: "verified",
  replyTo: "contact@etora.ro",
};

describe("isAddressOnDomain", () => {
  it("compara exact domeniul adresei, fara subdomenii", () => {
    expect(isAddressOnDomain("a@Etora.ro", "etora.ro")).toBe(true);
    expect(isAddressOnDomain("a@mail.etora.ro", "etora.ro")).toBe(false);
    expect(isAddressOnDomain("fara-arond", "etora.ro")).toBe(false);
  });
});

describe("resolveEmailSender", () => {
  it("domeniu verificat: adresa si numele organizatiei + reply-to", () => {
    expect(resolveEmailSender(VERIFIED, FALLBACK)).toEqual({
      from: { name: "Etora", address: "notificari@etora.ro" },
      replyTo: "contact@etora.ro",
    });
  });

  it.each(["pending", "failed", "not_configured"])(
    "domeniu '%s': adresa platformei, dar numele organizatiei",
    (status) => {
      const sender = resolveEmailSender({ ...VERIFIED, emailDomainStatus: status }, FALLBACK);
      expect(sender.from).toEqual({ name: "Etora", address: "notificari@lotculot.eu" });
    },
  );

  it("adresa pe alt domeniu decat cel verificat -> adresa platformei", () => {
    const org = { ...VERIFIED, fromAddress: "x@altceva.ro" };
    expect(canSendFromOrgDomain(org)).toBe(false);
    expect(resolveEmailSender(org, FALLBACK).from.address).toBe("notificari@lotculot.eu");
  });

  it("fara configurare: expeditorul de rezerva, fara reply-to", () => {
    expect(resolveEmailSender(null, FALLBACK)).toEqual({ from: FALLBACK, replyTo: null });
  });
});
