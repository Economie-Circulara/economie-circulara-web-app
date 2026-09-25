"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireRole } from "@/features/auth/session";
import { listClientUserIds, setAuthUsersBanned } from "@/features/settings/auth-ban";
import { sendClientInvite } from "@/features/settings/user-actions";
import type { AddressFormState, ClientFormState } from "./action-state";
import { defaultCuiLookupProvider, type CuiLookupResult } from "./cui-lookup";
import {
  DuplicateCuiError,
  createClientRecord,
  removeAddress,
  setClientArchived,
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

/**
 * Creeaza un client nou (ecranul /clienti/nou) - doar staff. Daca clientul are
 * email si userul curent e admin, i se trimite AUTOMAT invitatia in portal, cu
 * acelasi nucleu (`sendClientInvite`) ca formularul din /setari/utilizatori.
 * Invitarea ramane doar a adminului: un client creat de operator se invita din
 * `/clienti/[id]`. Un esec la invitare NU anuleaza crearea clientului; eroarea e
 * transmisa prin query string catre pagina de detaliu (redirect in orice caz), de
 * unde invitatia se poate (re)trimite.
 */
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
    if (fields.hqAddress) {
      await upsertAddress({
        clientId,
        organizationId: user.organizationId,
        label: "Sediu social",
        address: fields.hqAddress,
        isDefault: true,
      });
    }
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

  let inviteWarning: string | null = null;
  if (fields.email && user.role === "admin") {
    const inviteResult = await sendClientInvite(clientId, fields.email);
    if (inviteResult.error) {
      inviteWarning = `Clientul a fost creat, dar invitația nu a putut fi trimisă: ${inviteResult.error}`;
    }
  }

  revalidatePath("/clienti");
  redirect(
    inviteWarning
      ? `/clienti/${clientId}?inviteWarning=${encodeURIComponent(inviteWarning)}`
      : `/clienti/${clientId}`,
  );
}

/** Actualizeaza un client existent (ecranul /clienti/[id]) - doar staff. */
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
 * ca form action clasic) - e o precompletare, nu un submit: formularul de
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

/** Creeaza/actualizeaza o adresa de livrare - doar staff. */
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

/** Sterge o adresa de livrare - doar staff. */
export async function deleteAddressAction(
  _prev: AddressFormState,
  formData: FormData,
): Promise<AddressFormState> {
  await requireRole(["admin", "operator"]);
  const id = clean(formData.get("id"));
  const clientId = clean(formData.get("client_id"));
  if (!id || !clientId) return { error: "Adresă invalidă." };

  try {
    await removeAddress(id);
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Nu am putut șterge adresa." };
  }

  revalidatePath(`/clienti/${clientId}`);
  return { error: null };
}

/** Rezultatul actiunilor de arhivare/restaurare (dialogul de confirmare). */
export interface ClientArchiveResult {
  error: string | null;
}

async function toggleClientArchived(id: string, archive: boolean): Promise<ClientArchiveResult> {
  await requireRole(["admin", "operator"]);
  if (!id) return { error: "Client invalid." };

  try {
    await setClientArchived(id, archive);
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Nu am putut actualiza clientul." };
  }

  // Profilul utilizatorului-client e deja (de)blocat in DB (trigger 0035); ban-ul in
  // Supabase Auth e doar a treia linie, best-effort - nu anuleaza arhivarea.
  await setAuthUsersBanned(await listClientUserIds(id), archive);

  revalidatePath("/clienti");
  revalidatePath(`/clienti/${id}`);
  return { error: null };
}

/**
 * Arhiveaza un client (migrarea 0035) - doar staff, dupa confirmare. Blocheaza si
 * logarea utilizatorului-client legat; comenzile/certificatele raman.
 */
export async function archiveClientAction(id: string): Promise<ClientArchiveResult> {
  return toggleClientArchived(id, true);
}

/** Restaureaza un client arhivat (si deblocheaza utilizatorul-client legat). */
export async function restoreClientAction(id: string): Promise<ClientArchiveResult> {
  return toggleClientArchived(id, false);
}
