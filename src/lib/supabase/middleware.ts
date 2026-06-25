import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { getSupabaseEnv } from "@/lib/env";
import type { Database } from "@/lib/database.types";

/**
 * Reimprospateaza sesiunea Supabase (refresh token) la fiecare cerere si propaga
 * cookie-urile actualizate in raspuns. Rutarea pe roluri / guard-urile de acces se
 * adauga peste acest helper in T1.2.
 */
export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request });

  const { url, anonKey } = getSupabaseEnv();

  const supabase = createServerClient<Database>(url, anonKey, {
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
  await supabase.auth.getUser();

  return supabaseResponse;
}
