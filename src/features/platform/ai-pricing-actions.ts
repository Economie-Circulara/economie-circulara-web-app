"use server";

import { revalidatePath } from "next/cache";
import { requireRole } from "@/features/auth/session";
import { createClient } from "@/lib/supabase/server";
import {
  parseDecimal,
  validateCreditGrant,
  validateCreditSettings,
  validateOrgAiLimits,
  validatePriceInput,
} from "./ai-pricing";
import type { AiLimitsFormState, ModelPriceFormState } from "./form-state";

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

type Untyped = {
  from(table: string): {
    update(row: Record<string, unknown>): {
      eq(column: string, value: unknown): Promise<{ error: unknown }>;
    };
  };
};

/**
 * Valoarea unui credit AI + plafonul per mesaj (`ai_platform_settings`, 0039). Schimbarea
 * valorii creditului schimba si creditele deja afisate (se recalculeaza din cost) - de
 * aceea se face rar, dupa calibrare pe date reale.
 */
export async function updateCreditSettingsAction(
  _prev: AiLimitsFormState,
  formData: FormData,
): Promise<AiLimitsFormState> {
  const user = await requireRole(["super_admin"]);
  const input = {
    creditUsd: parseDecimal(formData.get("credit_usd")),
    turnCreditLimit: parseDecimal(formData.get("turn_credit_limit")),
  };
  const error = validateCreditSettings(input);
  if (error) return { error, message: null };

  const supabase = (await createClient()) as unknown as Untyped;
  const { error: updateError } = await supabase
    .from("ai_platform_settings")
    .update({
      credit_micros: Math.round(input.creditUsd * 1_000_000),
      turn_credit_limit: input.turnCreditLimit,
      updated_at: new Date().toISOString(),
      updated_by: user.id,
    })
    .eq("id", true);
  if (updateError) return { error: "Nu am putut salva setările.", message: null };

  revalidatePath("/platform/ai");
  return { error: null, message: "Setările creditelor au fost salvate." };
}

/** Bugetul lunar (credite), procentul zilnic si comutatorul AI al unei organizatii. */
export async function updateOrganizationAiLimitsAction(
  _prev: AiLimitsFormState,
  formData: FormData,
): Promise<AiLimitsFormState> {
  await requireRole(["super_admin"]);
  const organizationId = clean(formData.get("organization_id"));
  if (!organizationId) return { error: "Organizație invalidă.", message: null };
  const input = {
    monthlyCredits: parseDecimal(formData.get("monthly_credits")),
    dailyPercent: parseDecimal(formData.get("daily_percent")),
  };
  const error = validateOrgAiLimits(input);
  if (error) return { error, message: null };

  const supabase = (await createClient()) as unknown as Untyped;
  const { error: updateError } = await supabase
    .from("organizations")
    .update({
      ai_enabled: formData.get("enabled") === "on",
      ai_monthly_credit_limit: input.monthlyCredits,
      ai_daily_user_credit_percent: input.dailyPercent,
    })
    .eq("id", organizationId);
  if (updateError) return { error: "Nu am putut salva limitele.", message: null };

  revalidatePath("/platform/ai");
  return { error: null, message: "Salvat." };
}

/**
 * Top-up: credite EXTRA pentru o organizatie, valabile doar luna curenta (expira la
 * sfarsitul ei). Append-only, cu motiv obligatoriu; jurnalizat automat de DB (0040).
 */
export async function grantCreditsAction(
  _prev: AiLimitsFormState,
  formData: FormData,
): Promise<AiLimitsFormState> {
  const user = await requireRole(["super_admin"]);
  const organizationId = clean(formData.get("organization_id"));
  if (!organizationId) return { error: "Organizație invalidă.", message: null };
  const input = {
    credits: parseDecimal(formData.get("credits")),
    reason: clean(formData.get("reason")),
  };
  const error = validateCreditGrant(input);
  if (error) return { error, message: null };

  const supabase = (await createClient()) as unknown as {
    from(table: "ai_credit_grants"): {
      insert(row: Record<string, unknown>): Promise<{ error: unknown }>;
    };
  };
  const { error: insertError } = await supabase.from("ai_credit_grants").insert({
    organization_id: organizationId,
    credits: input.credits,
    reason: input.reason,
    created_by: user.id,
  });
  if (insertError) return { error: "Nu am putut acorda creditele.", message: null };

  revalidatePath("/platform/ai");
  return { error: null, message: `Am adăugat ${input.credits} credite pentru luna aceasta.` };
}
