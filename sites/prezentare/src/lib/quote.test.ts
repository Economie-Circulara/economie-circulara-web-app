import { describe, expect, it, vi } from "vitest";
import { quoteEndpoint, sendQuote, validateQuote, type QuoteFormValues } from "./quote";

const values: QuoteFormValues = {
  service: "Beton",
  name: "Ion Pop",
  phone: "0722 123 456",
  email: "",
  message: "20 mc",
  consent: true,
  website: "",
};

describe("validateQuote", () => {
  it("accepta un formular complet (email optional)", () => {
    expect(validateQuote(values)).toBeNull();
    expect(validateQuote({ ...values, email: "ion@exemplu.ro" })).toBeNull();
  });

  it.each([
    [{ name: " " }, /numele/],
    [{ phone: "abc" }, /telefon/],
    [{ email: "x@" }, /email/],
    [{ consent: false }, /acordul/],
    [{ service: "" }, /serviciul/],
  ])("respinge %o", (patch, message) => {
    expect(validateQuote({ ...values, ...patch })).toMatch(message);
  });
});

describe("sendQuote", () => {
  it("trimite JSON la endpoint-ul aplicatiei tenantului", async () => {
    const fetcher = vi.fn(async () => new Response(JSON.stringify({ ok: true }), { status: 200 }));
    await expect(sendQuote("abonamente.maconxcx.ro", values, fetcher)).resolves.toEqual({
      ok: true,
    });
    expect(fetcher).toHaveBeenCalledWith(
      "https://abonamente.maconxcx.ro/api/public/cerere-oferta",
      expect.objectContaining({ method: "POST", body: JSON.stringify(values) }),
    );
    expect(quoteEndpoint("circular.etora.ro")).toBe(
      "https://circular.etora.ro/api/public/cerere-oferta",
    );
  });

  it("afiseaza eroarea serverului", async () => {
    const fetcher = vi.fn(
      async () => new Response(JSON.stringify({ ok: false, error: "Prea multe" }), { status: 429 }),
    );
    await expect(sendQuote("a.b.ro", values, fetcher)).resolves.toEqual({
      ok: false,
      error: "Prea multe",
    });
  });

  it("o eroare de retea sau un raspuns ciudat -> mesaj generic", async () => {
    const offline = vi.fn(async () => {
      throw new TypeError("Failed to fetch");
    });
    const weird = vi.fn(async () => new Response("<html>", { status: 502 }));
    for (const fetcher of [offline, weird]) {
      const result = await sendQuote("a.b.ro", values, fetcher);
      expect(result.ok).toBe(false);
      expect(!result.ok && result.error).toMatch(/Sunați-ne/);
    }
  });
});
