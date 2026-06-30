import { createClient } from "@/lib/supabase/server";
import type { Database } from "@/lib/database.types";

export interface OrgUser {
  id: string;
  email: string | null;
  fullName: string | null;
  role: Database["public"]["Enums"]["user_role"];
  status: Database["public"]["Enums"]["org_status"];
}

/** Utilizatorii organizatiei curente (RLS: vizibil doar adminului organizatiei). */
export async function listOrgUsers(): Promise<OrgUser[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("profiles")
    .select("id, email, full_name, role, status")
    .order("role", { ascending: true });

  return (data ?? []).map((p) => ({
    id: p.id,
    email: p.email,
    fullName: p.full_name,
    role: p.role,
    status: p.status,
  }));
}
