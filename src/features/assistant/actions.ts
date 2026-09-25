"use server";

import { requireUser } from "@/features/auth/session";
import {
  attachmentReference,
  MAX_ATTACHMENTS_PER_MESSAGE,
  type AttachmentMeta,
} from "./attachment-rules";
import { AttachmentError, getAttachment, registerAttachment } from "./attachments";
import { confirmAction, rejectAction, runAssistantTurn } from "./run";
import type { AssistantTurn, ToolContext } from "./types";

/** Contextul de tool pentru utilizatorul autentificat curent. */
async function currentContext(): Promise<ToolContext> {
  const user = await requireUser();
  return {
    userId: user.id,
    role: user.role,
    organizationId: user.organizationId,
    clientId: user.clientId,
  };
}

/** Doar staff-ul ataseaza fisiere: clientul nu are tool-uri care sa le foloseasca. */
function canAttach(ctx: ToolContext): boolean {
  return ctx.role === "admin" || ctx.role === "operator";
}

export type PrepareAttachmentResult =
  | { ok: true; attachment: AttachmentMeta; path: string; token: string }
  | { ok: false; error: string };

/**
 * Pasul 1 al unui atasament: validare + inregistrare + URL semnat de upload. Pasul 2
 * (upload-ul efectiv) il face browserul direct in Storage - vezi `assistant-chat.tsx`.
 */
export async function prepareAssistantAttachmentAction(file: {
  name: string;
  type: string;
  size: number;
}): Promise<PrepareAttachmentResult> {
  const ctx = await currentContext();
  if (!canAttach(ctx)) return { ok: false, error: "Contul tău nu poate atașa fișiere." };
  try {
    return { ok: true, ...(await registerAttachment(ctx, file)) };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof AttachmentError ? err.message : "Nu am putut pregăti fișierul.",
    };
  }
}

/**
 * Referintele la atasamentele VALIDE ale utilizatorului curent (RLS), ca linii adaugate
 * la mesaj. ID-urile straine sau inexistente sunt ignorate.
 */
async function attachmentLines(ctx: ToolContext, ids: string[] | undefined): Promise<string[]> {
  if (!ids?.length || !canAttach(ctx)) return [];
  const unique = [...new Set(ids)].slice(0, MAX_ATTACHMENTS_PER_MESSAGE);
  const found = await Promise.all(unique.map((id) => getAttachment(id)));
  return found.flatMap((attachment) => (attachment ? [attachmentReference(attachment)] : []));
}

export async function sendAssistantMessageAction(input: {
  conversationId: string | null;
  message: string;
  attachmentIds?: string[];
}): Promise<AssistantTurn> {
  const ctx = await currentContext();
  const lines = await attachmentLines(ctx, input.attachmentIds);
  const text = input.message.trim() || (lines.length ? "Am atașat:" : "");
  const message = [text, ...lines].join("\n").trim();

  if (!message) {
    const { getQuotaStatus } = await import("./quota");
    return {
      conversationId: input.conversationId ?? "",
      reply: "Scrie o întrebare sau o cerere.",
      pendingAction: null,
      quota: await getQuotaStatus(ctx),
    };
  }

  return runAssistantTurn({ conversationId: input.conversationId, message, ctx });
}

export async function confirmAssistantActionAction(input: {
  toolCallId: string;
  overrides?: Record<string, unknown>;
}): Promise<AssistantTurn> {
  const ctx = await currentContext();
  return confirmAction({ toolCallId: input.toolCallId, ctx, overrides: input.overrides });
}

export async function rejectAssistantActionAction(input: {
  toolCallId: string;
}): Promise<AssistantTurn> {
  const ctx = await currentContext();
  return rejectAction({ toolCallId: input.toolCallId, ctx });
}
