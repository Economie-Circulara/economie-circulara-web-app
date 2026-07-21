"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireRole } from "@/features/auth/session";
import { KIND_OPTIONS, UNIT_OPTIONS } from "./labels";
import { createItem, updateItem } from "./service";
import type { ItemKind, UnitOfMeasure } from "./types";
import type { ItemFormState } from "./form-state";

function clean(value: FormDataEntryValue | null): string | null {
  const s = String(value ?? "").trim();
  return s.length ? s : null;
}

function parseUnit(value: FormDataEntryValue | null): UnitOfMeasure | null {
  const s = clean(value);
  return (UNIT_OPTIONS as string[]).includes(s ?? "") ? (s as UnitOfMeasure) : null;
}

function parseKind(value: FormDataEntryValue | null): ItemKind | null {
  const s = clean(value);
  return (KIND_OPTIONS as string[]).includes(s ?? "") ? (s as ItemKind) : null;
}

function parseSellable(formData: FormData): boolean {
  return formData.get("sellable") === "on";
}

/** Creeaza un item nou in catalog (formularul /itemi/nou) — doar staff (admin/operator). */
export async function createItemAction(
  _prev: ItemFormState,
  formData: FormData,
): Promise<ItemFormState> {
  const user = await requireRole(["admin", "operator"]);
  if (!user.organizationId) return { error: "Utilizatorul nu apartine unei organizatii." };

  const title = clean(formData.get("title"));
  const unit = parseUnit(formData.get("unit"));
  const kind = parseKind(formData.get("kind"));

  if (!title) return { error: "Titlul este obligatoriu." };
  if (!unit) return { error: "Alege o unitate de masura." };
  if (!kind) return { error: "Alege tipul itemului." };

  try {
    await createItem({
      organizationId: user.organizationId,
      title,
      description: clean(formData.get("description")),
      unit,
      kind,
      sellable: parseSellable(formData),
      imageUrl: clean(formData.get("image_url")),
    });
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Nu am putut crea itemul." };
  }

  revalidatePath("/itemi");
  redirect("/itemi");
}

/** Actualizeaza un item existent (formularul /itemi/[id]) — doar staff (admin/operator). */
export async function updateItemAction(
  _prev: ItemFormState,
  formData: FormData,
): Promise<ItemFormState> {
  await requireRole(["admin", "operator"]);

  const id = clean(formData.get("id"));
  const title = clean(formData.get("title"));
  const unit = parseUnit(formData.get("unit"));
  const kind = parseKind(formData.get("kind"));

  if (!id) return { error: "Item invalid." };
  if (!title) return { error: "Titlul este obligatoriu." };
  if (!unit) return { error: "Alege o unitate de masura." };
  if (!kind) return { error: "Alege tipul itemului." };

  try {
    await updateItem(id, {
      title,
      description: clean(formData.get("description")),
      unit,
      kind,
      sellable: parseSellable(formData),
      imageUrl: clean(formData.get("image_url")),
    });
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Nu am putut salva itemul." };
  }

  revalidatePath("/itemi");
  redirect("/itemi");
}
