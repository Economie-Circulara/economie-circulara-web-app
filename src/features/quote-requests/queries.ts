import { createClient } from "@/lib/supabase/server";

export type QuoteRequestStatus = "new" | "handled";

export interface QuoteRequestRow {
  id: string;
  service: string;
  name: string;
  phone: string;
  email: string | null;
  message: string | null;
  status: QuoteRequestStatus;
  createdAt: string;
  handledAt: string | null;
}

/**
 * Cererile de oferta ale organizatiei (RLS: doar staff-ul ei), cele noi primele, apoi
 * dupa data. Limitate la ultimele 500 - lista e o casuta de intrare, nu o arhiva.
 */
export async function listQuoteRequests(): Promise<QuoteRequestRow[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("quote_requests")
    .select("id, service, name, phone, email, message, status, created_at, handled_at")
    .order("created_at", { ascending: false })
    .limit(500);
  if (error) throw new Error(error.message);
  return sortQuoteRequests(
    (data ?? []).map((row) => ({
      id: row.id,
      service: row.service,
      name: row.name,
      phone: row.phone,
      email: row.email,
      message: row.message,
      status: row.status === "handled" ? "handled" : "new",
      createdAt: row.created_at,
      handledAt: row.handled_at,
    })),
  );
}

/** Noile primele; in cadrul fiecarui status, cele mai recente primele. */
export function sortQuoteRequests(rows: QuoteRequestRow[]): QuoteRequestRow[] {
  return [...rows].sort((a, b) => {
    if (a.status !== b.status) return a.status === "new" ? -1 : 1;
    return b.createdAt.localeCompare(a.createdAt);
  });
}
