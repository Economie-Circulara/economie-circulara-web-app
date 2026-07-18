"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireRole } from "@/features/auth/session";
import type { AddressFormState, ClientFormState } from "./action-state";
import { defaultCuiLookupProvider, type CuiLookupResult } from "./cui-lookup";
import {
  DuplicateCuiError,
  createClientRecord,
  deleteAddress,
  updateClientRecord,
  upsertAddress,
  type ClientFields,
} from "./service";

function clean(value: FormDataEntryValue | null): string | null {
  const s = String(value ?? "").trim();
  return s.length ? s : null;
}

function checkbox(value: FormDataEntryValue | null): boolean {
  return value === "on" || value === "true";
}

function readClientFields(formData: FormData): {
  fields: ClientFields | null;
  error: string | null;
} {
  const cui = clean(formData.get("cui"));
  const name = clean(formData.get("name"));
  if (!cui) return { fields: null, error: "CUI-ul este obligatoriu." };
  if (!name) return { fields: null, error: "Denumirea este obligatorie." };

  return {
    fields: {
      cui,
      name,
      regCom: clean(formData.get("reg_com")),
      isVatPayer: checkbox(formData.get("is_vat_payer")),
      hqAddress: clean(formData.get("hq_address")),
      email: clean(formData.get("email")),
      phone: clean(formData.get("phone")),
      contactPerson: clean(formData.get("contact_person")),
      isSupplier: checkbox(formData.get("is_supplier")),
      notes: clean(formData.get("notes")),
    },
    error: null,
  };
}

/** Creeaza un client nou (ecranul /clienti/nou) — doar staff. */
export async function createClientAction(
  _prev: ClientFormState,
  formData: FormData,
): Promise<ClientFormState> {
  const user = await requireRole(["admin", "operator"]);
  const { fields, error } = readClientFields(formData);
  if (!fields) return { error };
  if (!user.organizationId) return { error: "Utilizatorul curent nu are o organizație asociată." };

  let clientId: string;
  try {
    const client = await createClientRecord({ ...fields, organizationId: user.organizationId });
    clientId = client.id;
  } catch (err) {
    return {
      error:
        err instanceof DuplicateCuiError
          ? err.message
          : err instanceof Error
            ? err.message
            : "Nu am putut crea clientul.",
    };
  }

  revalidatePath("/clienti");
  redirect(`/clienti/${clientId}`);
}

/** Actualizeaza un client existent (ecranul /clienti/[id]) — doar staff. */
export async function updateClientAction(
  _prev: ClientFormState,
  formData: FormData,
): Promise<ClientFormState> {
  await requireRole(["admin", "operator"]);
  const id = clean(formData.get("id"));
  if (!id) return { error: "Client invalid." };

  const { fields, error } = readClientFields(formData);
  if (!fields) return { error };

  try {
    await updateClientRecord({ ...fields, id });
  } catch (err) {
    return {
      error:
        err instanceof DuplicateCuiError
          ? err.message
          : err instanceof Error
            ? err.message
            : "Nu am putut actualiza clientul.",
    };
  }

  revalidatePath(`/clienti/${id}`);
  revalidatePath("/clienti");
  return { error: null };
}

export interface CuiLookupState {
  error: string | null;
  result: CuiLookupResult | null;
}

/**
 * Cauta datele firmei dupa CUI (ANAF). Apelata direct din client component (nu
 * ca form action clasic) — e o precompletare, nu un submit: formularul de
 * creare ramane complet editabil daca lookup-ul esueaza sau nu gaseste nimic.
 */
export async function lookupCuiAction(cui: string): Promise<CuiLookupState> {
  await requireRole(["admin", "operator"]);
  try {
    const result = await defaultCuiLookupProvider.lookup(cui);
    return { error: null, result };
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Căutarea CUI a eșuat.", result: null };
  }
}

/** Creeaza/actualizeaza o adresa de livrare — doar staff. */
export async function upsertAddressAction(
  _prev: AddressFormState,
  formData: FormData,
): Promise<AddressFormState> {
  const user = await requireRole(["admin", "operator"]);
  if (!user.organizationId) return { error: "Utilizatorul curent nu are o organizație asociată." };

  const clientId = clean(formData.get("client_id"));
  const address = clean(formData.get("address"));
  if (!clientId) return { error: "Client invalid." };
  if (!address) return { error: "Adresa este obligatorie." };

  try {
    await upsertAddress({
      id: clean(formData.get("id")) ?? undefined,
      clientId,
      organizationId: user.organizationId,
      label: clean(formData.get("label")),
      address,
      isDefault: checkbox(formData.get("is_default")),
    });
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Nu am putut salva adresa." };
  }

  revalidatePath(`/clienti/${clientId}`);
  return { error: null };
}

/** Sterge o adresa de livrare — doar staff. */
export async function deleteAddressAction(
  _prev: AddressFormState,
  formData: FormData,
): Promise<AddressFormState> {
  await requireRole(["admin", "operator"]);
  const id = clean(formData.get("id"));
  const clientId = clean(formData.get("client_id"));
  if (!id || !clientId) return { error: "Adresă invalidă." };

  try {
    await deleteAddress(id);
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Nu am putut șterge adresa." };
  }

  revalidatePath(`/clienti/${clientId}`);
  return { error: null };
}
