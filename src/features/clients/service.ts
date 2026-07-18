import { createClient } from "@/lib/supabase/server";
import type { Database } from "@/lib/database.types";
import { normalizeCui } from "./cui-lookup";
import type { Client, ClientAddress } from "./types";

type ClientRow = Database["public"]["Tables"]["clients"]["Row"];
type ClientAddressRow = Database["public"]["Tables"]["client_addresses"]["Row"];

// Cod Postgres standard pentru incalcarea unei constrangeri UNIQUE
// (`clients_organization_id_cui_key`, vezi 0001_core_schema.sql).
const ERR_UNIQUE_VIOLATION = "23505";

/** Exista deja un client cu acest CUI in organizatia curenta. */
export class DuplicateCuiError extends Error {
  constructor(public readonly cui: string) {
    super(`Există deja un client cu CUI ${cui} în organizația ta.`);
    this.name = "DuplicateCuiError";
  }
}

function mapClient(row: ClientRow): Client {
  return {
    id: row.id,
    cui: row.cui,
    name: row.name,
    regCom: row.reg_com,
    isVatPayer: row.is_vat_payer,
    hqAddress: row.hq_address,
    email: row.email,
    phone: row.phone,
    contactPerson: row.contact_person,
    isSupplier: row.is_supplier,
    notes: row.notes,
    createdAt: row.created_at,
  };
}

function mapAddress(row: ClientAddressRow): ClientAddress {
  return {
    id: row.id,
    clientId: row.client_id,
    label: row.label,
    address: row.address,
    isDefault: row.is_default,
    createdAt: row.created_at,
  };
}

export interface ClientFields {
  cui: string;
  name: string;
  regCom?: string | null;
  isVatPayer?: boolean;
  hqAddress?: string | null;
  email?: string | null;
  phone?: string | null;
  contactPerson?: string | null;
  isSupplier?: boolean;
  notes?: string | null;
}

export interface CreateClientInput extends ClientFields {
  /** Organizatia curenta (din sesiune) — RLS impune `app.is_staff_of(organization_id)`. */
  organizationId: string;
}

/**
 * Creeaza un client nou. CUI normalizat (fara "RO"/spatii — vezi cui-lookup.ts)
 * inainte de salvare, ca sa nu apara duplicate din formatari diferite ale
 * aceluiasi CUI. `organization_id` vine explicit din sesiune (nu exista RPC
 * dedicat — schema + migrarea 0004 sunt inghetate, Task A nu adauga alta migrare
 * de schema, doar bucket-ul de storage din 0006).
 */
export async function createClientRecord(input: CreateClientInput): Promise<Client> {
  const supabase = await createClient();
  const cui = normalizeCui(input.cui);

  const { data, error } = await supabase
    .from("clients")
    .insert({
      organization_id: input.organizationId,
      cui,
      name: input.name,
      reg_com: input.regCom ?? null,
      is_vat_payer: input.isVatPayer ?? false,
      hq_address: input.hqAddress ?? null,
      email: input.email ?? null,
      phone: input.phone ?? null,
      contact_person: input.contactPerson ?? null,
      is_supplier: input.isSupplier ?? false,
      notes: input.notes ?? null,
    })
    .select()
    .single();

  if (error || !data) {
    if (error?.code === ERR_UNIQUE_VIOLATION) throw new DuplicateCuiError(cui);
    throw new Error(error?.message ?? "Nu am putut crea clientul.");
  }
  return mapClient(data);
}

export interface UpdateClientInput extends ClientFields {
  id: string;
}

/** Actualizeaza un client existent. Acelasi tratament de duplicat CUI ca la creare. */
export async function updateClientRecord(input: UpdateClientInput): Promise<Client> {
  const supabase = await createClient();
  const cui = normalizeCui(input.cui);

  const { data, error } = await supabase
    .from("clients")
    .update({
      cui,
      name: input.name,
      reg_com: input.regCom ?? null,
      is_vat_payer: input.isVatPayer ?? false,
      hq_address: input.hqAddress ?? null,
      email: input.email ?? null,
      phone: input.phone ?? null,
      contact_person: input.contactPerson ?? null,
      is_supplier: input.isSupplier ?? false,
      notes: input.notes ?? null,
    })
    .eq("id", input.id)
    .select()
    .single();

  if (error || !data) {
    if (error?.code === ERR_UNIQUE_VIOLATION) throw new DuplicateCuiError(cui);
    throw new Error(error?.message ?? "Nu am putut actualiza clientul.");
  }
  return mapClient(data);
}

export interface UpsertAddressInput {
  /** Omis -> creaza o adresa noua; setat -> actualizeaza adresa existenta. */
  id?: string;
  clientId: string;
  organizationId: string;
  label?: string | null;
  address: string;
  isDefault: boolean;
}

/**
 * Creeaza/actualizeaza o adresa de livrare. O singura adresa implicita per
 * client: cand `isDefault` e true, orice alta adresa a clientului marcata
 * implicit e dezactivata INAINTE de insert/update (doua interogari secventiale,
 * nu o singura tranzactie — nu exista RPC dedicat in acest task, iar operatiunea
 * e facuta de staff, cu concurenta scazuta pe un singur client; o eventuala
 * migrare viitoare ar putea adauga un index unic partial + RPC daca devine nevoie).
 */
export async function upsertAddress(input: UpsertAddressInput): Promise<ClientAddress> {
  const supabase = await createClient();

  if (input.isDefault) {
    let clearQuery = supabase
      .from("client_addresses")
      .update({ is_default: false })
      .eq("client_id", input.clientId)
      .eq("is_default", true);
    if (input.id) clearQuery = clearQuery.neq("id", input.id);

    const { error: clearError } = await clearQuery;
    if (clearError) throw new Error("Nu am putut actualiza adresa implicită existentă.");
  }

  const payload = {
    client_id: input.clientId,
    organization_id: input.organizationId,
    label: input.label ?? null,
    address: input.address,
    is_default: input.isDefault,
  };

  const { data, error } = input.id
    ? await supabase.from("client_addresses").update(payload).eq("id", input.id).select().single()
    : await supabase.from("client_addresses").insert(payload).select().single();

  if (error || !data) throw new Error("Nu am putut salva adresa.");
  return mapAddress(data);
}

/** Sterge o adresa de livrare. */
export async function deleteAddress(id: string): Promise<void> {
  const supabase = await createClient();
  const { error } = await supabase.from("client_addresses").delete().eq("id", id);
  if (error) throw new Error("Nu am putut șterge adresa.");
}
