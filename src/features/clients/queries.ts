import { createClient } from "@/lib/supabase/server";
import type { Database } from "@/lib/database.types";
import type { Client, ClientAddress } from "./types";

type ClientRow = Database["public"]["Tables"]["clients"]["Row"];
type ClientAddressRow = Database["public"]["Tables"]["client_addresses"]["Row"];

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

export interface ListClientsFilters {
  /** Cauta in denumire SAU CUI (case-insensitive, substring). */
  search?: string;
}

/** Lista clientilor (ecranul /clienti), cei mai recenti primii. */
export async function listClients(filters: ListClientsFilters = {}): Promise<Client[]> {
  const supabase = await createClient();
  let query = supabase.from("clients").select("*").order("created_at", { ascending: false });

  const search = filters.search?.trim();
  if (search) {
    const escaped = search.replace(/[%_]/g, (m) => `\\${m}`);
    query = query.or(`name.ilike.%${escaped}%,cui.ilike.%${escaped}%`);
  }

  const { data, error } = await query;
  if (error) throw new Error("Nu am putut încărca lista de clienți.");
  return (data ?? []).map(mapClient);
}

/** Un client dupa id, sau `null` daca nu exista/nu e accesibil (RLS). */
export async function getClient(id: string): Promise<Client | null> {
  const supabase = await createClient();
  const { data, error } = await supabase.from("clients").select("*").eq("id", id).maybeSingle();
  if (error) throw new Error("Nu am putut încărca clientul.");
  return data ? mapClient(data) : null;
}

/** Adresele de livrare ale unui client, cea implicita prima. */
export async function listClientAddresses(clientId: string): Promise<ClientAddress[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("client_addresses")
    .select("*")
    .eq("client_id", clientId)
    .order("is_default", { ascending: false })
    .order("created_at", { ascending: true });

  if (error) throw new Error("Nu am putut încărca adresele clientului.");
  return (data ?? []).map(mapAddress);
}
