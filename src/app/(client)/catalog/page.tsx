import { PageHeader } from "@/components/page-header";
import { requireRole } from "@/features/auth/session";
import { listClientAddresses } from "@/features/clients/queries";
import { CatalogView } from "@/features/client-portal/catalog-view";
import { listCatalogItems } from "@/features/client-portal/queries";

export const metadata = { title: "Catalog — Lateris Trace" };

/** Ecranul „Catalog" (Task H): produse vandabile, cos, formular de comanda — fara preturi. */
export default async function CatalogPage() {
  const user = await requireRole(["client"]);

  const [items, addresses] = await Promise.all([
    listCatalogItems(),
    user.clientId ? listClientAddresses(user.clientId) : Promise.resolve([]),
  ]);

  return (
    <div className="space-y-4">
      <PageHeader title="Catalog" description="Adaugă produse în coș și trimite o comandă nouă." />
      <CatalogView items={items} addresses={addresses} />
    </div>
  );
}
