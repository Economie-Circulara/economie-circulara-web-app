import path from "node:path";
import { MANUAL_DIR } from "./loader";

/** Folderul cu capturile de ecran ale manualului (`docs/manual/img/`). */
export const MANUAL_IMAGE_DIR = path.join(MANUAL_DIR, "img");

/** Doar PNG - exact ce produce `tests/e2e/manual-screenshots.spec.ts`. */
const FILE_NAME_RE = /^[a-z0-9][a-z0-9-]*\.png$/;

/**
 * Calea absoluta a unei capturi, din segmentele rutei `/ajutor/img/[...path]`.
 * `null` pentru orice iese din folderul manualului: traversal (`..`), cai
 * absolute, segmente codificate (`%2e%2e`), subfoldere sau alte extensii.
 */
export function resolveManualImagePath(segments: string[]): string | null {
  if (segments.length !== 1) return null;

  const [raw] = segments;
  if (!raw || raw !== decodeURIComponent(raw)) return null;
  if (!FILE_NAME_RE.test(raw)) return null;

  const resolved = path.join(MANUAL_IMAGE_DIR, raw);
  if (path.dirname(resolved) !== MANUAL_IMAGE_DIR) return null;

  return resolved;
}
