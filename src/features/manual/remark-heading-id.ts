/**
 * Plugin remark pentru sintaxa `### Titlu {#id-ales-de-mana}`, folosita in
 * `docs/manual/ghid-administrare.md` (cu link catre ea din `README.md`). Nici
 * GitHub, nici remark nu o interpreteaza nativ: fara plugin, acoladele ar ajunge
 * in textul titlului si in id-ul generat, iar link-ul ar ramane rupt.
 *
 * `rehype-slug` sare peste titlurile care au deja `id`, deci ordinea e: acest
 * plugin pune id-ul explicit, restul titlurilor primesc slug automat.
 */

interface TextNode {
  type: "text";
  value: string;
}

interface HeadingNode {
  type: "heading";
  children: { type: string; value?: string }[];
  data?: { hProperties?: Record<string, unknown> };
}

interface RootNode {
  children: { type: string }[];
}

const EXPLICIT_ID_RE = /\s*\{#([^}\s]+)\}\s*$/;

function isHeading(node: { type: string }): node is HeadingNode {
  return node.type === "heading";
}

function isText(node: { type: string; value?: string }): node is TextNode {
  return node.type === "text" && typeof node.value === "string";
}

export function remarkHeadingId() {
  return (tree: RootNode): void => {
    for (const node of tree.children) {
      if (!isHeading(node)) continue;

      const last = node.children.at(-1);
      if (!last || !isText(last)) continue;

      const match = EXPLICIT_ID_RE.exec(last.value);
      if (!match) continue;

      last.value = last.value.replace(EXPLICIT_ID_RE, "");
      node.data = { ...node.data, hProperties: { ...node.data?.hProperties, id: match[1] } };
    }
  };
}
