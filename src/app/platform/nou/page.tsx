import Link from "next/link";
import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { requireRole } from "@/features/auth/session";
import { CreateOrganizationForm } from "@/features/platform/create-organization-form";

export const metadata = { title: "Organizatie noua — Platforma Lateris Trace" };

/** Creare organizatie + admin initial (invitatie prin email). */
export default async function NewOrganizationPage() {
  await requireRole(["super_admin"]);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Organizatie noua"
        breadcrumbs={[{ label: "Organizatii", href: "/platform" }, { label: "Organizatie noua" }]}
        description="Creeaza organizatia si invita adminul ei initial — primeste un email pentru a-si seta parola."
        actions={
          <Button asChild variant="outline">
            <Link href="/platform">Inapoi la lista</Link>
          </Button>
        }
      />
      <CreateOrganizationForm />
    </div>
  );
}
