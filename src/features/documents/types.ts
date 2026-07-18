import type { Database } from "@/lib/database.types";

export type DocumentOwnerType = Database["public"]["Enums"]["document_owner_type"];

export const DOCUMENT_OWNER_TYPES: DocumentOwnerType[] = ["client", "order", "item"];

export function isDocumentOwnerType(value: string): value is DocumentOwnerType {
  return (DOCUMENT_OWNER_TYPES as string[]).includes(value);
}

/** Un document, asa cum il returneaza `service.ts` (mapat din tabelul `documents`). */
export interface DocumentRecord {
  id: string;
  ownerType: DocumentOwnerType;
  ownerId: string;
  fileName: string;
  filePath: string;
  mimeType: string | null;
  sizeBytes: number | null;
  description: string | null;
  uploadedBy: string | null;
  createdAt: string;
}
