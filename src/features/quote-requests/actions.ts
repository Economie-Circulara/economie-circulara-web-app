"use server";

import { revalidatePath } from "next/cache";
import { requireRole } from "@/features/auth/session";
import { createClient } from "@/lib/supabase/server";
import type { QuoteRequestStatus } from "./queries";

export interface QuoteActionResult {
  error: string | null;
}

/**
 * Marcheaza o cerere de oferta rezolvata / o redeschide - doar staff. Cine si cand o
 * rezolva stampileaza triggerul din 0052; RLS limiteaza la cererile organizatiei.
 */
export async function setQuoteRequestStatusAction(
  id: string,
  status: QuoteRequestStatus,
): Promise<QuoteActionResult> {
  await requireRole(["admin", "operator"]);
  if (!id || (status !== "new" && status !== "handled")) return { error: "Cerere invalidă." };

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("quote_requests")
    .update({ status })
    .eq("id", id)
    .select("id");
  if (error) return { error: "Nu am putut actualiza cererea." };
  if (!data || data.length === 0) return { error: "Cererea nu există." };

  revalidatePath("/cereri-oferta");
  return { error: null };
}
