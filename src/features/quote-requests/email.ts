import type { EmailBrand } from "@/features/notifications/email-brand";
import { renderEmailLayout } from "@/features/notifications/layout";
import type { QuoteRequestInput } from "./request";

/**
 * Emailul catre firma la o cerere de oferta noua. Brandul organizatiei, ca orice email
 * (AGENTS.md: `emailBrandFor` + `renderEmailLayout`). Datele solicitantului sunt text
 * simplu, escapat de layout.
 */
export function renderQuoteRequestEmail(
  brand: EmailBrand,
  request: QuoteRequestInput,
  listUrl: string | null,
): { subject: string; html: string; text: string } {
  const lines = [
    `Serviciu: ${request.service}`,
    `Nume: ${request.name}`,
    `Telefon: ${request.phone}`,
    ...(request.email ? [`Email: ${request.email}`] : []),
  ];
  const paragraphs = [
    "Ați primit o cerere de ofertă nouă din site.",
    lines.join("\n"),
    ...(request.message ? [`Detalii:\n${request.message}`] : []),
    request.email
      ? "Puteți răspunde direct la acest email - răspunsul ajunge la solicitant."
      : "Solicitantul nu a lăsat o adresă de email - contactați-l telefonic.",
  ];
  const rendered = renderEmailLayout(brand, {
    preheader: `${request.service} - ${request.name}, ${request.phone}`,
    paragraphs,
    action: listUrl ? { label: "Vezi cererile de ofertă", url: listUrl } : undefined,
  });
  return {
    subject: `Cerere de ofertă: ${request.service} - ${request.name}`,
    ...rendered,
  };
}

/**
 * Cui trimitem emailul: adresa de raspuns a organizatiei (inboxul firmei, setat in
 * Setari), altfel toti adminii activi. Fara duplicate, fara adrese goale.
 */
export function quoteRecipients(replyTo: string | null, adminEmails: (string | null)[]): string[] {
  const inbox = replyTo?.trim();
  if (inbox) return [inbox];
  return [...new Set(adminEmails.map((e) => e?.trim().toLowerCase() ?? "").filter(Boolean))];
}
