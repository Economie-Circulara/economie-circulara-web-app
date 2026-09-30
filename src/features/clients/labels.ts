import type { ClientType } from "./types";

export const VAT_PAYER_LABEL = "Plătitor de TVA";
export const SUPPLIER_LABEL = "Furnizor";
export const DEFAULT_ADDRESS_LABEL = "Implicită";

export const CLIENT_TYPE_LABELS: Record<ClientType, string> = {
  juridica: "Persoană juridică",
  fizica: "Persoană fizică",
};

/**
 * Identificatorul fiscal afisat in afara paginii clientului (comenzi, certificate,
 * avize, cautare, selecturi): „CUI 123” la firme, „Persoană fizică” la persoane -
 * CNP-ul (date personale) NU apare niciodata aici, doar pe pagina clientului.
 */
export function clientTaxIdLabel(client: {
  clientType?: ClientType | string | null;
  cui: string | null;
}): string {
  if (client.clientType === "fizica") return CLIENT_TYPE_LABELS.fizica;
  return client.cui ? `CUI ${client.cui}` : "-";
}

/**
 * Varianta fara prefix, pentru locurile unde eticheta „CUI” e deja in layout
 * (certificatul PDF, avizul de livrare): CUI-ul simplu sau „Persoană fizică”.
 */
export function clientTaxIdValue(client: {
  clientType?: ClientType | string | null;
  cui: string | null;
}): string {
  if (client.clientType === "fizica") return CLIENT_TYPE_LABELS.fizica;
  return client.cui ?? "-";
}

/** Normalizeaza valoarea din DB (`text` + CHECK) la tipul TS. */
export function toClientType(value: string | null | undefined): ClientType {
  return value === "fizica" ? "fizica" : "juridica";
}
