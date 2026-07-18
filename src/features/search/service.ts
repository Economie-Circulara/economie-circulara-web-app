import { createClient } from "@/lib/supabase/server";
import type { UserRole } from "@/features/auth/session";
import { ORDER_STATUS_LABELS } from "@/features/orders/labels";
import { listOrders } from "@/features/orders/queries";
import { listClients } from "@/features/clients/queries";
import { listItems } from "@/features/items/queries";
import { listCatalogItems } from "@/features/client-portal/queries";
import { SEARCH_GROUP_LABELS, SEARCH_GROUP_ORDER } from "./labels";
import type { GlobalSearchOptions, SearchResultGroup, SearchResultType } from "./types";

const DEFAULT_LIMIT = 5;

const dateFormatter = new Intl.DateTimeFormat("ro-RO", { dateStyle: "medium" });

function isStaffRole(role: UserRole): boolean {
  return role === "admin" || role === "operator";
}

/**
 * Scapa `%`/`_` (metacaractere `ilike`) dintr-un input de utilizator, apoi il
 * incadreaza in `%...%` pentru un substring match case-insensitive. Acelasi
 * pattern ca `listClients` (`src/features/clients/queries.ts`) — extras aici
 * pentru reutilizare in interogarile proprii (lots/certificates) + testabil
 * separat ("escaparea inputului", cerinta X2).
 */
export function toIlikePattern(input: string): string {
  const escaped = input.replace(/[%_]/g, (match) => `\\${match}`);
  return `%${escaped}%`;
}

function emptyGroup(type: SearchResultType): SearchResultGroup {
  return { type, label: SEARCH_GROUP_LABELS[type], results: [] };
}

/** Comenzi — reutilizeaza `listOrders({ search })` (order_number SAU numele clientului). */
async function searchOrders(
  query: string,
  limit: number,
  role: UserRole,
): Promise<SearchResultGroup> {
  const rows = await listOrders({ search: query });
  const ordersPath = role === "client" ? "/comenzile-mele" : "/comenzi";

  return {
    type: "order",
    label: SEARCH_GROUP_LABELS.order,
    results: rows.slice(0, limit).map((row) => ({
      type: "order",
      id: row.id,
      label: row.orderNumber ?? `Comandă ${row.id.slice(0, 8)}`,
      sublabel: `${row.clientName} · ${ORDER_STATUS_LABELS[row.status]}`,
      href: `${ordersPath}/${row.id}`,
    })),
  };
}

/** Clienti (doar staff) — reutilizeaza `listClients({ search })` (name SAU cui). */
async function searchClients(query: string, limit: number): Promise<SearchResultGroup> {
  const rows = await listClients({ search: query });

  return {
    type: "client",
    label: SEARCH_GROUP_LABELS.client,
    results: rows.slice(0, limit).map((row) => ({
      type: "client",
      id: row.id,
      label: row.name,
      sublabel: row.cui,
      href: `/clienti/${row.id}`,
    })),
  };
}

/** Itemi (staff) — reutilizeaza `listItems({ search })` (titlu). */
async function searchItems(query: string, limit: number): Promise<SearchResultGroup> {
  const rows = await listItems({ search: query });

  return {
    type: "item",
    label: SEARCH_GROUP_LABELS.item,
    results: rows.slice(0, limit).map((row) => ({
      type: "item",
      id: row.id,
      label: row.title,
      sublabel: row.sellable ? "Vandabil" : "Nevandabil",
      href: `/itemi/${row.id}`,
    })),
  };
}

/**
 * Itemi (client, catalog) — reutilizeaza `listCatalogItems({ search })`, care
 * aplica deja `sellable=true` + RLS `items_client_catalog`. Catalogul clientului
 * (`/catalog`) nu are ecran de detaliu per item — link-ul duce la lista.
 */
async function searchCatalogItems(query: string, limit: number): Promise<SearchResultGroup> {
  const rows = await listCatalogItems({ search: query });

  return {
    type: "item",
    label: SEARCH_GROUP_LABELS.item,
    results: rows.slice(0, limit).map((row) => ({
      type: "item",
      id: row.id,
      label: row.title,
      sublabel: row.unit,
      href: "/catalog",
    })),
  };
}

/**
 * Loturi (doar staff, "via item" — lots nu are un camp text propriu de cautat,
 * doar `source`/`entry_date`). In doi pasi (ca `orders/queries.ts#summarizeOrderItems`):
 * gaseste itemii al caror titlu se potriveste, apoi loturile lor. Ecranul /stoc
 * nu are pagina de detaliu per lot — link-ul filtreaza lista dupa item.
 */
