import { describe, expect, it } from "vitest";
import { clientTaxIdLabel, clientTaxIdValue, toClientType } from "./labels";

describe("identificatorul afisat al clientului (0051)", () => {
  it("firma: CUI; persoana fizica: „Persoană fizică”, niciodata CNP-ul", () => {
    expect(clientTaxIdLabel({ clientType: "juridica", cui: "4183300" })).toBe("CUI 4183300");
    expect(clientTaxIdValue({ clientType: "juridica", cui: "4183300" })).toBe("4183300");
    expect(clientTaxIdLabel({ clientType: "fizica", cui: null })).toBe("Persoană fizică");
    expect(clientTaxIdValue({ clientType: "fizica", cui: null })).toBe("Persoană fizică");
  });

  it("valori necunoscute din DB -> firma", () => {
    expect(toClientType("fizica")).toBe("fizica");
    expect(toClientType("altceva")).toBe("juridica");
    expect(toClientType(null)).toBe("juridica");
  });
});
