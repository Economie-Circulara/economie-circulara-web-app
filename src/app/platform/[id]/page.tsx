import Link from "next/link";
import { notFound } from "next/navigation";
import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { requireRole } from "@/features/auth/session";
import { OrgAppearanceForm } from "@/features/platform/org-appearance-form";
import { getOrganizationSummary } from "@/features/platform/queries";

export const metadata = { title: "Organizatie - Platforma" };

interface PageProps {
  params: Promise<{ id: string }>;
}

/** Tema vizuala + domeniul propriu ale unei organizatii (super-admin). */
export default async function OrganizationPage({ params }: PageProps) {
  await requireRole(["super_admin"]);
  const { id } = await params;
  const org = await getOrganizationSummary(id);
  if (!org) notFound();

  return (
    <div className="space-y-6">
      <PageHeader
        title={org.name}
        breadcrumbs={[{ label: "Organizatii", href: "/platform" }, { label: org.name }]}
        description={`Slug ${org.slug} · acces ${org.accessUrl}`}
        actions={
          <Button asChild variant="outline">
            <Link href="/platform">Inapoi la lista</Link>
          </Button>
        }
      />
      <OrgAppearanceForm
        organizationId={org.id}
        theme={org.theme}
        customDomain={org.customDomain}
      />
    </div>
  );
}
