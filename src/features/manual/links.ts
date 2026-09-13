import { slugForFile } from "./registry";

/** Prefixul rutei care serveste capturile de ecran din `docs/manual/img/`. */
export const MANUAL_IMAGE_BASE = "/ajutor/img";

/**
 * `img/admin-settings.png` (cum apare in markdown) -> `/ajutor/img/admin-settings.png`.
 * `null` pentru orice altceva (URL absolut, `data:`, alta cale) - apelantul lasa
 * atunci `src`-ul neschimbat.
 */
export function manualImageSrc(src?: string): string | null {
  if (!src) return null;
  if (!src.startsWith("img/")) return null;

  const name = src.slice("img/".length);
  if (!name || name.includes("/") || name.includes("..")) return null;

  return `${MANUAL_IMAGE_BASE}/${name}`;
}

export type ManualLink =
  /** Alt document din manual: `utilizare-client.md#x` -> `/ajutor/utilizare-client#x`. */
  | { kind: "internal"; href: string }
  /** Ancora in acelasi document. */
  | { kind: "anchor"; href: string }
  /** Link extern (http/https/mailto). */
  | { kind: "external"; href: string }
  /** Fara corespondent in aplicatie (`../handoff.md`) - se randeaza ca text simplu. */
  | { kind: "plain" };

/** Clasifica si rescrie un link din markdown-ul manualului. */
export function manualLinkHref(href?: string): ManualLink {
  if (!href) return { kind: "plain" };

  if (href.startsWith("#")) return { kind: "anchor", href };
  if (/^(?:https?:|mailto:)/i.test(href)) return { kind: "external", href };

  // Doar documentele din acelasi folder (`docs/manual/`) au corespondent in aplicatie;
  // `../handoff.md`, `../setup.md`, `../../AGENTS.md` nu sunt accesibile din UI.
  const [path, hash] = href.split("#", 2);
  const slug = path.includes("/") ? null : slugForFile(path);
  if (!slug) return { kind: "plain" };

  return { kind: "internal", href: hash ? `/ajutor/${slug}#${hash}` : `/ajutor/${slug}` };
}
