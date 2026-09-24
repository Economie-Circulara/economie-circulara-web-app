import { describe, expect, it } from "vitest";
import {
  compactFacts,
  FACTS_MAX_CHARS,
  FACTS_PREFIX,
  formatFacts,
  historyToMessages,
} from "./facts";

describe("compactFacts", () => {
  it("pastreaza doar ID-urile si campurile de identificare", () => {
    const facts = compactFacts([
      { client_id: "c1", denumire: "ACME", email: "a@b.ro", link: "/clienti/c1" },
      { nota: "fara identificator" },
    ]);
    expect(facts).toEqual([{ client_id: "c1", denumire: "ACME", link: "/clienti/c1" }]);
  });

  it("citeste si obiecte + liste imbricate / infasurate", () => {
    expect(
      compactFacts({ order_id: "o1", status: "accepted", puncte: [{ site_id: "s1", nota: "x" }] }),
    ).toEqual([{ order_id: "o1", status: "accepted" }, { site_id: "s1" }]);
    expect(compactFacts({ rezultate: [{ item_id: "i1", um: "t" }], trunchiat: true })).toEqual([
      { item_id: "i1", um: "t" },
    ]);
  });

  it("ignora rezultatele fara nimic identificabil", () => {
    expect(compactFacts("text")).toEqual([]);
    expect(compactFacts([{ sectiune: "Stoc" }])).toEqual([]);
  });
});

describe("formatFacts", () => {
  it("null cand nu e nimic de salvat", () => {
    expect(formatFacts([{ tool: "cauta_in_manual", records: [] }])).toBeNull();
  });

  it("un rand per tool, sub plafon", () => {
    const out = formatFacts([
      { tool: "listeaza_clienti", records: [{ client_id: "c1" }] },
      { tool: "itemi_vandabili", records: [{ item_id: "i1" }] },
    ]);
    expect(out).toBe(
      `${FACTS_PREFIX}\nlisteaza_clienti: [{"client_id":"c1"}]\nitemi_vandabili: [{"item_id":"i1"}]`,
    );

    const big = Array.from({ length: 50 }, (_, index) => ({
      tool: "t",
      records: [{ item_id: `i${index}`.padEnd(100, "x") }],
    }));
    expect(formatFacts(big)!.length).toBeLessThanOrEqual(FACTS_MAX_CHARS + FACTS_PREFIX.length + 1);
  });
});

describe("historyToMessages", () => {
  const at = "2026-09-24T00:00:00Z";

  it("lipeste datele de referinta la urmatorul mesaj al asistentului", () => {
    const messages = historyToMessages([
      { id: "1", role: "user", content: "comandă pt ACME", createdAt: at },
      { id: "2", role: "tool", content: "[Date] c1", createdAt: at },
      { id: "3", role: "assistant", content: "Ce cantitate?", createdAt: at },
      { id: "4", role: "user", content: "5 t", createdAt: at },
    ]);
    expect(messages).toEqual([
      { role: "user", content: "comandă pt ACME" },
      { role: "assistant", content: "[Date] c1\n\nCe cantitate?" },
      { role: "user", content: "5 t" },
    ]);
  });

  it("un mesaj tool ramas la coada devine mesaj assistant", () => {
    expect(
      historyToMessages([{ id: "1", role: "tool", content: "[Date]", createdAt: at }]),
    ).toEqual([{ role: "assistant", content: "[Date]" }]);
  });
});
