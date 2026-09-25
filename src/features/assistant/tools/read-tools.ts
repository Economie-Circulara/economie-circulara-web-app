import { listClients } from "@/features/clients/queries";
import {
  defaultCuiLookupProvider,
  isValidCuiFormat,
  normalizeCui,
} from "@/features/clients/cui-lookup";
import { getDeliveryByOrderId } from "@/features/deliveries/queries";
import { PLANNABLE_ORDER_STATUS } from "@/features/deliveries/service";
import { itemHref } from "@/features/items/item-links";
import { listItems } from "@/features/items/queries";
import { ORDER_STATUS_OPTIONS } from "@/features/orders/labels";
import { getOrderDetail, listIntakeItemOptions, listOrders } from "@/features/orders/queries";
import type { OrderStatus } from "@/features/orders/types";
import { listSites } from "@/features/routing/site-queries";
import { globalSearch } from "@/features/search/service";
import { listLots } from "@/features/stock/queries";
import { searchManual } from "../docs-search";
import type { ToolContext } from "../types";
import { fuzzyFilter } from "./fuzzy-match";
import { PRODUCTION_READ_TOOLS } from "./production-tools";
import {
  asObject,
  InvalidToolArgumentsError,
  optionalString,
  requiredString,
  type AssistantTool,
} from "./types";

/** Cate randuri trimitem modelului - suficient pentru a raspunde, fara a inunda contextul. */
const LIMIT = 10;

/**
 * Cautare in doi timpi: intai filtrul din DB (`ilike`, rapid), iar daca nu gaseste
 * nimic, lista completa filtrata tolerant (`fuzzy-match.ts`) - „Beton SRL” gaseste
 * „SC BETON S.R.L.”. O cautare goala costa modelului o runda in plus.
 */
async function searchWithFallback<T>(
  query: string | null,
  load: (search: string | null) => Promise<T[]>,
  textOf: (row: T) => string,
): Promise<T[]> {
  if (!query) return load(null);
  const direct = await load(query);
  if (direct.length > 0) return direct;
  return fuzzyFilter(await load(null), query, textOf);
}

export const cautaInManual: AssistantTool<{ intrebare: string }> = {
  name: "cauta_in_manual",
  description:
    "Caută în manualul de utilizare al platformei și întoarce secțiunile relevante, cu linkul lor. " +
    "Folosește-l pentru orice întrebare de tipul 'cum fac X' sau 'unde găsesc Y'.",
  parameters: {
    type: "object",
    additionalProperties: false,
    properties: { intrebare: { type: "string", description: "Întrebarea utilizatorului." } },
    required: ["intrebare"],
  },
  roles: ["super_admin", "admin", "operator", "client"],
  version: 1,
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
    "Caută în datele platformei (clienți, comenzi, produse, loturi, certificate) la care are acces " +
    "utilizatorul curent. Întoarce rezultate grupate pe tip.",
  parameters: {
    type: "object",
    additionalProperties: false,
    properties: { text: { type: "string", description: "Textul căutat." } },
    required: ["text"],
  },
  roles: ["super_admin", "admin", "operator", "client"],
  version: 1,
  kind: "read",
  parse: (args) => ({ text: requiredString(asObject(args), "text") }),
  execute: async (input, ctx) => {
    const groups = await globalSearch(input.text, { role: ctx.role, limit: 5 });
    // `href` e numele folosit de UI-ul de cautare propriu; modelul primeste `link`,
    // acelasi nume ca la celelalte tool-uri, ca sa aiba o singura conventie de citat.
    return groups.map((group) => ({
      ...group,
      results: group.results.map(({ href, ...rest }) => ({ ...rest, link: href })),
    }));
  },
};

