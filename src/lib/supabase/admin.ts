import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/database.types";

/**
 * Client Supabase cu cheia SECRETA (service_role) - ocoleste RLS. DOAR pe server,
 * pentru operatiuni privilegiate (ex. invitarea utilizatorilor via Auth Admin API).
 * Nu folosi niciodata in cod expus clientului.
 */
export function createAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const secret = process.env.SUPABASE_SECRET_KEY;
  if (!url || !secret) {
    throw new Error(
      "Lipsesc NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SECRET_KEY pentru clientul administrativ.",
    );
  }
  return createSupabaseClient<Database>(url, secret, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}
