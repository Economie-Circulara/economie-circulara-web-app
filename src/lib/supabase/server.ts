import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { getSupabaseEnv } from "@/lib/env";
import type { Database } from "@/lib/database.types";

/**
 * Client Supabase pentru cod server (Server Components, Server Actions, Route Handlers).
 * Sesiunea este legata de cookie-urile cererii curente.
 */
export async function createClient() {
  const { url, anonKey } = getSupabaseEnv();
  const cookieStore = await cookies();

  return createServerClient<Database>(url, anonKey, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          cookiesToSet.forEach(({ name, value, options }) => {
            cookieStore.set(name, value, options);
          });
        } catch {
          // `setAll` apelat dintr-un Server Component - poate fi ignorat daca
          // reimprospatarea sesiunii se face prin middleware.
        }
      },
    },
  });
}
