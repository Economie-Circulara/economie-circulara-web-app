import { PageHeader } from "@/components/page-header";
import { requireRole } from "@/features/auth/session";
import { deleteOwnAddressAction, upsertOwnAddressAction } from "@/features/client-portal/actions";
import { AddressSection } from "@/features/clients/address-section";
import { listClientAddresses } from "@/features/clients/queries";

export const metadata = { title: "Adresele mele - Lot cu Lot" };

/**
 * Agenda de adrese a clientului (0046): aceeasi sectiune ca la staff (/clienti/[id]),
 * cu actiunile clientului (firma vine din sesiune; RLS `client_addresses_client_*`).
 * Adresele de aici apar in formularele de comanda si de aport.
 */
export default async function AdreseleMelePage() {
  const user = await requireRole(["client"]);
  const addresses = user.clientId ? await listClientAddresses(user.clientId) : [];

  return (
    <div className="max-w-3xl space-y-4">
      <PageHeader
        title="Adresele mele"
        description="Adresele de livrare și de aport folosite în comenzile tale. Cea implicită e preselectată în formulare."
      />
      <AddressSection
        clientId={user.clientId ?? ""}
        addresses={addresses}
        upsertAction={upsertOwnAddressAction}
        deleteAction={deleteOwnAddressAction}
        emptyDescription="Adaugă prima adresă - o vei putea alege direct la comenzi și aporturi."
      />
    </div>
  );
}
