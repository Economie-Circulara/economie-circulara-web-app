import { afterEach, describe, expect, it, vi } from "vitest";
import {
  AnafCuiLookupProvider,
  CuiLookupError,
  CuiLookupTimeoutError,
  CuiNotFoundError,
  isValidCuiFormat,
  normalizeCui,
  parseAnafResponse,
} from "./cui-lookup";

afterEach(() => {
  vi.restoreAllMocks();
});

describe("normalizeCui", () => {
  it("elimina prefixul RO (case-insensitive)", () => {
    expect(normalizeCui("RO4183300")).toBe("4183300");
    expect(normalizeCui("ro4183300")).toBe("4183300");
    expect(normalizeCui("Ro4183300")).toBe("4183300");
  });

  it("elimina spatiile si dashurile", () => {
    expect(normalizeCui(" RO 4183 300 ")).toBe("4183300");
    expect(normalizeCui("41-83-300")).toBe("4183300");
  });

  it("lasa un CUI deja curat neschimbat", () => {
    expect(normalizeCui("4183300")).toBe("4183300");
  });
});

describe("isValidCuiFormat", () => {
  it("accepta un CUI cu cifra de control corecta", () => {
    // 4183300: CUI de test folosit uzual in exemple RO — verificat manual cu
    // algoritmul oficial (ponderi 7,5,3,2,1,7,5,3,2, mod 11).
    expect(isValidCuiFormat("4183300")).toBe(true);
  });

  it("respinge un CUI cu cifra de control gresita", () => {
    expect(isValidCuiFormat("4183301")).toBe(false);
  });

  it("respinge input nenumeric", () => {
    expect(isValidCuiFormat("RO4183300")).toBe(false);
    expect(isValidCuiFormat("abcdefg")).toBe(false);
  });

  it("respinge CUI prea scurt sau prea lung", () => {
    expect(isValidCuiFormat("1")).toBe(false);
    expect(isValidCuiFormat("12345678901")).toBe(false);
  });
});

describe("parseAnafResponse (fixture JSON)", () => {
  const fixture = {
    cui: 4183300,
    data: "2026-07-17",
    found: [
      {
        date_generale: {
          cui: 4183300,
          denumire: "SC EXEMPLU SRL",
          adresa: "MUN. BUCURESTI, SAT ..., STR. EXEMPLU, NR. 1",
          nrRegCom: "J40/1234/2001",
          statusRO_e_Factura: false,
        },
        inregistrare_scop_Tva: {
          scpTVA: true,
          perioade_TVA: [],
        },
      },
    ],
    notFound: [],
  };

  it("extrage denumire/adresa/reg.com/TVA din raspunsul ANAF", () => {
    const result = parseAnafResponse(fixture, "4183300");
    expect(result).toEqual({
      cui: "4183300",
      name: "SC EXEMPLU SRL",
      address: "MUN. BUCURESTI, SAT ..., STR. EXEMPLU, NR. 1",
      regCom: "J40/1234/2001",
      isVatPayer: true,
    });
  });

  it("marcheaza isVatPayer=false cand scpTVA e false/absent", () => {
    const notVatPayer = {
      found: [{ date_generale: { denumire: "X SRL" }, inregistrare_scop_Tva: { scpTVA: false } }],
    };
    expect(parseAnafResponse(notVatPayer, "123").isVatPayer).toBe(false);

    const noTvaBlock = { found: [{ date_generale: { denumire: "X SRL" } }] };
    expect(parseAnafResponse(noTvaBlock, "123").isVatPayer).toBe(false);
  });

  it("arunca CuiNotFoundError cand `found` e gol", () => {
    expect(() => parseAnafResponse({ found: [], notFound: [{ cui: 4183300 }] }, "4183300")).toThrow(
      CuiNotFoundError,
    );
  });

  it("arunca CuiLookupError pentru un payload neasteptat", () => {
    expect(() => parseAnafResponse(null, "4183300")).toThrow(CuiLookupError);
    expect(() => parseAnafResponse("not an object", "4183300")).toThrow(CuiLookupError);
  });
});

describe("AnafCuiLookupProvider (fetch mock — fara apeluri reale la ANAF)", () => {
  it("respinge un CUI cu format invalid fara sa apeleze fetch", async () => {
    const fetchImpl = vi.fn();
    const provider = new AnafCuiLookupProvider(fetchImpl);

    await expect(provider.lookup("abc")).rejects.toBeInstanceOf(CuiLookupError);
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it("trimite CUI normalizat + data curenta si parseaza raspunsul", async () => {
    const fetchImpl = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({
        found: [
          {
            date_generale: { denumire: "SC EXEMPLU SRL" },
            inregistrare_scop_Tva: { scpTVA: true },
          },
        ],
      }),
    });
    const provider = new AnafCuiLookupProvider(fetchImpl as unknown as typeof fetch);

    const result = await provider.lookup("RO 4183300");

    expect(fetchImpl).toHaveBeenCalledWith(
      "https://webservicesp.anaf.ro/api/PlatitorTvaRest/v9/tva",
      expect.objectContaining({ method: "POST" }),
    );
    const body = JSON.parse((fetchImpl.mock.calls[0][1] as RequestInit).body as string);
    expect(body).toEqual([{ cui: 4183300, data: expect.stringMatching(/^\d{4}-\d{2}-\d{2}$/) }]);
    expect(result.name).toBe("SC EXEMPLU SRL");
  });

  it("arunca CuiLookupError cand raspunsul HTTP nu e ok", async () => {
    const fetchImpl = vi.fn().mockResolvedValue({ ok: false, status: 500 });
    const provider = new AnafCuiLookupProvider(fetchImpl as unknown as typeof fetch);

    await expect(provider.lookup("4183300")).rejects.toBeInstanceOf(CuiLookupError);
  });

  it("degradeaza gratios la timeout (AbortError) — formularul ramane completabil manual", async () => {
    const fetchImpl = vi.fn().mockImplementation((_url: string, init?: RequestInit) => {
      return new Promise((_resolve, reject) => {
        init?.signal?.addEventListener("abort", () => {
          const err = new Error("aborted");
          err.name = "AbortError";
          reject(err);
        });
      });
    });
    const provider = new AnafCuiLookupProvider(fetchImpl as unknown as typeof fetch, 5);

    await expect(provider.lookup("4183300")).rejects.toBeInstanceOf(CuiLookupTimeoutError);
  });

  it("arunca CuiLookupError generica pentru erori de retea neasteptate", async () => {
    const fetchImpl = vi.fn().mockRejectedValue(new Error("network down"));
    const provider = new AnafCuiLookupProvider(fetchImpl as unknown as typeof fetch);

    await expect(provider.lookup("4183300")).rejects.toBeInstanceOf(CuiLookupError);
  });
});
