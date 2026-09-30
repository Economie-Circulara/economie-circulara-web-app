/**
 * Tipul clientului (0051): `juridica` = firma (CUI), `fizica` = persoana fizica (CNP).
 */
export type ClientType = "juridica" | "fizica";

/** Un client (firma sau persoana fizica), asa cum il returneaza `queries.ts`/`service.ts`. */
export interface Client {
  id: string;
  clientType: ClientType;
  /** CUI-ul firmei; `null` pentru o persoana fizica. */
  cui: string | null;
  /** CNP-ul persoanei fizice (date personale - afisat doar staff-ului); `null` la firme. */
  cnp: string | null;
  name: string;
  regCom: string | null;
  isVatPayer: boolean;
  hqAddress: string | null;
  email: string | null;
  phone: string | null;
  contactPerson: string | null;
  isSupplier: boolean;
  notes: string | null;
  /**
   * Arhivat (migrarea 0035) - ascuns din liste si selecturi (comenzi noi, invitari),
   * iar utilizatorul-client legat nu se mai poate loga. Comenzile/certificatele
   * raman. `null` = activ.
   */
  archivedAt: string | null;
  createdAt: string;
}

/** O adresa de livrare a unui client. */
export interface ClientAddress {
  id: string;
  clientId: string;
  label: string | null;
  address: string;
  isDefault: boolean;
  createdAt: string;
}
