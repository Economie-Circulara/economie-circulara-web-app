import Link from "next/link";
import { Award, FileText } from "lucide-react";
import { DocumentList } from "@/features/documents/document-list";
import { DocumentUpload } from "@/features/documents/document-upload";
import type { DocumentRecord } from "@/features/documents/types";

export interface ProductDocuments {
  itemId: string;
  itemTitle: string;
  documents: DocumentRecord[];
}

/**
 * Grupeaza documentele produselor pe liniile comenzii, in ordinea liniilor, fara
 * duplicate (acelasi produs pe doua linii) si fara produsele care nu au documente.
 */
export function groupProductDocuments(
  lines: { itemId: string; itemTitle: string }[],
  documents: DocumentRecord[],
): ProductDocuments[] {
  const seen = new Set<string>();
  const groups: ProductDocuments[] = [];
  for (const line of lines) {
    if (seen.has(line.itemId)) continue;
    seen.add(line.itemId);
    const own = documents.filter((doc) => doc.ownerType === "item" && doc.ownerId === line.itemId);
    if (own.length > 0) groups.push({ ...line, documents: own });
  }
  return groups;
}

export interface OrderDocumentsProps {
  orderId: string;
  /**
   * Avizul livrarii (tine loc de nota de comanda, 0056) - doar staff-ul il descarca:
   * contine date interne (erorile e-Transport). `null` = fara livrare planificata.
   */
  avizHref?: string | null;
  /** Fisa de trasabilitate - exista doar dupa inchiderea comenzii. */
  traceabilityHref: string | null;
  /** Documentele generale ale organizatiei (declaratii de conformitate, 0057). */
  generalDocuments: DocumentRecord[];
  /** Documentele atasate comenzii (ex. nota semnata, scanata). */
  orderDocuments: DocumentRecord[];
  /**
   * Documentele produselor de pe liniile comenzii (ex. raportul de laborator al
   * retetei), grupate pe produs. Produsele fara documente nu apar.
   */
  productDocuments?: ProductDocuments[];
  /** Staff: poate incarca/sterge documente pe comanda. */
  canManage: boolean;
  revalidatePath: string;
}

/**
 * Sectiunea „Documente” a unei comenzi (decizie 2026-10-08, intalnirea cu Macon XCX):
 * in locul butonului „Vezi certificat”, toate documentele comenzii intr-un loc -
 * cele generate de platforma (aviz / nota de comanda, fisa de trasabilitate), cele
 * generale ale organizatiei (declaratia de conformitate), cele ale produselor de pe
 * linii (ex. raportul de laborator al retetei) si cele atasate comenzii.
 * Folosita si de staff (`/comenzi/[id]`), si de client (`/comenzile-mele/[id]`).
 */
export function OrderDocuments({
  orderId,
  avizHref = null,
  traceabilityHref,
  generalDocuments,
  orderDocuments,
  productDocuments = [],
  canManage,
  revalidatePath,
}: OrderDocumentsProps) {
  const generated = [
    avizHref
      ? {
          key: "aviz",
          label: "Aviz de însoțire / notă de comandă",
          href: avizHref,
          cta: "Descarcă PDF",
        }
      : null,
    traceabilityHref
      ? {
          key: "trasabilitate",
          label: "Fișă de trasabilitate",
          href: traceabilityHref,
          cta: "Vezi fișa de trasabilitate",
        }
      : null,
  ].filter((doc) => doc !== null);

  return (
    <section className="space-y-4" aria-labelledby={`documente-${orderId}`}>
      <h2 id={`documente-${orderId}`} className="text-lg font-semibold">
        Documente
      </h2>

      <div className="space-y-2">
        <h3 className="text-sm font-medium text-muted-foreground">Generate de platformă</h3>
        {generated.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            {canManage
              ? "Avizul apare după planificarea livrării; fișa de trasabilitate, la închiderea comenzii."
              : "Fișa de trasabilitate apare la închiderea comenzii."}
          </p>
        ) : (
          <ul className="space-y-2">
            {generated.map((doc) => (
              <li
                key={doc.key}
                className="flex items-center justify-between gap-3 rounded-lg border bg-card p-3"
              >
                <span className="flex items-center gap-3 text-sm font-medium">
                  {doc.key === "trasabilitate" ? (
                    <Award className="size-5 shrink-0 text-muted-foreground" />
                  ) : (
                    <FileText className="size-5 shrink-0 text-muted-foreground" />
                  )}
                  {doc.label}
                </span>
                <Link
                  href={doc.href}
                  className="text-sm font-medium text-accent hover:underline"
                  {...(doc.key === "aviz" ? { target: "_blank", rel: "noopener noreferrer" } : {})}
                >
                  {doc.cta}
                </Link>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="space-y-2">
        <h3 className="text-sm font-medium text-muted-foreground">
          Documente generale (declarații de conformitate)
        </h3>
        {generalDocuments.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            {canManage
              ? "Nicio declarație încărcată - administratorul le adaugă din Setări → Documente generale."
              : "Organizația nu a publicat încă documente generale."}
          </p>
        ) : (
          <DocumentList documents={generalDocuments} revalidatePath={revalidatePath} />
        )}
      </div>

      {productDocuments.length > 0 ? (
        <div className="space-y-3">
          <h3 className="text-sm font-medium text-muted-foreground">
            Documentele produselor (rapoarte de laborator, fișe tehnice)
          </h3>
          {productDocuments.map((group) => (
            <div key={group.itemId} className="space-y-2">
              <p className="text-sm font-medium">{group.itemTitle}</p>
              <DocumentList documents={group.documents} revalidatePath={revalidatePath} />
            </div>
          ))}
        </div>
      ) : null}

      <div className="space-y-2">
        <h3 className="text-sm font-medium text-muted-foreground">Atașate comenzii</h3>
        {orderDocuments.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            {canManage
              ? "Niciun document atașat - de exemplu nota de comandă semnată, scanată."
              : "Niciun document atașat comenzii."}
          </p>
        ) : (
          <DocumentList
            documents={orderDocuments}
            canDelete={canManage}
            revalidatePath={revalidatePath}
          />
        )}
        {canManage ? (
          <DocumentUpload
            ownerType="order"
            ownerId={orderId}
            revalidatePath={revalidatePath}
            suggestions={["Notă de comandă semnată", "Aviz semnat", "Declarație de conformitate"]}
          />
        ) : null}
      </div>
    </section>
  );
}
