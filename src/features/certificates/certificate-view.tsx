"use client";

import { useState, useTransition } from "react";
import { Download, Printer } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { DocumentList } from "@/features/documents/document-list";
import type { DocumentRecord } from "@/features/documents/types";
import { SankeyDiagram } from "@/features/production/sankey-diagram";
import { getCertificateDownloadUrlAction } from "./actions";
import type { TraceabilitySnapshot } from "./types";

const dateFormatter = new Intl.DateTimeFormat("ro-RO", { dateStyle: "medium" });
const qtyFormatter = new Intl.NumberFormat("ro-RO");

export interface CertificateViewProps {
  certificateId: string;
  number: string;
  issuedAt: string;
  orgName: string;
  snapshot: TraceabilitySnapshot;
  documents: DocumentRecord[];
}

/**
 * Ecranul „Certificat" (mockup docs/design/Lateris_Trace.dc.html#CERTIFICAT) —
 * randat din snapshot-ul INGHETAT (`certificates.traceability_snapshot`), nu din
 * date live: graful si tabelul „Materiale și origine" raman identice chiar daca
 * stocul se schimba ulterior. Graful reutilizeaza `SankeyDiagram` (Task D) —
 * nicio logica SVG noua, doar date cu mai multe coloane (surse → loturi →
 * procese → lot produs → livrare).
 */
export function CertificateView({
  certificateId,
  number,
  issuedAt,
  orgName,
  snapshot,
  documents,
}: CertificateViewProps) {
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function handleDownload() {
    setError(null);
    startTransition(async () => {
      const result = await getCertificateDownloadUrlAction(certificateId);
      if (result.url) {
        window.open(result.url, "_blank", "noopener,noreferrer");
      } else {
        setError(result.error ?? "Nu am putut genera link-ul de descărcare.");
      }
    });
  }

  return (
    <div className="flex flex-col items-center gap-4">
      <div className="flex w-full max-w-4xl items-center justify-end gap-2 print:hidden">
        {error ? <p className="mr-auto text-sm text-danger">{error}</p> : null}
        <Button variant="outline" onClick={() => window.print()}>
          <Printer className="size-4" />
          Tipărește
        </Button>
        <Button onClick={handleDownload} disabled={isPending}>
          <Download className="size-4" />
          {isPending ? "Se generează…" : "Descarcă PDF"}
        </Button>
      </div>

      <Card className="w-full max-w-4xl overflow-hidden p-0">
        <div className="h-1.5 bg-accent" />
        <CardContent className="space-y-6 p-10">
          <div className="flex items-start justify-between border-b-2 border-foreground pb-6">
            <div>
              <p className="text-xl font-extrabold tracking-tight">{orgName}</p>
              <p className="text-xs text-muted-foreground">Materiale de construcții circulare</p>
            </div>
            <div className="text-right">
              <p className="font-serif text-lg font-semibold">Certificat de trasabilitate</p>
              <p className="mt-1 font-mono text-xs text-muted-foreground">Nr. {number}</p>
              <p className="font-mono text-xs text-muted-foreground">
                Emis: {dateFormatter.format(new Date(issuedAt))}
              </p>
            </div>
          </div>

          <div className="grid gap-5 sm:grid-cols-3">
            <div>
              <p className="font-mono text-[11px] uppercase tracking-wide text-muted-foreground">
                Client
              </p>
              <p className="mt-1 text-sm font-semibold">{snapshot.order.clientName}</p>
              <p className="text-xs text-muted-foreground">{snapshot.order.clientCui}</p>
            </div>
            <div>
              <p className="font-mono text-[11px] uppercase tracking-wide text-muted-foreground">
                Comandă
              </p>
              <p className="mt-1 text-sm font-semibold">{snapshot.order.number ?? "—"}</p>
            </div>
            <div>
              <p className="font-mono text-[11px] uppercase tracking-wide text-muted-foreground">
                Produs(e) livrat(e)
              </p>
              {snapshot.deliveredItems.map((item) => (
                <p key={item.itemId} className="mt-1 text-sm font-semibold">
                  {item.itemTitle}{" "}
                  <span className="font-normal text-muted-foreground">
                    · {qtyFormatter.format(item.quantity)} {item.unit}
                  </span>
                </p>
              ))}
            </div>
          </div>

          <div className="rounded-xl border bg-muted/40 p-5">
            <div className="mb-1 flex items-center justify-between">
              <p className="text-sm font-bold">Lanț de trasabilitate</p>
              <p className="font-mono text-[11px] text-muted-foreground">
                surse → loturi → proces → produs → livrare
              </p>
            </div>
            <SankeyDiagram data={snapshot.graph} height={300} />
          </div>

          <div>
            <p className="mb-2 text-sm font-bold">Materiale și origine</p>
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-left font-mono text-[11px] uppercase tracking-wide text-muted-foreground">
                  <th className="py-2 font-medium">Material</th>
                  <th className="px-2 py-2 font-medium">Origine</th>
                  <th className="px-2 py-2 font-medium">Sursă</th>
                  <th className="py-2 text-right font-medium">Pondere</th>
                </tr>
              </thead>
              <tbody>
                {snapshot.materials.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="py-4 text-center text-muted-foreground">
                      Fără materiale identificate.
                    </td>
                  </tr>
                ) : (
                  snapshot.materials.map((row, index) => (
                    <tr key={`${row.material}-${index}`} className="border-b">
                      <td className="py-2.5 font-medium">{row.material}</td>
                      <td className="px-2 py-2.5 text-muted-foreground">{row.origin}</td>
                      <td className="px-2 py-2.5 text-muted-foreground">{row.source}</td>
                      <td className="py-2.5 text-right font-bold tabular-nums">
                        {row.percentage.toLocaleString("ro-RO", { minimumFractionDigits: 1 })}%
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          <div className="flex items-start gap-6">
            <div className="flex-1">
              <p className="mb-2 text-sm font-bold">Documente atașate</p>
              <DocumentList documents={documents} canDelete={false} revalidatePath="" />
            </div>
            <div className="w-48 text-center">
              <p className="border-b border-foreground pb-1.5 font-serif text-base italic text-primary">
                {orgName}
              </p>
              <p className="mt-1.5 text-[11px] text-muted-foreground">
                Semnătură &amp; ștampilă electronică
              </p>
            </div>
          </div>
        </CardContent>
        <div className="flex justify-between bg-primary px-10 py-3 font-mono text-[11px] text-primary-foreground">
          <span>{orgName} · trasabilitate emisă de Lateris Trace</span>
          <span>{number} · pagina 1/1</span>
        </div>
      </Card>
    </div>
  );
}
