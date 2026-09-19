import { PageHeader } from "@/components/page-header";
import { requireRole } from "@/features/auth/session";
import { listClientAddresses } from "@/features/clients/queries";
import { AportForm } from "@/features/client-portal/aport-form";
import { listIntakeItemOptions } from "@/features/orders/queries";

export const metadata = { title: "Aport material - Lot cu Lot" };

/**
 * Ecranul "Aport material" (client self-service): cerere de aport - materialul
 * fizic pe care clientul vrea sa-l aduca organizatiei (ex. moloz de demolare),
 * spre deosebire de /catalog (vanzare, organizatie -> client). Creeaza o comanda
 * `aport` in status `draft`; acceptarea (care creste stocul) ramane exclusiv la
 * staff, din /comenzi/[id] (`AcceptIntakeButton`).
 *
 * `listIntakeItemOptions` (definita pentru /comenzi/nou, ecranul staff) e refolosita
 * ca atare: nu are niciun `requireRole` in interior, doar RLS (`items_client_intake`,
 * migrarea 0033) decide ce randuri se intorc - pentru un client, exact itemii
 * fizici trasati din organizatia lui.
 */
export default async function AportNouPage() {
  const user = await requireRole(["client"]);

  const [items, addresses] = await Promise.all([
    listIntakeItemOptions(),
    user.clientId ? listClientAddresses(user.clientId) : Promise.resolve([]),
  ]);

  return (
    <div className="space-y-4">
      <PageHeader
        title="Aport material"
        description="Trimite o cerere de aport - materialul pe care vrei să-l aduci către organizație, spre reciclare."
      />
      <AportForm items={items} addresses={addresses} />
    </div>
  );
}
