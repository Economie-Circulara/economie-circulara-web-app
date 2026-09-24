import { describe, expect, it } from "vitest";
import { itemHref } from "./item-links";

describe("itemHref", () => {
  it("duce un item fizic la ecranul Materiale (/itemi/[id])", () => {
    expect(itemHref({ id: "item-1", kind: "physical" })).toBe("/itemi/item-1");
  });

  it("duce un item de tip serviciu la ecranul Abonamente (/abonamente/[id])", () => {
    expect(itemHref({ id: "item-2", kind: "service" })).toBe("/abonamente/item-2");
  });
});
