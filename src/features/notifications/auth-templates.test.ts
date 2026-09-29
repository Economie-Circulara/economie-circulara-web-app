import { describe, expect, it } from "vitest";
import { AUTH_EMAIL_ACTIONS, renderAuthEmail } from "./auth-templates";
import { emailBrandFor } from "./email-brand";

const brand = {
  ...emailBrandFor(null, "notificari@lotculot.eu"),
  productName: "Etora Circular",
  organizationName: "Etora SRL",
};

describe("renderAuthEmail", () => {
  it.each(AUTH_EMAIL_ACTIONS.filter((a) => a !== "reauthentication"))(
    "'%s': subiect cu numele produsului, buton cu linkul",
    (action) => {
      const email = renderAuthEmail(action, brand, {
        link: "https://circular.etora.ro/auth/callback?token_hash=abc&type=x",
        code: "123456",
      });
      expect(email.subject).toContain("Etora Circular");
      expect(email.html).toContain("token_hash=abc");
      expect(email.html).not.toContain("123456");
      expect(email.text).not.toContain("Lot cu Lot");
    },
  );

  it("invitatia numeste organizatia", () => {
    const email = renderAuthEmail("invite", brand, { link: "https://x.ro/a", code: null });
    expect(email.subject).toBe("Invitație în Etora Circular");
    expect(email.text).toContain("Etora SRL");
  });

  it("reautentificarea afiseaza doar codul", () => {
    const email = renderAuthEmail("reauthentication", brand, { link: null, code: "654321" });
    expect(email.html).toContain("654321");
    expect(email.html).not.toContain("<a href");
  });
});
