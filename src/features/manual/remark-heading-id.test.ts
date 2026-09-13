import { describe, expect, it } from "vitest";
import { remarkHeadingId } from "./remark-heading-id";

function heading(value: string) {
  return { type: "heading", depth: 3, children: [{ type: "text", value }] };
}

describe("remarkHeadingId", () => {
  it("muta {#id} din text in hProperties", () => {
    const node = heading("2.2 Gap cunoscut {#gap-cunoscut-invitarea-unui-client}");
    const tree = { children: [node] };

    remarkHeadingId()(tree);

    expect(node.children[0].value).toBe("2.2 Gap cunoscut");
    expect((node as { data?: { hProperties?: { id?: string } } }).data?.hProperties?.id).toBe(
      "gap-cunoscut-invitarea-unui-client",
    );
  });

  it("lasa neatinse titlurile fara sintaxa {#id} si celelalte noduri", () => {
    const node = heading("Titlu simplu");
    const paragraph = { type: "paragraph", children: [{ type: "text", value: "text {#nu}" }] };
    const tree = { children: [node, paragraph] };

    remarkHeadingId()(tree);

    expect(node.children[0].value).toBe("Titlu simplu");
    expect((node as { data?: unknown }).data).toBeUndefined();
    expect(paragraph.children[0].value).toBe("text {#nu}");
  });
});
