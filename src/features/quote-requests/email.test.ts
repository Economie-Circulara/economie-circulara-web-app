import { describe, expect, it } from "vitest";
import { emailBrandFor } from "@/features/notifications/email-brand";
import { quoteRecipients, renderQuoteRequestEmail } from "./email";

const request = {
  service: "Concasare pe șantier",
  name: "Ion <Pop>",
  phone: "0722 123 456",
  email: "ion@exemplu.ro",
  message: "Moloz ~200 t",
};

describe("renderQuoteRequestEmail", () => {
  it("contine datele cererii, escapate, si linkul catre lista", () => {
    const rendered = renderQuoteRequestEmail(
      emailBrandFor(null, "notificari@platforma.test"),
      request,
      "https://abonamente.maconxcx.ro/cereri-oferta",
    );
    expect(rendered.subject).toBe("Cerere de ofertă: Concasare pe șantier - Ion <Pop>");
    expect(rendered.html).toContain("Ion &lt;Pop&gt;");
    expect(rendered.html).not.toContain("Ion <Pop>");
    expect(rendered.text).toContain("Telefon: 0722 123 456");
    expect(rendered.text).toContain("Moloz ~200 t");
    expect(rendered.html).toContain("https://abonamente.maconxcx.ro/cereri-oferta");
  });

  it("spune cand solicitantul nu a lasat email", () => {
    const rendered = renderQuoteRequestEmail(
      emailBrandFor(null, "notificari@platforma.test"),
      { ...request, email: null, message: null },
      null,
    );
    expect(rendered.text).toContain("contactați-l telefonic");
    expect(rendered.text).not.toContain("Detalii:");
  });
});

describe("quoteRecipients", () => {
  it("prefera inboxul organizatiei", () => {
    expect(quoteRecipients("contact@firma.ro", ["a@firma.ro"])).toEqual(["contact@firma.ro"]);
  });

  it("altfel adminii, fara duplicate si fara adrese goale", () => {
    expect(quoteRecipients(null, ["A@firma.ro", "a@firma.ro", null, " ", "b@firma.ro"])).toEqual([
      "a@firma.ro",
      "b@firma.ro",
    ]);
  });
});