export const cautaFirmaDupaCui: AssistantTool<{ cui: string }> = {
  name: "cauta_firma_dupa_cui",
  description:
    "Caută datele oficiale ale unei firme după CUI (ANAF): denumire, nr. reg. com., adresă, plătitor de TVA. " +
    "Folosește-l ÎNAINTE de a propune crearea unui client, ca datele să fie corecte.",
  parameters: {
    type: "object",
    additionalProperties: false,
    properties: { cui: { type: "string", description: "CUI-ul firmei, cu sau fără prefixul RO." } },
    required: ["cui"],
  },
  roles: ["super_admin", "admin", "operator"],
  version: 1,
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
    additionalProperties: false,
    properties: { cautare: { type: "string", description: "Filtru după denumire sau CUI." } },
  },
  roles: ["super_admin", "admin", "operator"],
  version: 1,
  kind: "read",
  parse: (args) => ({ cautare: optionalString(asObject(args), "cautare") }),
  execute: async (input) => {
    const clients = await searchWithFallback(
      input.cautare,
      (search) => listClients(search ? { search } : {}),
      (client) => `${client.name} ${client.cui ?? ""}`,
    );
    return clients.slice(0, LIMIT).map((client) => ({
      client_id: client.id,
      denumire: client.name,
      cui: client.cui,
      email: client.email,
      link: `/clienti/${client.id}`,
    }));
  },
};

export const itemiVandabili: AssistantTool<{ cautare: string | null }> = {
  name: "itemi_vandabili",
  description:
    "Listează produsele marcate ca vandabile, cu unitatea de măsură. " +
    "Folosește-l ca să găsești `item_id`-ul pentru liniile unei comenzi.",
  parameters: {
    type: "object",
    additionalProperties: false,
    properties: { cautare: { type: "string", description: "Filtru după denumire." } },
  },
  roles: ["super_admin", "admin", "operator"],
  version: 1,
  kind: "read",
  parse: (args) => ({ cautare: optionalString(asObject(args), "cautare") }),
  execute: async (input) => {
    const items = await searchWithFallback(
      input.cautare,
      (search) => listItems({ sellable: true, ...(search ? { search } : {}) }),
      (item) => item.title,
    );
    return items.slice(0, LIMIT).map((item) => ({
      item_id: item.id,
      denumire: item.title,
      um: item.unit,
      link: itemHref(item),
    }));
  },
};

export const itemiAport: AssistantTool<{ cautare: string | null }> = {
  name: "itemi_aport",
  description:
    "Listează produsele care pot fi ADUSE de client într-o comandă de tip `aport` (materiale " +
    "fizice trasate, inclusiv cele NEVANDABILE - ex. moloz). Folosește-l în locul lui " +
    "`itemi_vandabili` când pregătești o comandă cu `tip_comanda = aport`.",
  parameters: {
    type: "object",
    additionalProperties: false,
    properties: { cautare: { type: "string", description: "Filtru după denumire." } },
  },
  roles: ["super_admin", "admin", "operator"],
  version: 1,
  kind: "read",
  parse: (args) => ({ cautare: optionalString(asObject(args), "cautare") }),
  execute: async (input) => {
    // Acelasi catalog ca selectorul de linii din /comenzi/nou la tipul `aport`
    // (`listIntakeItemOptions`) - filtrarea dupa denumire se face aici, interogarea
    // neavand parametru de cautare.
    const items = await listIntakeItemOptions();
    const filtered = input.cautare
      ? fuzzyFilter(items, input.cautare, (item) => item.title)
      : items;

    return filtered.slice(0, LIMIT).map((item) => ({
      item_id: item.id,
      denumire: item.title,
      um: item.unit,
      link: itemHref(item),
    }));
  },
};

