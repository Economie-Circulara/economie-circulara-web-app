import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { getSupabaseEnv } from "@/lib/env";
import type { Database } from "@/lib/database.types";
import {
  resolveTenant,
  TENANT_DOMAIN_HEADER,
  TENANT_SLUG_HEADER,
  type TenantHint,
} from "@/features/auth/tenant";

/** Prefixe de cale publice (nu necesita autentificare). */
const PUBLIC_PREFIXES = ["/login", "/forgot-password", "/set-password", "/auth", "/showcase"];

function isPublicPath(pathname: string): boolean {
  if (pathname === "/") return true;
  return PUBLIC_PREFIXES.some((p) => pathname === p || pathname.startsWith(`${p}/`));
}

/**
 * Cloneaza headerele cererii curente si adauga headerele de tenant. Trebuie apelata de
 * fiecare data cand se recreeaza `supabaseResponse` (inclusiv in `setAll`), ca sa preia
 * si cookie-urile scrise intre timp de `request.cookies.set()` (acestea ajung tot in
 * `request.headers`).
 */
function requestHeadersWithTenant(request: NextRequest, tenant: TenantHint): Headers {
  const headers = new Headers(request.headers);
  if (tenant.slug) headers.set(TENANT_SLUG_HEADER, tenant.slug);
  if (tenant.customDomain) headers.set(TENANT_DOMAIN_HEADER, tenant.customDomain);
  return headers;
}

/**
 * Reimprospateaza sesiunea Supabase (refresh token) la fiecare cerere, rezolva tenantul
 * (organizatia) din host/path si pazeste rutele protejate: utilizatorii neautentificati
 * sunt redirectati la /login. Guard-ul fin pe rol se face in layout-urile (admin)/(client).
 */
export async function updateSession(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Tenant (organizatie) dedus din host/path, rezolvat INAINTE de a crea raspunsul, ca sa
  // fie disponibil pe REQUEST headers de la inceput. Headerele de raspuns (pe response)
  // ajung doar la browser, nu la server components / route handlers - de-aia propagarea
  // se face pe cererea (request) trimisa mai departe, nu pe `supabaseResponse.headers`.
  const tenant = resolveTenant(
    request.headers.get("host"),
    pathname,
    process.env.NEXT_PUBLIC_ROOT_DOMAIN,
  );

  let supabaseResponse = NextResponse.next({
    request: { headers: requestHeadersWithTenant(request, tenant) },
  });

  const { url, publishableKey } = getSupabaseEnv();

  const supabase = createServerClient<Database>(url, publishableKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
        supabaseResponse = NextResponse.next({
          request: { headers: requestHeadersWithTenant(request, tenant) },
        });
        cookiesToSet.forEach(({ name, value, options }) =>
          supabaseResponse.cookies.set(name, value, options),
        );
      },
    },
  });

  // IMPORTANT: nu introduce logica intre crearea clientului si getUser() - poate cauza
  // deconectari greu de depistat (recomandare oficiala @supabase/ssr).
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // Guard: ruta protejata fara sesiune -> redirect la /login (pastreaza destinatia).
  if (!user && !isPublicPath(pathname)) {
    const loginUrl = request.nextUrl.clone();
    loginUrl.pathname = "/login";
    loginUrl.search = "";
    if (pathname !== "/") loginUrl.searchParams.set("next", pathname);
    return NextResponse.redirect(loginUrl);
  }

  return supabaseResponse;
}
