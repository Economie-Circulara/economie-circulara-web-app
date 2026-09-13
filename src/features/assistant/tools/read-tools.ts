import { listClients } from "@/features/clients/queries";
import {
  defaultCuiLookupProvider,
  isValidCuiFormat,
  normalizeCui,
} from "@/features/clients/cui-lookup";
import { listItems } from "@/features/items/queries";
import { globalSearch } from "@/features/search/service";
import { listLots } from "@/features/stock/queries";
import { searchManual } from "../docs-search";
import type { ToolContext } from "../types";
import {
  asObject,
  InvalidToolArgumentsError,
  optionalString,
  requiredString,
  type AssistantTool,
} from "./types";

/** Cate randuri trimitem modelului - suficient pentru a raspunde, fara a inunda contextul. */
const LIMIT = 10;

export const cautaInManual: AssistantTool<{ intrebare: string }> = {
  name: "cauta_in_manual",
  description:
    "Caută în manualul de utilizare al platformei și întoarce secțiunile relevante, cu linkul lor. " +
    "Folosește-l pentru orice întrebare de tipul 'cum fac X' sau 'unde găsesc Y'.",
  parameters: {
    type: "object",
    properties: { intrebare: { type: "string", description: "Întrebarea utilizatorului." } },
    required: ["intrebare"],
  },
  roles: ["super_admin", "admin", "operator", "client"],
  kind: "read",
  parse: (args) => ({ intrebare: requiredString(asObject(args), "intrebare") }),
  execute: async (input, ctx: ToolContext) => {
    const hits = await searchManual(input.intrebare, ctx.role);
    return hits.map((hit) => ({
      document: hit.docTitle,
      sectiune: hit.heading,
      link: hit.href,
      // Trunchiat: modelul are nevoie de esenta, nu de sectiunea intreaga.
      text: hit.text.trim().slice(0, 1200),
    }));
  },
};

export const cauta: AssistantTool<{ text: string }> = {
  name: "cauta",
  description:
    "Caută în datele platformei (clienți, comenzi, itemi, loturi, certificate) la care are acces " +
    "utilizatorul curent. Întoarce rezultate grupate pe tip.",
  parameters: {
    type: "object",
    properties: { text: { type: "string", description: "Textul căutat." } },
    required: ["text"],
  },
  roles: ["super_admin", "admin", "operator", "client"],
  kind: "read",
  parse: (args) => ({ text: requiredString(asObject(args), "text") }),
  execute: async (input, ctx) => globalSearch(input.text, { role: ctx.role, limit: 5 }),
};

export const cautaFirmaDupaCui: AssistantTool<{ cui: string }> = {
  name: "cauta_firma_dupa_cui",
  description:
    "Caută datele oficiale ale unei firme după CUI (ANAF): denumire, nr. reg. com., adresă, plătitor de TVA. " +
    "Folosește-l ÎNAINTE de a propune crearea unui client, ca datele să fie corecte.",
  parameters: {
    type: "object",
    properties: { cui: { type: "string", description: "CUI-ul firmei, cu sau fără prefixul RO." } },
    required: ["cui"],
  },
  roles: ["super_admin", "admin", "operator"],
  kind: "read",
  parse: (args) => {
    const cui = normalizeCui(requiredString(asObject(args), "cui"));
    if (!isValidCuiFormat(cui)) throw new InvalidToolArgumentsError(`CUI invalid: ${cui}.`);
    return { cui };
  },
  execute: async (input) => defaultCuiLookupProvider.lookup(input.cui),
};

export const listeazaClienti: AssistantTool<{ cautare: string | null }> = {
  name: "listeaza_clienti",
  description:
    "Listează clienții organizației, opțional filtrați după denumire sau CUI. " +
    "Folosește-l ca să găsești `client_id`-ul necesar pentru o comandă.",
  parameters: {
    type: "object",
    properties: { cautare: { type: "string", description: "Filtru după denumire sau CUI." } },
  },
  roles: ["super_admin", "admin", "operator"],
  kind: "read",
  parse: (args) => ({ cautare: optionalString(asObject(args), "cautare") }),
  execute: async (input) => {
    const clients = await listClients(input.cautare ? { search: input.cautare } : {});
    return clients.slice(0, LIMIT).map((client) => ({
      client_id: client.id,
      denumire: client.name,
      cui: client.cui,
      email: client.email,
    }));
  },
};

export const itemiVandabili: AssistantTool<{ cautare: string | null }> = {
  name: "itemi_vandabili",
  description:
    "Listează itemii marcați ca vandabili, cu unitatea de măsură. " +
    "Folosește-l ca să găsești `item_id`-ul pentru liniile unei comenzi.",
  parameters: {
    type: "object",
    properties: { cautare: { type: "string", description: "Filtru după denumire." } },
  },
  roles: ["super_admin", "admin", "operator"],
  kind: "read",
  parse: (args) => ({ cautare: optionalString(asObject(args), "cautare") }),
  execute: async (input) => {
    const items = await listItems({
      sellable: true,
      ...(input.cautare ? { search: input.cautare } : {}),
    });
    return items.slice(0, LIMIT).map((item) => ({
      item_id: item.id,
      denumire: item.title,
      um: item.unit,
    }));
  },
};

export const stocDisponibil: AssistantTool<{ item: string | null }> = {
  name: "stoc_disponibil",
  description: "Arată loturile din stoc și cantitățile rămase, opțional filtrate după item.",
  parameters: {
    type: "object",
    properties: { item: { type: "string", description: "Denumirea itemului (filtru)." } },
  },
  roles: ["super_admin", "admin", "operator"],
  kind: "read",
  parse: (args) => ({ item: optionalString(asObject(args), "item") }),
  execute: async (input) => {
    const lots = await listLots();
    const filtered = input.item
      ? lots.filter((lot) => lot.itemTitle.toLowerCase().includes(input.item!.toLowerCase()))
      : lots;

    return filtered.slice(0, LIMIT).map((lot) => ({
      item: lot.itemTitle,
      lot_id: lot.id,
      cantitate_ramasa: lot.remainingQty,
      um: lot.unit,
      blocat: lot.isBlocked,
      provenienta: lot.provenance,
    }));
  },
};

export const READ_TOOLS: AssistantTool<never>[] = [
  cautaInManual,
  cauta,
  cautaFirmaDupaCui,
  listeazaClienti,
  itemiVandabili,
  stocDisponibil,
] as unknown as AssistantTool<never>[];
