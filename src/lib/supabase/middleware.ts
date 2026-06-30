import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { getSupabaseEnv } from "@/lib/env";
import type { Database } from "@/lib/database.types";
import { resolveTenant } from "@/features/auth/tenant";

/** Prefixe de cale publice (nu necesita autentificare). */
const PUBLIC_PREFIXES = ["/login", "/forgot-password", "/set-password", "/auth", "/showcase"];

function isPublicPath(pathname: string): boolean {
  if (pathname === "/") return true;
  return PUBLIC_PREFIXES.some((p) => pathname === p || pathname.startsWith(`${p}/`));
}

/**
 * Reimprospateaza sesiunea Supabase (refresh token) la fiecare cerere, rezolva tenantul
 * (organizatia) din host/path si pazeste rutele protejate: utilizatorii neautentificati
 * sunt redirectati la /login. Guard-ul fin pe rol se face in layout-urile (admin)/(client).
 */
export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request });

  const { url, publishableKey } = getSupabaseEnv();

  const supabase = createServerClient<Database>(url, publishableKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
        supabaseResponse = NextResponse.next({ request });
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

  const { pathname } = request.nextUrl;

  // Guard: ruta protejata fara sesiune -> redirect la /login (pastreaza destinatia).
  if (!user && !isPublicPath(pathname)) {
    const loginUrl = request.nextUrl.clone();
    loginUrl.pathname = "/login";
    loginUrl.search = "";
    if (pathname !== "/") loginUrl.searchParams.set("next", pathname);
    return NextResponse.redirect(loginUrl);
  }

  // Tenant (organizatie) dedus din host/path, propagat downstream prin header.
  const tenant = resolveTenant(
    request.headers.get("host"),
    pathname,
    process.env.NEXT_PUBLIC_ROOT_DOMAIN,
  );
  if (tenant.slug) supabaseResponse.headers.set("x-tenant-slug", tenant.slug);
  if (tenant.customDomain) supabaseResponse.headers.set("x-tenant-domain", tenant.customDomain);

  return supabaseResponse;
}
