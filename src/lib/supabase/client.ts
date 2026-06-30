import { createBrowserClient } from "@supabase/ssr";
import { getSupabaseEnv } from "@/lib/env";
import type { Database } from "@/lib/database.types";

/**
 * Client Supabase pentru componente client (browser). De folosit doar in cod marcat
 * `"use client"`.
 */
export function createClient() {
  const { url, publishableKey } = getSupabaseEnv();
  return createBrowserClient<Database>(url, publishableKey);
}
