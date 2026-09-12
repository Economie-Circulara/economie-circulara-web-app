import { createClient } from "@/lib/supabase/server";
import type { Database } from "@/lib/database.types";
import { listClients } from "@/features/clients/queries";

export interface OrgUser {
  id: string;
  email: string | null;
  fullName: string | null;
  role: Database["public"]["Enums"]["user_role"];
  status: Database["public"]["Enums"]["org_status"];
  /** Denumirea firmei-client legate (doar pentru rolul `client`), altfel `null`. */
  clientName: string | null;
}

/** Utilizatorii organizatiei curente (RLS: vizibil doar adminului organizatiei). */
export async function listOrgUsers(): Promise<OrgUser[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("profiles")
    .select("id, email, full_name, role, status, clients(name)")
    .order("role", { ascending: true });

  return (data ?? []).map((p) => ({
    id: p.id,
    email: p.email,
    fullName: p.full_name,
    role: p.role,
    status: p.status,
    clientName: p.clients?.name ?? null,
  }));
}

export interface AvailableClient {
  id: string;
  name: string;
  cui: string;
}

/**
 * Firmele-client din organizatie care NU au inca un utilizator `client` legat
 * (`profiles.client_id`) — candidate pentru invitare (un client = un singur user,
 * vezi AGENTS.md). Foloseste clientul de sesiune (RLS), doar citire.
 */
export async function listAvailableClientsForInvite(): Promise<AvailableClient[]> {
  const [clients, supabase] = await Promise.all([listClients(), createClient()]);

  const { data: linked } = await supabase
    .from("profiles")
    .select("client_id")
    .not("client_id", "is", null);

  const linkedIds = new Set((linked ?? []).map((p) => p.client_id as string));

  return clients
    .filter((c) => !linkedIds.has(c.id))
    .map((c) => ({ id: c.id, name: c.name, cui: c.cui }));
}