async function searchLots(query: string, limit: number): Promise<SearchResultGroup> {
  const supabase = await createClient();
  const pattern = toIlikePattern(query);

  const { data: matchingItems, error: itemsError } = await supabase
    .from("items")
    .select("id")
    .ilike("title", pattern)
    .limit(limit * 3);
  if (itemsError) throw new Error("Nu am putut căuta loturile.");

  const itemIds = (matchingItems ?? []).map((row) => row.id);
  if (itemIds.length === 0) return emptyGroup("lot");

  const { data: lotRows, error: lotsError } = await supabase
    .from("lots")
    .select("id, item_id, source, entry_date, items(title)")
    .in("item_id", itemIds)
    .order("entry_date", { ascending: false })
    .limit(limit);
  if (lotsError) throw new Error("Nu am putut căuta loturile.");

  return {
    type: "lot",
    label: SEARCH_GROUP_LABELS.lot,
    results: (lotRows ?? []).map((row) => {
      const entryDate = dateFormatter.format(new Date(row.entry_date));
      return {
        type: "lot" as const,
        id: row.id,
        label: row.items?.title ?? "—",
        sublabel: row.source ? `${row.source} · ${entryDate}` : entryDate,
        href: `/stoc?item_id=${row.item_id}`,
      };
    }),
  };
}

/** Certificate — cautare directa dupa `number`, RLS izoleaza automat pe rol. */
async function searchCertificates(
  query: string,
  limit: number,
  role: UserRole,
): Promise<SearchResultGroup> {
  const supabase = await createClient();
  const pattern = toIlikePattern(query);

  const { data, error } = await supabase
    .from("certificates")
    .select("id, number, order_id, orders(order_number)")
    .ilike("number", pattern)
    .limit(limit);
  if (error) throw new Error("Nu am putut căuta certificatele.");

  const ordersPath = role === "client" ? "/comenzile-mele" : "/comenzi";

  return {
    type: "certificate",
    label: SEARCH_GROUP_LABELS.certificate,
    results: (data ?? []).map((row) => ({
      type: "certificate" as const,
      id: row.id,
      label: row.number,
      sublabel: row.orders?.order_number ?? null,
      href: `${ordersPath}/${row.order_id}/certificat`,
    })),
  };
}

/** Ordoneaza grupurile canonic si omite grupurile fara rezultate. */
function orderAndFilterGroups(groups: SearchResultGroup[]): SearchResultGroup[] {
  const byType = new Map(groups.map((group) => [group.type, group]));
  return SEARCH_GROUP_ORDER.map((type) => byType.get(type)).filter(
    (group): group is SearchResultGroup => group !== undefined && group.results.length > 0,
  );
}

/**
 * Cautare globala cross-entitate, respectand rolul apelantului:
 * - **staff** (admin/operator): comenzi, clienti, loturi, itemi, certificate —
 *   toate din organizatia curenta (RLS `*_staff_all`).
 * - **client**: DOAR comenzile proprii, certificatele proprii si catalogul
 *   (`sellable=true`) — NICIODATA `clients`/`lots` (nici macar interogate: apararea
 *   in profunzime nu se bazeaza doar pe RLS, desi RLS oricum ar bloca `lots`).
 * - alt rol (ex. `super_admin`, fara organizatie) → fara rezultate.
 *
 * Toate interogarile folosesc clientul UTILIZATORULUI curent (`createClient()`,
 * legat de cookie-urile cererii) — izolarea multi-tenant vine din RLS, ca in
 * restul `features/*​/queries.ts`.
 */
export async function globalSearch(
  query: string,
  options: GlobalSearchOptions,
): Promise<SearchResultGroup[]> {
  const trimmed = query.trim();
  if (!trimmed) return [];

  const { role, limit = DEFAULT_LIMIT } = options;

  if (role === "client") {
    const [orders, certificates, items] = await Promise.all([
      searchOrders(trimmed, limit, role),
      searchCertificates(trimmed, limit, role),
      searchCatalogItems(trimmed, limit),
    ]);
    return orderAndFilterGroups([orders, certificates, items]);
  }

  if (isStaffRole(role)) {
    const [orders, clients, lots, items, certificates] = await Promise.all([
      searchOrders(trimmed, limit, role),
      searchClients(trimmed, limit),
      searchLots(trimmed, limit),
      searchItems(trimmed, limit),
      searchCertificates(trimmed, limit, role),
    ]);
    return orderAndFilterGroups([orders, clients, lots, items, certificates]);
  }

  return [];
}
