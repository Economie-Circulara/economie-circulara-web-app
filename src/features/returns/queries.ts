import { createClient } from "@/lib/supabase/server";
import type { OrderReturnLink, ReturnableItem } from "./types";

/**
 * Itemii unei comenzi cu cantitatea inca returnabila = cantitatea din linia
 * originala minus tot ce a fost deja cerut in comenzi-retur/garantie legate
 * (order_links, tip return/warranty) si neanulate. Nu impune aici statusul
 * comenzii originale (delivered/closed) — asta e o regula de business
 * (`service.ts#loadOriginalOrderForReturn`), aceasta functie e o interogare pura.
 * Comanda inexistenta sau fara acces (RLS) -> listă goală (acelasi tratament ca
 * `getOrderStatus` din features/orders/queries.ts pt. cazuri "not found").
 */
export async function getReturnableItems(orderId: string): Promise<ReturnableItem[]> {
  const supabase = await createClient();

  const { data: order, error: orderError } = await supabase
    .from("orders")
    .select("id")
    .eq("id", orderId)
    .maybeSingle();
  if (orderError) throw new Error("Nu am putut verifica comanda.");
  if (!order) return [];

  const { data: itemRows, error: itemsError } = await supabase
    .from("order_items")
    .select("id, item_id, quantity, items(title, unit)")
    .eq("order_id", orderId)
    .order("created_at", { ascending: true });
  if (itemsError) throw new Error("Nu am putut incarca liniile comenzii.");

  const { data: linkRows, error: linksError } = await supabase
    .from("order_links")
    .select("linked_order_id")
    .eq("original_order_id", orderId)
    .in("link_type", ["return", "warranty"]);
  if (linksError) throw new Error("Nu am putut incarca legaturile de retur.");

  const linkedOrderIds = (linkRows ?? []).map((row) => row.linked_order_id);

  // Excludem comenzile-retur anulate — cantitatea lor NU mai blocheaza un retur nou.
  let activeLinkedOrderIds: string[] = [];
  if (linkedOrderIds.length > 0) {
    const { data: linkedOrders, error: linkedOrdersError } = await supabase
      .from("orders")
      .select("id, status")
      .in("id", linkedOrderIds);
    if (linkedOrdersError) throw new Error("Nu am putut verifica comenzile de retur legate.");
    activeLinkedOrderIds = (linkedOrders ?? [])
      .filter((row) => row.status !== "cancelled")
      .map((row) => row.id);
  }

  const returnedByItem = new Map<string, number>();
  if (activeLinkedOrderIds.length > 0) {
    const { data: returnedRows, error: returnedError } = await supabase
      .from("order_items")
      .select("item_id, quantity")
      .in("order_id", activeLinkedOrderIds);
    if (returnedError) throw new Error("Nu am putut calcula cantitățile deja returnate.");
    for (const row of returnedRows ?? []) {
      returnedByItem.set(
        row.item_id,
        (returnedByItem.get(row.item_id) ?? 0) + Number(row.quantity),
      );
    }
  }

  return (itemRows ?? []).map((row) => {
    const ordered = Number(row.quantity);
    const alreadyReturned = returnedByItem.get(row.item_id) ?? 0;
    return {
      orderItemId: row.id,
      itemId: row.item_id,
      itemTitle: row.items?.title ?? "—",
      unit: row.items?.unit ?? "kg",
      orderedQuantity: ordered,
      alreadyReturnedQuantity: alreadyReturned,
      returnableQuantity: Math.max(0, ordered - alreadyReturned),
    };
  });
}

/**
 * Daca `orderId` e ea insăși o comandă-retur/garanție/inlocuire (adica apare ca
 * `linked_order_id` intr-un `order_links`), intoarce tipul legaturii + comanda
 * originala. `null` daca e o comanda obisnuita (fara legatura). Folosit in
 * ecranul de detaliu (Task F) ca sa ascunda butoanele generice de tranziție
 * (`OrderStatusActions`, gandite pt. comenzi de vanzare) pe comenzile de tip
 * return/warranty, care au propriul flux de acceptare (`acceptReturnAction`).
 */
export async function getReturnLinkForOrder(orderId: string): Promise<OrderReturnLink | null> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("order_links")
    .select("link_type, original_order_id")
    .eq("linked_order_id", orderId)
    .limit(1);
  if (error) throw new Error("Nu am putut verifica legăturile comenzii.");
  const row = data?.[0];
  if (!row) return null;
  return { linkType: row.link_type, originalOrderId: row.original_order_id };
}
