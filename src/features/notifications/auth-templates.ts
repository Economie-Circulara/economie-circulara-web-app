import type { EmailBrand } from "./email-brand";
import { renderEmailLayout } from "./layout";
import type { RenderedEmail } from "./templates";

/**
 * Emailurile de autentificare (Supabase Send Email Hook), cu brandul organizatiei
 * userului - inlocuiesc template-urile globale din dashboard-ul Supabase (plan:
 * docs/plans/email-white-label-per-domeniu.md). Tipurile sunt valorile lui
 * `email_data.email_action_type` trimise de Supabase.
 */
export const AUTH_EMAIL_ACTIONS = [
  "invite",
  "magiclink",
  "recovery",
  "signup",
  "email_change",
  "email",
  "reauthentication",
] as const;

export type AuthEmailAction = (typeof AUTH_EMAIL_ACTIONS)[number];

export function isAuthEmailAction(value: unknown): value is AuthEmailAction {
  return typeof value === "string" && (AUTH_EMAIL_ACTIONS as readonly string[]).includes(value);
}

export interface AuthEmailData {
  /** Linkul de confirmare (lipseste la `reauthentication`, unde se trimite doar codul). */
  link: string | null;
  /** Codul numeric (OTP), afisat doar unde nu exista link. */
  code: string | null;
}

interface AuthCopy {
  subject: string;
  paragraphs: string[];
  actionLabel: string;
}

const LINK_NOTE =
  "Linkul poate fi folosit o singură dată și expiră după o perioadă scurtă. Dacă nu ați cerut acest email, îl puteți ignora.";

function copyFor(action: AuthEmailAction, brand: EmailBrand): AuthCopy {
  const product = brand.productName;
  switch (action) {
    case "invite":
      return {
        subject: `Invitație în ${product}`,
        paragraphs: [
          "Bună ziua,",
          `Ați fost invitat(ă) în ${product}, aplicația de trasabilitate a materialelor folosită de ${brand.organizationName}.`,
          "Apăsați butonul de mai jos pentru a vă activa contul și a vă alege parola.",
        ],
        actionLabel: "Activează contul",
      };
    case "magiclink":
    case "email":
      return {
        subject: `Autentificare în ${product}`,
        paragraphs: [
          "Bună ziua,",
          `Ați cerut autentificarea fără parolă în ${product}. Apăsați butonul de mai jos pentru a intra în cont.`,
        ],
        actionLabel: "Autentifică-te",
      };
    case "recovery":
      return {
        subject: `Resetarea parolei în ${product}`,
        paragraphs: [
          "Bună ziua,",
          `Am primit o cerere de resetare a parolei contului dumneavoastră din ${product}. Apăsați butonul de mai jos pentru a alege o parolă nouă.`,
        ],
        actionLabel: "Alege o parolă nouă",
      };
    case "signup":
      return {
        subject: `Confirmați adresa de email în ${product}`,
        paragraphs: [
          "Bună ziua,",
          `Confirmați adresa de email pentru contul dumneavoastră din ${product}.`,
        ],
        actionLabel: "Confirmă adresa",
      };
    case "email_change":
      return {
        subject: `Confirmați schimbarea adresei de email în ${product}`,
        paragraphs: [
          "Bună ziua,",
          `Am primit o cerere de schimbare a adresei de email a contului din ${product}. Apăsați butonul de mai jos pentru a o confirma.`,
        ],
        actionLabel: "Confirmă schimbarea",
      };
    case "reauthentication":
      return {
        subject: `Codul de confirmare în ${product}`,
        paragraphs: ["Bună ziua,", "Folosiți codul de mai jos pentru a confirma operațiunea."],
        actionLabel: "",
      };
  }
}

export function renderAuthEmail(
  action: AuthEmailAction,
  brand: EmailBrand,
  data: AuthEmailData,
): RenderedEmail {
  const copy = copyFor(action, brand);
  const withLink = Boolean(data.link) && action !== "reauthentication";
  const layout = renderEmailLayout(brand, {
    preheader: copy.subject,
    paragraphs: copy.paragraphs,
    action: withLink ? { label: copy.actionLabel, url: data.link! } : undefined,
    code: withLink ? undefined : (data.code ?? undefined),
    note: withLink ? LINK_NOTE : "Dacă nu ați cerut acest cod, îl puteți ignora.",
  });
  return { subject: copy.subject, ...layout };
}
