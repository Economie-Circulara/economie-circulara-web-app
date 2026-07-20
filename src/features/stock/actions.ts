"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireRole } from "@/features/auth/session";
import { PROVENANCE_OPTIONS } from "./labels";
import { blockLot, createLot, unblockLot } from "./service";
import type { LotProvenance, QualityStatus } from "./types";
import type { LotFormState, BlockFormState } from "./form-state";

function clean(value: FormDataEntryValue | null): string | null {
  const s = String(value ?? "").trim();
  return s.length ? s : null;
}

function parseQty(value: FormDataEntryValue | null): number | null {
  const s = clean(value);
  if (!s) return null;
  const n = Number(s.replace(",", "."));
  return Number.isFinite(n) && n > 0 ? n : null;
}

function parseProvenance(value: FormDataEntryValue | null): LotProvenance | null {
  const s = clean(value);
  return (PROVENANCE_OPTIONS as string[]).includes(s ?? "") ? (s as LotProvenance) : null;
}

const QUALITY_OPTIONS: QualityStatus[] = ["unchecked", "passed", "failed"];

function parseQuality(value: FormDataEntryValue | null): QualityStatus | null {
  const s = clean(value);
  return (QUALITY_OPTIONS as string[]).includes(s ?? "") ? (s as QualityStatus) : null;
}

/** Creeaza un lot nou (formularul /stoc/nou) — doar staff (admin/operator). */
export async function createLotAction(
  _prev: LotFormState,
  formData: FormData,
): Promise<LotFormState> {
  await requireRole(["admin", "operator"]);

  const itemId = clean(formData.get("item_id"));
  const quantity = parseQty(formData.get("quantity"));
  const provenance = parseProvenance(formData.get("provenance"));

  if (!itemId) return { error: "Alege un item.", message: null };
  if (!quantity) return { error: "Introdu o cantitate mai mare ca zero.", message: null };
  if (!provenance) return { error: "Alege proveniența lotului.", message: null };

  try {
    await createLot({
      itemId,
      quantity,
      provenance,
      source: clean(formData.get("source")),
      entryDate: clean(formData.get("entry_date")),
      location: clean(formData.get("location")),
      qualityStatus: parseQuality(formData.get("quality_status")),
      reason: clean(formData.get("reason")),
    });
  } catch (err) {
    return {
      error: err instanceof Error ? err.message : "Nu am putut crea lotul.",
      message: null,
    };
  }

  revalidatePath("/stoc");
  redirect("/stoc");
}

/** Blocheaza un lot cu motiv obligatoriu. */
export async function blockLotAction(
  _prev: BlockFormState,
  formData: FormData,
): Promise<BlockFormState> {
  await requireRole(["admin", "operator"]);

  const lotId = clean(formData.get("lot_id"));
  const reason = clean(formData.get("reason"));
  if (!lotId) return { error: "Lot invalid." };
  if (!reason) return { error: "Motivul blocarii este obligatoriu." };

  try {
    await blockLot(lotId, reason);
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Nu am putut bloca lotul." };
  }

  revalidatePath("/stoc");
  return { error: null };
}

/** Deblocheaza un lot. */
export async function unblockLotAction(
  _prev: BlockFormState,
  formData: FormData,
): Promise<BlockFormState> {
  await requireRole(["admin", "operator"]);

  const lotId = clean(formData.get("lot_id"));
  if (!lotId) return { error: "Lot invalid." };

  try {
    await unblockLot(lotId);
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Nu am putut debloca lotul." };
  }

  revalidatePath("/stoc");
  return { error: null };
}
