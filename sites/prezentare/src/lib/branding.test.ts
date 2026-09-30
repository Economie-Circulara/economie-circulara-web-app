import { describe, expect, it, vi } from "vitest";
import { resolveBranding } from "./branding";
import { parseSiteContent } from "./content";

const content = parseSiteContent("etora", {
  name: "Etora",
  appDomain: "circular.etora.ro",
  siteDomain: "etora.ro",
  theme: "teren",
  tagline: "Slogan",
  description: "Descriere",
  about: { title: "Despre", paragraphs: ["Unu"] },
  services: { title: "Servicii", items: [{ title: "A", text: "B" }] },
  portal: { title: "Portal", text: "Text", bullets: [] },
  contact: { email: "office@etora.ro" },
  legal: { companyName: "Etora SRL" },
});

const env = {
  SUPABASE_URL: "https://x.supabase.co/",
  SUPABASE_PUBLISHABLE_KEY: "sb_publishable_test",
};

function respond(body: unknown, ok = true, status = 200) {
  return vi.fn().mockResolvedValue({ ok, status, json: () => Promise.resolve(body) });
}

describe("resolveBranding", () => {
  it("fara variabile de mediu nu apeleaza reteaua si intoarce continutul", async () => {
    const fetchMock = vi.fn();
    const b = await resolveBranding(content, {}, fetchMock);
    expect(fetchMock).not.toHaveBeenCalled();
    expect(b).toEqual({
      name: "Etora",
      theme: "teren",
      logo: null,
      icon: null,
      source: "content",
    });
  });

  it("apeleaza org_branding dupa domeniul aplicatiei si ia tema + logo-ul din platforma", async () => {
    const fetchMock = respond([
      { name: "Etora SRL", logo_url: "https://cdn/logo.png", theme: "ciclu" },
    ]);
    const b = await resolveBranding(content, env, fetchMock);

    expect(fetchMock).toHaveBeenCalledWith(
      "https://x.supabase.co/rest/v1/rpc/org_branding",
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({ p_slug: null, p_domain: "circular.etora.ro" }),
      }),
    );
    expect(b).toEqual({
      name: "Etora",
      theme: "ciclu",
      logo: "https://cdn/logo.png",
      icon: "https://cdn/logo.png",
      source: "platform",
    });
  });

  it("antetul foloseste logo-ul orizontal, favicon-ul pe cel patrat (fiecare e rezerva)", async () => {
    const both = await resolveBranding(
      content,
      env,
      respond([
        { logo_url: "https://cdn/h.png", logo_square_url: "https://cdn/s.png", theme: null },
      ]),
    );
    expect([both.logo, both.icon]).toEqual(["https://cdn/h.png", "https://cdn/s.png"]);

    const onlySquare = await resolveBranding(
      content,
      env,
      respond([{ logo_url: null, logo_square_url: "https://cdn/s.png", theme: null }]),
    );
    expect([onlySquare.logo, onlySquare.icon]).toEqual(["https://cdn/s.png", "https://cdn/s.png"]);
  });

  it("logo-ul local are prioritate; tema necunoscuta din DB -> tema din continut", async () => {
    const b = await resolveBranding(
      { ...content, logo: "/etora/logo.svg" },
      env,
      respond([{ logo_url: "https://cdn/logo.png", theme: "neon" }]),
    );
    expect(b.logo).toBe("/etora/logo.svg");
    expect(b.theme).toBe("teren");
  });

  it.each([
    ["raspuns HTTP de eroare", respond({}, false, 500)],
    ["retea indisponibila", vi.fn().mockRejectedValue(new Error("ECONNREFUSED"))],
    ["nicio organizatie pe domeniu", respond([])],
  ])("%s -> valorile din continut + avertisment", async (_label, fetchMock) => {
    const log = vi.fn();
    const b = await resolveBranding(content, env, fetchMock, log);
    expect(b.source).toBe("content");
    expect(b.theme).toBe("teren");
    expect(log).toHaveBeenCalledOnce();
  });
});
