import { headers } from "next/headers";

interface SiteOriginInput {
  configuredUrl?: string | null;
  forwardedProto?: string | null;
  host?: string | null;
}

/**
 * Normalizeaza originea publica folosita in linkurile trimise prin email.
 *
 * In productie, `NEXT_PUBLIC_SITE_URL` trebuie sa fie domeniul canonic al platformei.
 * Fallback-ul pe headere ramane util pentru dezvoltarea locala si deploy-urile preview.
 */
export function resolveSiteOrigin({
  configuredUrl,
  forwardedProto,
  host,
}: SiteOriginInput): string {
  const configured = configuredUrl?.trim();
  const rawOrigin =
    configured ||
    `${forwardedProto?.split(",")[0]?.trim() || "http"}://${host || "localhost:3000"}`;
  const url = new URL(rawOrigin);

  if (url.protocol !== "http:" && url.protocol !== "https:") {
    throw new Error("NEXT_PUBLIC_SITE_URL trebuie sa foloseasca protocolul http sau https.");
  }

  return url.origin;
}

/** Originea canonica pentru callback-uri Auth, fara slash final. */
export async function getSiteOrigin(): Promise<string> {
  const h = await headers();
  return resolveSiteOrigin({
    configuredUrl: process.env.NEXT_PUBLIC_SITE_URL,
    forwardedProto: h.get("x-forwarded-proto"),
    host: h.get("x-forwarded-host") ?? h.get("host"),
  });
}
