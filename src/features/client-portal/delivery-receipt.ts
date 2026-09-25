import { createClient } from "@/lib/supabase/server";

/**
 * Clientul confirma receptia livrarii comenzii proprii - RPC-ul
 * `client_confirm_delivery_receipt` (0045): autorizare explicita (comanda proprie,
 * livrare activa, comanda `accepted`) + atomic receptie si `accepted -> delivered`.
 * Mesajele de eroare (DR001-DR004) vin gata in romana din RPC.
 */
export async function confirmClientDeliveryReceipt(
  orderId: string,
  receivedByName: string,
  notes: string | null,
): Promise<void> {
  const supabase = await createClient();
  const { error } = await supabase.rpc("client_confirm_delivery_receipt", {
    p_order_id: orderId,
    p_received_by_name: receivedByName,
    p_notes: notes ?? undefined,
  });
  if (error) throw new Error(error.message || "Nu am putut confirma recepția.");
}
