import { NextResponse, type NextRequest } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getEmailProvider } from "@/features/notifications/provider";
import { isAllowedOrigin, normalizeHost } from "@/features/quote-requests/request";
import { submitQuoteRequest } from "@/features/quote-requests/submit";

/**
 * Formularul „Cere o ofertă” din site-ul de prezentare (plan:
 * docs/plans/site-cerere-oferta.md). Public (prefixul `/api/public` din middleware),
 * apelat cross-origin de pe apex-ul organizatiei - de aici CORS-ul explicit.
 */

const allowLocalOrigins = process.env.NODE_ENV !== "production";

function corsHeaders(request: NextRequest): Record<string, string> {
  const origin = request.headers.get("origin");
  const host = normalizeHost(request.headers.get("host"));
  if (!origin || !host || !isAllowedOrigin(origin, host, allowLocalOrigins)) return {};
  return {
    "Access-Control-Allow-Origin": origin,
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
    "Access-Control-Max-Age": "86400",
    Vary: "Origin",
  };
}

export function OPTIONS(request: NextRequest) {
  return new NextResponse(null, { status: 204, headers: corsHeaders(request) });
}

export async function POST(request: NextRequest) {
  const headers = corsHeaders(request);
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ ok: false, error: "Cerere invalidă." }, { status: 400, headers });
  }

  const result = await submitQuoteRequest(
    {
      host: request.headers.get("host"),
      origin: request.headers.get("origin"),
      ip: request.headers.get("x-forwarded-for") ?? request.headers.get("x-real-ip"),
      body,
    },
    {
      admin: createAdminClient(),
      provider: getEmailProvider(),
      allowLocalOrigins,
      ipSalt: process.env.QUOTE_IP_SALT?.trim() || "cerere-oferta",
    },
  );
  return NextResponse.json(result.body, { status: result.status, headers });
}
