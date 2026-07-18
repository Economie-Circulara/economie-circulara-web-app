import Link from "next/link";
import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { requireRole } from "@/features/auth/session";
import { listOrganizations } from "@/features/platform/queries";
import { OrganizationsTable } from "@/features/platform/organizations-table";

export const metadata = { title: "Organizatii — Platforma Lateris Trace" };

/** Lista organizatiilor platformei (management super-admin). */
export default async function PlatformPage() {
  await requireRole(["super_admin"]);
  const organizations = await listOrganizations();

  return (
    <div className="space-y-6">
      <PageHeader
        title="Organizatii"
        description="Toate organizatiile platformei — nume, slug, domeniu custom, status si numarul de utilizatori."
        actions={
          <Button asChild>
            <Link href="/platform/nou">+ Organizatie noua</Link>
          </Button>
        }
      />
      <p className="rounded-md border border-dashed bg-card/50 px-3 py-2 text-xs text-muted-foreground">
        O organizatie <strong>suspendata</strong> nu ar trebui sa mai permita acces userilor ei
        (admin/operator/client) — statusul e salvat pe organizatie (
        <code>organizations.status</code>) si trebuie verificat de fiecare cerere/sesiune a
        tenantului respectiv.
      </p>
      <OrganizationsTable organizations={organizations} />
    </div>
  );
}
