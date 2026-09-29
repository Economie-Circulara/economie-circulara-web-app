import { NextResponse, type NextRequest } from "next/server";
import {
  InvalidHookPayloadError,
  handleSendEmailHook,
  parseSendEmailHookPayload,
} from "@/features/notifications/auth-hook";
import { verifyWebhookSignature } from "@/features/notifications/webhook-signature";

/**
 * Supabase Auth „Send Email Hook” (HTTP). Configurare: Supabase -> Authentication ->
 * Hooks -> Send Email -> URL `https://<domeniul platformei>/auth/email-hook`, iar
 * secretul generat acolo in `SEND_EMAIL_HOOK_SECRET` (docs/setup.md). Ruta e sub
 * prefixul public `/auth` (fara sesiune - o apeleaza serverul Supabase); autentificarea
 * e semnatura Standard Webhooks.
 *
 * Raspunsuri in formatul asteptat de Supabase: `{}` la succes, altfel
 * `{ error: { http_code, message } }` - mesajul ajunge la actiunea care a cerut emailul.
 */
function hookError(status: number, message: string) {
  return NextResponse.json({ error: { http_code: status, message } }, { status });
}

export async function POST(request: NextRequest) {
  const secret = process.env.SEND_EMAIL_HOOK_SECRET;
  if (!secret) return hookError(500, "Hook-ul de email nu este configurat.");

  const body = await request.text();
  const valid = verifyWebhookSignature(
    secret,
    {
      id: request.headers.get("webhook-id"),
      timestamp: request.headers.get("webhook-timestamp"),
      signature: request.headers.get("webhook-signature"),
    },
    body,
  );
  if (!valid) return hookError(401, "Semnatura invalida.");

  try {
    const payload = parseSendEmailHookPayload(JSON.parse(body));
    await handleSendEmailHook(payload);
    return NextResponse.json({});
  } catch (err) {
    if (err instanceof InvalidHookPayloadError || err instanceof SyntaxError) {
      return hookError(400, "Cerere invalida.");
    }
    // Fara date personale in log (email, token) - doar tipul erorii.
    console.error("[auth/email-hook] trimitere esuata", {
      name: err instanceof Error ? err.name : "unknown",
      message: err instanceof Error ? err.message : null,
    });
    return hookError(500, "Nu am putut trimite emailul. Incercati din nou.");
  }
}
