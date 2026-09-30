/**
 * Formularul „Cere o ofertă” (plan: docs/plans/site-cerere-oferta.md). Site-ul e
 * static, deci cererea merge la aplicatia tenantului, care o salveaza si trimite
 * emailul catre firma. Validarea de aici e doar pentru mesaje rapide in browser -
 * cea care conteaza e pe server (`src/features/quote-requests/request.ts`).
 */

export interface QuoteFormValues {
  service: string;
  name: string;
  phone: string;
  email: string;
  message: string;
  consent: boolean;
  /** Campul-capcana, ascuns: un om il lasa gol. */
  website: string;
}

export function quoteEndpoint(appDomain: string): string {
  return `https://${appDomain}/api/public/cerere-oferta`;
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PHONE_RE = /^[+\d][\d\s().-]{5,}$/;

/** Primul mesaj de eroare pentru utilizator, sau `null` daca formularul e complet. */
export function validateQuote(values: QuoteFormValues): string | null {
  if (!values.service.trim()) return "Alegeți serviciul.";
  if (!values.name.trim()) return "Completați numele.";
  if (!PHONE_RE.test(values.phone.trim())) return "Completați un număr de telefon valid.";
  if (values.email.trim() && !EMAIL_RE.test(values.email.trim())) {
    return "Adresa de email nu este validă.";
  }
  if (!values.consent) return "Bifați acordul pentru prelucrarea datelor.";
  return null;
}

export type QuoteSendResult = { ok: true } | { ok: false; error: string };

/** Trimite cererea; orice esec (retea, raspuns neasteptat) devine un mesaj lizibil. */
export async function sendQuote(
  appDomain: string,
  values: QuoteFormValues,
  fetcher: typeof fetch = fetch,
): Promise<QuoteSendResult> {
  const fallback = "Nu am putut trimite cererea. Sunați-ne sau scrieți-ne direct.";
  try {
    const response = await fetcher(quoteEndpoint(appDomain), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(values),
    });
    const data = (await response.json().catch(() => null)) as {
      ok?: boolean;
      error?: string;
    } | null;
    if (response.ok && data?.ok) return { ok: true };
    return { ok: false, error: data?.error || fallback };
  } catch {
    return { ok: false, error: fallback };
  }
}
