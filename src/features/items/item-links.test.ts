import { describe, expect, it } from "vitest";
import { itemHref, itemListHref } from "./item-links";

describe("itemHref", () => {
  it("duce un item fizic la ecranul Materiale (/itemi/[id])", () => {
    expect(itemHref({ id: "item-1", kind: "physical" })).toBe("/itemi/item-1");
  });

  it("duce un item de tip serviciu la ecranul Abonamente (/abonamente/[id])", () => {
    expect(itemHref({ id: "item-2", kind: "service" })).toBe("/abonamente/item-2");
  });
});

describe("itemListHref", () => {
  it("duce un material la lista Materiale si un abonament la lista Abonamente", () => {
    expect(itemListHref("physical")).toBe("/itemi");
    expect(itemListHref("service")).toBe("/abonamente");
  });
});
