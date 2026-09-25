"use server";

import { revalidatePath } from "next/cache";
import { requireRole } from "@/features/auth/session";
import { createClient } from "@/lib/supabase/server";
import { parseDecimal, validatePriceInput } from "./ai-pricing";
import type { ModelPriceFormState } from "./form-state";

function clean(value: FormDataEntryValue | null): string | null {
  const text = String(value ?? "").trim();
  return text.length ? text : null;
}

/**
 * Adauga o VERSIUNE noua de pret pentru un model (append-only - randurile vechi raman,
 * costurile deja inregistrate nu se recalculeaza). Doar super-admin (si RLS: 0037).
 */
export async function addModelPriceAction(
  _prev: ModelPriceFormState,
  formData: FormData,
): Promise<ModelPriceFormState> {
  const user = await requireRole(["super_admin"]);

  const input = {
    model: clean(formData.get("model")) ?? "",
    inputCacheHitPerM: parseDecimal(formData.get("input_cache_hit_per_m")),
    inputCacheMissPerM: parseDecimal(formData.get("input_cache_miss_per_m")),
    outputPerM: parseDecimal(formData.get("output_per_m")),
    validFrom: clean(formData.get("valid_from")),
    note: clean(formData.get("note")),
  };
  const error = validatePriceInput(input);
  if (error) return { error, message: null };

  const supabase = (await createClient()) as unknown as {
    from(table: "ai_model_prices"): {
      insert(row: Record<string, unknown>): Promise<{ error: unknown }>;
    };
  };
  const { error: insertError } = await supabase.from("ai_model_prices").insert({
    model: input.model,
    input_cache_hit_per_m: input.inputCacheHitPerM,
    input_cache_miss_per_m: input.inputCacheMissPerM,
    output_per_m: input.outputPerM,
    ...(input.validFrom ? { valid_from: new Date(input.validFrom).toISOString() } : {}),
    note: input.note,
    created_by: user.id,
  });
  if (insertError) return { error: "Nu am putut salva prețul.", message: null };

  revalidatePath("/platform/ai");
  return { error: null, message: `Prețul pentru „${input.model}” a fost salvat.` };
}
