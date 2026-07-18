"use client";

import { useActionState, useState, useTransition } from "react";
import { FileText } from "lucide-react";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/empty-state";
import { initialDocumentActionState } from "./action-state";
import { deleteDocumentAction, getDownloadUrlAction } from "./actions";
import type { DocumentRecord } from "./types";

const dateFormatter = new Intl.DateTimeFormat("ro-RO", { dateStyle: "medium" });

function formatSize(bytes: number | null): string {
  if (bytes == null) return "—";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function DocumentRow({
  document,
  canDelete,
  revalidatePath,
}: {
  document: DocumentRecord;
  canDelete: boolean;
  revalidatePath: string;
}) {
  const [downloadPending, startDownload] = useTransition();
  const [downloadError, setDownloadError] = useState<string | null>(null);
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [deleteState, deleteAction, deletePending] = useActionState(
    deleteDocumentAction,
    initialDocumentActionState,
  );

  function handleDownload() {
    setDownloadError(null);
    startDownload(async () => {
      const result = await getDownloadUrlAction(document.id);
      if (result.url) {
        window.open(result.url, "_blank", "noopener,noreferrer");
      } else {
        setDownloadError(result.error ?? "Nu am putut genera link-ul de descărcare.");
      }
    });
  }

  return (
    <li className="flex flex-col gap-2 rounded-lg border bg-card p-3 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex items-start gap-3">
        <FileText className="mt-0.5 size-5 shrink-0 text-muted-foreground" />
        <div className="space-y-0.5">
          <p className="text-sm font-medium">{document.fileName}</p>
          <p className="text-xs text-muted-foreground">
            {document.description ? `${document.description} · ` : ""}
            {formatSize(document.sizeBytes)} · {dateFormatter.format(new Date(document.createdAt))}
          </p>
          {downloadError ? <p className="text-xs text-danger">{downloadError}</p> : null}
          {deleteState.error ? <p className="text-xs text-danger">{deleteState.error}</p> : null}
        </div>
      </div>

      <div className="flex shrink-0 items-center gap-2 self-end sm:self-auto">
        <Button
          type="button"
          size="sm"
          variant="outline"
          onClick={handleDownload}
          disabled={downloadPending}
        >
          {downloadPending ? "Se generează..." : "Descarcă"}
        </Button>

        {canDelete ? (
          confirmingDelete ? (
            <form action={deleteAction} className="flex items-center gap-2">
              <input type="hidden" name="document_id" value={document.id} />
              <input type="hidden" name="revalidate_path" value={revalidatePath} />
              <Button
                type="button"
                size="sm"
                variant="ghost"
                onClick={() => setConfirmingDelete(false)}
              >
                Anulează
              </Button>
              <Button type="submit" size="sm" variant="destructive" disabled={deletePending}>
                {deletePending ? "Se șterge..." : "Confirmă"}
              </Button>
            </form>
          ) : (
            <Button
              type="button"
              size="sm"
              variant="ghost"
              onClick={() => setConfirmingDelete(true)}
            >
              Șterge
            </Button>
          )
        ) : null}
      </div>
    </li>
  );
}

export interface DocumentListProps {
  documents: DocumentRecord[];
  /** Doar staff poate sterge (vezi `deleteDocument` in service.ts). */
  canDelete?: boolean;
  /** Path de revalidat dupa stergere (ex. `/clienti/{id}`). */
  revalidatePath: string;
}

export function DocumentList({ documents, canDelete = false, revalidatePath }: DocumentListProps) {
  if (documents.length === 0) {
    return (
      <EmptyState
        icon={<FileText />}
        title="Niciun document"
        description="Documentele atașate (inclusiv contracte arhivate) apar aici."
      />
    );
  }

  return (
    <ul className="space-y-2">
      {documents.map((document) => (
        <DocumentRow
          key={document.id}
          document={document}
          canDelete={canDelete}
          revalidatePath={revalidatePath}
        />
      ))}
    </ul>
  );
}
