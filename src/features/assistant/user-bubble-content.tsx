import { Download, Paperclip } from "lucide-react";
import { attachmentHref, splitAttachmentReferences } from "./attachment-rules";

/**
 * Continutul unei bule de utilizator: textul + fisierele atasate. Numele deschide
 * fisierul intr-un tab nou (imaginile si PDF-urile se afiseaza in browser), iconita
 * il descarca.
 */
export function UserBubbleContent({ content }: { content: string }) {
  const { text, attachments } = splitAttachmentReferences(content);
  return (
    <>
      {text}
      {attachments.length ? (
        <span className="mt-2 flex flex-wrap gap-1.5">
          {attachments.map((attachment) => (
            <span
              key={attachment.id}
              className="inline-flex items-center gap-1 rounded-md border bg-card px-2 py-0.5 text-xs text-card-foreground"
            >
              <Paperclip className="size-3" aria-hidden />
              <a
                href={attachmentHref(attachment.id)}
                target="_blank"
                rel="noopener noreferrer"
                className="underline-offset-2 hover:underline"
                title={`Deschide ${attachment.fileName}`}
              >
                {attachment.fileName}
              </a>
              <a
                href={attachmentHref(attachment.id, { download: true })}
                aria-label={`Descarcă ${attachment.fileName}`}
                title="Descarcă"
                className="ml-0.5 text-muted-foreground hover:text-foreground"
              >
                <Download className="size-3" aria-hidden />
              </a>
            </span>
          ))}
        </span>
      ) : null}
    </>
  );
}
