/** Un client (firma juridica), asa cum il returneaza `queries.ts`/`service.ts`. */
export interface Client {
  id: string;
  cui: string;
  name: string;
  regCom: string | null;
  isVatPayer: boolean;
  hqAddress: string | null;
  email: string | null;
  phone: string | null;
  contactPerson: string | null;
  isSupplier: boolean;
  notes: string | null;
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