export const contextLivrare: AssistantTool<{ order_id: string | null }> = {
  name: "context_livrare",
  description:
    "Arată contextul necesar planificării unei livrări: punctele de plecare ale organizației " +
    "(stații/depozite) și, dacă dai `order_id`, starea comenzii - dacă poate fi planificată " +
    "(doar comenzile acceptate, fără livrare existentă), adresa de livrare și livrarea deja " +
    "planificată, dacă există. Folosește-l ÎNAINTE de `planifica_livrare`.",
  parameters: {
    type: "object",
    additionalProperties: false,
    properties: {
      order_id: {
        type: "string",
        description: "ID-ul comenzii de verificat. Lipsă = doar punctele de plecare.",
      },
    },
  },
  roles: ["super_admin", "admin", "operator"],
  version: 1,
  kind: "read",
  parse: (args) => ({ order_id: optionalString(asObject(args), "order_id") }),
  execute: async (input) => {
    const sites = await listSites();
    const puncte_plecare = sites.map((site) => ({
      punct_plecare_id: site.id,
      denumire: site.name,
      adresa: site.address,
      implicit: site.isDefault,
    }));

    if (!input.order_id) return { puncte_plecare, comanda: null };

    const [order, delivery] = await Promise.all([
      getOrderDetail(input.order_id),
      getDeliveryByOrderId(input.order_id),
    ]);
    if (!order) {
      throw new InvalidToolArgumentsError("Comanda nu există sau nu este accesibilă.");
    }

    return {
      puncte_plecare,
      comanda: {
        order_id: order.id,
        numar: order.orderNumber,
        client: order.clientName,
        status: order.status,
        // Aceeasi regula ca butonul "Planifică livrare" din /comenzi/[id] si ca
        // `planDelivery` (a doua linie de aparare, server-side).
        poate_fi_planificata: order.status === PLANNABLE_ORDER_STATUS && !delivery,
        adresa_livrare: order.deliveryAddress,
        link: `/comenzi/${order.id}`,
      },
      livrare: delivery
        ? {
            livrare_id: delivery.id,
            data_programata: delivery.scheduledDate,
            transportator: delivery.carrierName,
            link: `/livrari/${delivery.id}`,
          }
        : null,
    };
  },
};

export const stocDisponibil: AssistantTool<{ item: string | null }> = {
  name: "stoc_disponibil",
  description: "Arată loturile din stoc și cantitățile rămase, opțional filtrate după item.",
  parameters: {
    type: "object",
    additionalProperties: false,
    properties: { item: { type: "string", description: "Denumirea itemului (filtru)." } },
  },
  roles: ["super_admin", "admin", "operator"],
  version: 1,
  kind: "read",
  parse: (args) => ({ item: optionalString(asObject(args), "item") }),
  execute: async (input) => {
    const lots = await listLots();
    const filtered = input.item ? fuzzyFilter(lots, input.item, (lot) => lot.itemTitle) : lots;

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

export const listeazaComenzi: AssistantTool<{
  status: OrderStatus | null;
  cautare: string | null;
}> = {
  name: "listeaza_comenzi",
  description:
    "Listează comenzile organizației (cele mai recente primele), opțional filtrate după status " +
    "și după numărul comenzii sau denumirea clientului. Folosește-l ca să găsești `order_id`-ul " +
    "pentru acceptare, anulare, ștergere ciornă sau livrare.",
  parameters: {
    type: "object",
    additionalProperties: false,
    properties: {
      status: { type: "string", enum: ORDER_STATUS_OPTIONS },
      cautare: { type: "string", description: "Număr comandă sau denumire client." },
    },
  },
  roles: ["super_admin", "admin", "operator"],
  version: 1,
  kind: "read",
  parse: (args) => {
    const raw = asObject(args);
    const status = optionalString(raw, "status") as OrderStatus | null;
    if (status && !ORDER_STATUS_OPTIONS.includes(status)) {
      throw new InvalidToolArgumentsError(
        `Status invalid. Valori permise: ${ORDER_STATUS_OPTIONS.join(", ")}.`,
      );
    }
    return { status, cautare: optionalString(raw, "cautare") };
  },
  execute: async (input) => {
    const orders = await searchWithFallback(
      input.cautare,
      (search) =>
        listOrders({
          ...(input.status ? { status: input.status } : {}),
          ...(search ? { search } : {}),
        }),
      (order) => `${order.orderNumber ?? ""} ${order.clientName}`,
    );
    return orders.slice(0, LIMIT).map((order) => ({
      order_id: order.id,
      numar: order.orderNumber,
      client: order.clientName,
      tip: order.orderType,
      status: order.status,
      produse: order.itemsSummary,
      are_livrare: order.delivery !== null,
      link: `/comenzi/${order.id}`,
    }));
  },
};

export const READ_TOOLS: AssistantTool<never>[] = [
  cautaInManual,
  cauta,
  cautaFirmaDupaCui,
  listeazaClienti,
  itemiVandabili,
  itemiAport,
  stocDisponibil,
  contextLivrare,
  listeazaComenzi,
  ...PRODUCTION_READ_TOOLS,
] as unknown as AssistantTool<never>[];
