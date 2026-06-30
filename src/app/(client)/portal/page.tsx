import { PageHeader } from "@/components/page-header";

export const metadata = { title: "Portal — Lateris Trace" };

/** Portalul clientului (catalog, comenzi proprii). Continutul vine in Wave 2 (Task H). */
export default function PortalPage() {
  return (
    <div className="space-y-4">
      <PageHeader title="Portal client" description="Catalogul si comenzile tale." />
      <p className="text-sm text-muted-foreground">
        Catalogul, comenzile si documentele tale apar aici in Wave 2.
      </p>
    </div>
  );
}
