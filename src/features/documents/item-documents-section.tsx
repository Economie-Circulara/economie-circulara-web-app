import { DocumentList } from "./document-list";
import { DocumentUpload } from "./document-upload";
import type { DocumentRecord } from "./types";

export interface ItemDocumentsSectionProps {
  itemId: string;
  documents: DocumentRecord[];
  /** Produsul e vandabil: documentele lui le vad si clientii (RLS `documents_client_select`). */
  sellable: boolean;
  revalidatePath: string;
}

/**
 * Documentele unui material / abonament / al retetei lui (decizie 2026-10-08): ex.
 * raportul de laborator al retetei, fisa tehnica. Apar automat in sectiunea
 * „Documente” a comenzilor care contin produsul. Folosita pe `/itemi/[id]`,
 * `/abonamente/[id]` si `/retete/[itemId]` (reteta = produsul ei, acelasi owner).
 */
export function ItemDocumentsSection({
  itemId,
  documents,
  sellable,
  revalidatePath,
}: ItemDocumentsSectionProps) {
  return (
    <section className="max-w-3xl space-y-3">
      <div className="space-y-1">
        <h2 className="text-lg font-semibold">Documente</h2>
        <p className="text-sm text-muted-foreground">
          Rapoarte de laborator, fișe tehnice, poze. Apar la comenzile care conțin acest produs
          {sellable
            ? " - și clienților, în portal, pentru că produsul e vandabil."
            : " (doar pentru echipă: produsul nu e vandabil, deci clienții nu le văd)."}
        </p>
      </div>
      <DocumentUpload
        ownerType="item"
        ownerId={itemId}
        revalidatePath={revalidatePath}
        suggestions={["Raport de laborator", "Fișă tehnică", "Declarație de conformitate"]}
      />
      <DocumentList
        documents={documents}
        canDelete
        revalidatePath={revalidatePath}
        emptyDescription="Niciun document încă - de exemplu raportul de laborator al rețetei."
      />
    </section>
  );
}
