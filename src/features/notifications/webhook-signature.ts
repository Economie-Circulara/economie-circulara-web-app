import { createHmac, timingSafeEqual } from "node:crypto";

/**
 * Verificarea semnaturii Standard Webhooks (https://www.standardwebhooks.com/), formatul
 * folosit de hook-urile Supabase Auth (Send Email Hook). Implementare proprie, pe
 * `node:crypto`, in locul pachetului `standardwebhooks` - sunt 20 de linii.
 *
 * - secretul, asa cum il da Supabase: `v1,whsec_<base64>` (se accepta si `whsec_<base64>`);
 * - continutul semnat: `${webhook-id}.${webhook-timestamp}.${body}`, HMAC-SHA256;
 * - `webhook-signature`: una sau mai multe semnaturi `v1,<base64>` separate prin spatiu;
 * - `webhook-timestamp` (secunde) in fereastra de toleranta - protectie la replay.
 */
export interface WebhookHeaders {
  id: string | null;
  timestamp: string | null;
  signature: string | null;
}

export const WEBHOOK_TOLERANCE_SECONDS = 5 * 60;

function secretBytes(secret: string): Buffer {
  const raw = secret
    .trim()
    .replace(/^v1,/, "")
    .replace(/^whsec_/, "");
  return Buffer.from(raw, "base64");
}

export function signWebhook(secret: string, id: string, timestamp: string, body: string): string {
  const digest = createHmac("sha256", secretBytes(secret))
    .update(`${id}.${timestamp}.${body}`)
    .digest("base64");
  return `v1,${digest}`;
}

export function verifyWebhookSignature(
  secret: string,
  headers: WebhookHeaders,
  body: string,
  nowSeconds: number = Math.floor(Date.now() / 1000),
): boolean {
  const { id, timestamp, signature } = headers;
  if (!secret || !id || !timestamp || !signature) return false;

  const ts = Number(timestamp);
  if (!Number.isFinite(ts) || Math.abs(nowSeconds - ts) > WEBHOOK_TOLERANCE_SECONDS) return false;

  const expected = Buffer.from(signWebhook(secret, id, timestamp, body));
  return signature.split(" ").some((candidate) => {
    const given = Buffer.from(candidate.trim());
    return given.length === expected.length && timingSafeEqual(given, expected);
  });
}
