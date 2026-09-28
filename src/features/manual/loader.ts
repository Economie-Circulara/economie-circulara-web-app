import { readFile } from "node:fs/promises";
import path from "node:path";
import { cache } from "react";
import { PLATFORM_NAME } from "@/lib/brand";

/** Sursa unica a manualului: `docs/manual/` din repo (vezi `src/lib/pdf/fonts.ts`). */
export const MANUAL_DIR = path.join(process.cwd(), "docs", "manual");

/**
 * Continutul fisierelor .md e imutabil per deploy, deci il tinem in memorie intre
 * request-uri. In dezvoltare NU cachem, ca editarea unui `.md` sa se vada la refresh.
 */
const contents = new Map<string, string>();
const cacheable = process.env.NODE_ENV === "production";

/** Citeste un fisier din `docs/manual/`, memoizat per request (`cache`) si per instanta. */
/** Inlocuieste numele platformei din manual cu numele aplicatiei tenantului. */
export function brandManual(markdown: string, productName: string): string {
  return productName === PLATFORM_NAME ? markdown : markdown.replaceAll(PLATFORM_NAME, productName);
}

export const readManualFile = cache(async (file: string): Promise<string> => {
  const cached = contents.get(file);
  if (cached !== undefined) return cached;

  const markdown = await readFile(path.join(MANUAL_DIR, file), "utf8");
  if (cacheable) contents.set(file, markdown);

  return markdown;
});
