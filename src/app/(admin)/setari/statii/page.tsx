import Link from "next/link";
import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { requireRole } from "@/features/auth/session";
import { listSites } from "@/features/routing/site-queries";
import { SiteSection } from "@/features/routing/site-section";

export const metadata = { title: "Puncte de plecare - Lot cu Lot" };

/**
 * Ecranul "Puncte de plecare" (statii de betoane / depozite) - originea folosita
 * la calculul rutelor de livrare (Task X7). Doar staff (admin/operator).
 */
export default async function SitesPage() {
  await requireRole(["admin"]);
  const sites = await listSites();

  return (
    <div className="space-y-6">
      <PageHeader
        title="Puncte de plecare"
        breadcrumbs={[{ label: "Setari", href: "/setari" }, { label: "Puncte de plecare" }]}
        description="Stațiile/depozitele de unde pleacă livrările - folosite la calculul rutelor."
        actions={
          <Button asChild variant="outline">
            <Link href="/setari">Înapoi la setări</Link>
          </Button>
        }
      />

      <SiteSection sites={sites} />
    </div>
  );
}
