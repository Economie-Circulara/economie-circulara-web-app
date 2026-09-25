"use client";

import { Paperclip, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { createClient } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";
import { ActionCard } from "./action-card";
import {
  confirmAssistantActionAction,
  prepareAssistantAttachmentAction,
  rejectAssistantActionAction,
  sendAssistantMessageAction,
} from "./actions";
import {
  ATTACHMENT_ACCEPT,
  ATTACHMENT_BUCKET,
  attachmentReference,
  MAX_ATTACHMENTS_PER_MESSAGE,
  splitAttachmentReferences,
  validateAttachment,
  type AttachmentMeta,
} from "./attachment-rules";
import { ChatInput } from "./chat-input";
import { MessageMarkdown } from "./message-markdown";
import { PendingIndicator } from "./pending-indicator";
import { QuotaCard } from "./quota-card";
import type { AssistantTurn, PendingAction, QuotaStatus } from "./types";

export interface Bubble {
  id: string;
  role: "user" | "assistant";
  content: string;
}

/** Un fisier atasat la mesajul in curs de scriere. */
interface DraftAttachment {
  key: number;
  fileName: string;
  status: "uploading" | "ready" | "error";
  meta?: AttachmentMeta;
  error?: string;
}

/**
 * Upload in doi pasi (docs/plans/asistent-atasamente.md): serverul valideaza si emite un
 * URL semnat, browserul urca fisierul DIRECT in Storage - fara limita de 4.5MB a
 * cererilor catre server pe Vercel.
 */
async function uploadAttachment(file: File): Promise<AttachmentMeta> {
  const localError = validateAttachment(file);
  if (localError) throw new Error(localError);

  const prepared = await prepareAssistantAttachmentAction({
    name: file.name,
    type: file.type,
    size: file.size,
  });
  if (!prepared.ok) throw new Error(prepared.error);

  const { error } = await createClient()
    .storage.from(ATTACHMENT_BUCKET)
    // Tipul canonic hotarat de server (ex. `.md` fara tip in browser -> text/markdown).
    .uploadToSignedUrl(prepared.path, prepared.token, file, {
      contentType: prepared.attachment.mimeType,
    });
  if (error) throw new Error("Încărcarea fișierului a eșuat. Încearcă din nou.");
  return prepared.attachment;
}

/** Continutul unei bule de utilizator: textul + etichetele fisierelor atasate. */
function UserBubbleContent({ content }: { content: string }) {
  const { text, attachments } = splitAttachmentReferences(content);
  return (
    <>
      {text}
      {attachments.length ? (
        <span className="mt-2 flex flex-wrap gap-1.5">
          {attachments.map((attachment) => (
            <span
              key={attachment.id}
              className="inline-flex items-center gap-1 rounded-md border bg-card px-2 py-0.5 text-xs"
            >
              <Paperclip className="size-3" aria-hidden />
              {attachment.fileName}
            </span>
          ))}
        </span>
      ) : null}
    </>
  );
}

export function AssistantChat({
  initialConversationId,
  initialMessages,
  initialQuota,
  suggestions,
  providerConfigured,
  canAttach = false,
}: {
  initialConversationId: string | null;
  initialMessages: Bubble[];
  initialQuota: QuotaStatus;
  suggestions: string[];
  providerConfigured: boolean;
  /** Doar staff-ul ataseaza fisiere (clientul n-are tool-uri care sa le foloseasca). */
  canAttach?: boolean;
}) {
  const router = useRouter();
  const [bubbles, setBubbles] = useState<Bubble[]>(initialMessages);
  const [quota, setQuota] = useState(initialQuota);
  const [pending, setPending] = useState<PendingAction | null>(null);
  const [conversationId, setConversationId] = useState<string | null>(initialConversationId);
  const [draft, setDraft] = useState("");
  const [attachments, setAttachments] = useState<DraftAttachment[]>([]);
  const [isPending, startTransition] = useTransition();
  const nextId = useRef(0);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const columnRef = useRef<HTMLDivElement>(null);

  const blocked = quota.blockedReason !== null;

  // Scroll la ultimul mesaj - si la aparitia indicatorului de lucru (`PendingIndicator`), ca userul sa vada
  // imediat ca a pornit un raspuns, nu doar cand acesta soseste.
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [bubbles, isPending]);

  // Coloana de chat se intinde pana jos, ca sa scroleze doar zona de mesaje, nu toata
  // pagina. `main` din AppShell n-are inaltime fixa (creste cu continutul), deci nu
  // exista un procent CSS de "restul paginii" - masuram efectiv cat spatiu de viewport
  // ramane sub coloana (Topbar-ul de deasupra isi schimba inaltimea responsiv, n-are
  // sens fix). `p-4 sm:p-6` de pe `main` (AppShell) da padding-ul de jos de scazut.
  useEffect(() => {
    function updateHeight() {
      const el = columnRef.current;
      if (!el) return;
      const bottomPadding = window.innerWidth >= 640 ? 24 : 16;
      const available = window.innerHeight - el.getBoundingClientRect().top - bottomPadding;
      el.style.height = `${Math.max(available, 320)}px`;
    }
    updateHeight();
    window.addEventListener("resize", updateHeight);
    return () => window.removeEventListener("resize", updateHeight);
  }, []);

  function push(role: Bubble["role"], content: string) {
    nextId.current += 1;
    setBubbles((current) => [...current, { id: `b${nextId.current}`, role, content }]);
  }

  function apply(turn: AssistantTurn) {
    // Conversatie noua: doar actualizam URL-ul, fara reload - remount-ul complet (prin
    // `key` pe AssistantChat, vezi assistant-page-content.tsx) se intampla doar la
    // navigarea intre conversatii diferite, nu la aceasta tranzitie.
    if (turn.conversationId && conversationId === null) {
      setConversationId(turn.conversationId);
      router.replace(`/asistent/${turn.conversationId}`, { scroll: false });
    }
    setQuota(turn.quota);
    setPending(turn.pendingAction);
    push("assistant", turn.reply);
  }

  const readyAttachments = attachments.flatMap((attachment) =>
    attachment.status === "ready" && attachment.meta ? [attachment.meta] : [],
  );
  const uploading = attachments.some((attachment) => attachment.status === "uploading");

  function addFiles(files: FileList | null) {
    if (!files) return;
    const room = MAX_ATTACHMENTS_PER_MESSAGE - attachments.length;
    for (const file of Array.from(files).slice(0, Math.max(room, 0))) {
      nextId.current += 1;
      const key = nextId.current;
      setAttachments((current) => [...current, { key, fileName: file.name, status: "uploading" }]);
      uploadAttachment(file).then(
        (meta) =>
          setAttachments((current) =>
            current.map((item) => (item.key === key ? { ...item, status: "ready", meta } : item)),
          ),
        (err: unknown) =>
          setAttachments((current) =>
            current.map((item) =>
              item.key === key
                ? {
                    ...item,
                    status: "error",
                    error: err instanceof Error ? err.message : "Încărcarea a eșuat.",
                  }
                : item,
            ),
          ),
      );
    }
  }

  function send(message: string) {
    const text = message.trim();
    if ((!text && readyAttachments.length === 0) || isPending || uploading) return;

    const sent = readyAttachments;
    push(
      "user",
      [text || "Am atașat:", ...sent.map((attachment) => attachmentReference(attachment))].join(
        "\n",
      ),
    );
    setDraft("");
    setAttachments([]);
    setPending(null);

    startTransition(async () => {
      const turn = await sendAssistantMessageAction({
        conversationId,
        message: text,
        attachmentIds: sent.map((attachment) => attachment.id),
      });
      apply(turn);
    });
  }

  function confirm(overrides: Record<string, unknown>) {
    if (!pending || isPending) return;
    const toolCallId = pending.toolCallId;
    setPending(null);

    startTransition(async () => {
      const turn = await confirmAssistantActionAction({ toolCallId, overrides });
      apply(turn);
    });
  }

  function reject() {
    if (!pending || isPending) return;
    const toolCallId = pending.toolCallId;
    setPending(null);

    startTransition(async () => {
      apply(await rejectAssistantActionAction({ toolCallId }));
    });
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_18rem]">
      <div ref={columnRef} className="flex min-w-0 flex-col gap-4">
        {bubbles.length === 0 ? (
          <div className="rounded-lg border bg-card p-5">
            <p className="text-sm font-medium">Cu ce te pot ajuta?</p>
            <p className="mt-1 text-sm text-muted-foreground">
              Pot răspunde din manualul aplicației și pot pregăti acțiuni (client nou, comandă
              nouă). Orice acțiune ți-o arăt întâi spre confirmare.
            </p>
            <div className="mt-4 flex flex-wrap gap-2">
              {suggestions.map((suggestion) => (
                <Button
                  key={suggestion}
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={blocked}
                  onClick={() => send(suggestion)}
                >
                  {suggestion}
                </Button>
              ))}
            </div>
          </div>
        ) : null}

        <div
          className="min-h-0 flex-1 space-y-3 overflow-y-auto scroll-smooth"
          data-testid="chat-messages"
        >
          {bubbles.map((bubble) => (
            <div
              key={bubble.id}
              className={cn(
                "max-w-[85%] rounded-lg border px-4 py-3 text-sm",
                bubble.role === "user"
                  ? "ml-auto bg-secondary/60 whitespace-pre-wrap"
                  : "bg-card text-card-foreground",
              )}
            >
              {bubble.role === "assistant" ? (
                <MessageMarkdown content={bubble.content} />
              ) : (
                <UserBubbleContent content={bubble.content} />
              )}
            </div>
          ))}
          {isPending ? <PendingIndicator /> : null}
          <div ref={messagesEndRef} />
        </div>

        {pending ? (
          <ActionCard action={pending} busy={isPending} onConfirm={confirm} onReject={reject} />
        ) : null}

        {attachments.length ? (
          <ul className="flex flex-wrap gap-2" aria-label="Fișiere atașate">
            {attachments.map((attachment) => (
              <li
                key={attachment.key}
                className={cn(
                  "inline-flex items-center gap-1.5 rounded-md border px-2 py-1 text-xs",
                  attachment.status === "error" && "border-destructive text-destructive",
                )}
              >
                <Paperclip className="size-3" aria-hidden />
                <span>
                  {attachment.fileName}
                  {attachment.status === "uploading" ? " - se încarcă..." : ""}
                  {attachment.status === "error" ? ` - ${attachment.error}` : ""}
                </span>
                <button
                  type="button"
                  aria-label={`Elimină ${attachment.fileName}`}
                  className="rounded p-0.5 hover:bg-secondary"
                  onClick={() =>
                    setAttachments((current) =>
                      current.filter((item) => item.key !== attachment.key),
                    )
                  }
                >
                  <X className="size-3" aria-hidden />
                </button>
              </li>
            ))}
          </ul>
        ) : null}

        <form
          className="flex flex-wrap items-end gap-2"
          onSubmit={(event) => {
            event.preventDefault();
            send(draft);
          }}
        >
          {canAttach ? (
            <>
              <input
                ref={fileInputRef}
                type="file"
                accept={ATTACHMENT_ACCEPT}
                multiple
                className="hidden"
                data-testid="assistant-file-input"
                onChange={(event) => {
                  addFiles(event.target.files);
                  event.target.value = "";
                }}
              />
              <Button
                type="button"
                variant="outline"
                size="icon"
                aria-label="Atașează imagine, PDF sau fișier text"
                title="Atașează imagine, PDF sau fișier text"
                disabled={blocked || isPending || attachments.length >= MAX_ATTACHMENTS_PER_MESSAGE}
                onClick={() => fileInputRef.current?.click()}
              >
                <Paperclip aria-hidden />
              </Button>
            </>
          ) : null}
          <label htmlFor="assistant-input" className="sr-only">
            Mesaj pentru asistent
          </label>
          <ChatInput
            value={draft}
            disabled={blocked || isPending}
            placeholder={
              blocked
                ? "Ai atins limita de mesaje"
                : "Ex: adaugă clientul cu CUI 12345678 (Shift+Enter pentru rând nou)"
            }
            onChange={setDraft}
            onSubmit={() => send(draft)}
            className="min-w-0 flex-1"
          />
          <Button
            type="submit"
            disabled={
              blocked ||
              isPending ||
              uploading ||
              (draft.trim() === "" && readyAttachments.length === 0)
            }
          >
            Trimite
          </Button>
        </form>

        {!providerConfigured ? (
          <p className="text-xs text-muted-foreground">
            Rulează pe furnizorul de test (nicio cheie API configurată): răspunsurile sunt limitate,
            dar fluxul de confirmare funcționează identic.
          </p>
        ) : null}
      </div>

      <QuotaCard quota={quota} className="lg:sticky lg:top-6 lg:self-start" />
    </div>
  );
}
