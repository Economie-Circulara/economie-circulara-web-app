import { pdfBrandFor } from "@/features/branding/pdf-brand";
import { inlineLogoOf } from "@/features/branding/logos";
import { productNameFor } from "@/features/branding/tenant-profiles";
import { PLATFORM_NAME } from "@/lib/brand";
import type { EmailAddress } from "./provider";
import { resolveEmailSender } from "./sender";

/**
 * Tot ce trebuie stiut despre organizatie ca sa-i trimitem un email cu brandul ei
 * (plan: docs/plans/email-white-label-per-domeniu.md): identitatea vizuala (acelasi
 * aspect ca PDF-urile - `pdfBrandFor`: tema, apoi culorile adminului doar pe tema
 * implicita), textele (numele produsului, datele firmei din subsol), expeditorul si
 * originea linkurilor (domeniul propriu).
 */
export interface EmailBrand {
  /** Numele aplicatiei (titlu, subiecte): `productNameFor`. */
  productName: string;
  /** Numele firmei (semnatura, subsol). */
  organizationName: string;
  logoUrl: string | null;
  brandColor: string;
  /** Liniile din subsol (CUI, Reg. Com., adresa) - pot lipsi. */
  footerLines: string[];
  from: EmailAddress;
  replyTo: string | null;
  /** `https://<custom_domain>` sau `null` (organizatia lucreaza pe domeniul platformei). */
  customOrigin: string | null;
}

/** Coloanele din `organizations` citite pentru emailuri (select-ul de mai jos). */
export interface OrgEmailRow {
  name: string;
  slug: string;
  custom_domain: string | null;
  logo_url: string | null;
  logo_square_url: string | null;
  primary_color: string | null;
  secondary_color: string | null;
  theme: string | null;
  email_from_name: string | null;
  email_from_address: string | null;
  email_domain: string | null;
  email_domain_status: string | null;
  email_reply_to: string | null;
  cui: string | null;
  reg_com: string | null;
  address: string | null;
}

/** Select-ul PostgREST pentru `OrgEmailRow` (direct sau ca embed `organizations(...)`). */
export const ORG_EMAIL_COLUMNS =
  "name, slug, custom_domain, logo_url, logo_square_url, primary_color, secondary_color, theme, email_from_name, email_from_address, email_domain, email_domain_status, email_reply_to, cui, reg_com, address";

/** Adresa platformei, folosita cand organizatia nu are un domeniu de email verificat. */
export function platformFromAddress(): string {
  return process.env.EMAIL_DEFAULT_FROM_ADDRESS?.trim() || "notificari@lotculot.eu";
}

/** Brandul emailului pentru o organizatie (pur); `null` -> brandul platformei. */
export function emailBrandFor(
  org: OrgEmailRow | null | undefined,
  defaultFromAddress: string = platformFromAddress(),
): EmailBrand {
  const productName = productNameFor(
    org ? { slug: org.slug, name: org.name, customDomain: org.custom_domain } : null,
  );
  const pdf = pdfBrandFor(
    org
      ? {
          slug: org.slug,
          name: org.name,
          customDomain: org.custom_domain,
          theme: org.theme,
          primaryColor: org.primary_color,
          secondaryColor: org.secondary_color,
        }
      : null,
  );

  const footerLines = org
    ? [
        [org.cui ? `CUI ${org.cui}` : null, org.reg_com ? `Reg. Com. ${org.reg_com}` : null]
          .filter(Boolean)
          .join(" · "),
        org.address?.trim() ?? "",
      ].filter((line) => line.length > 0)
    : [];

  const domain = org?.custom_domain?.trim().toLowerCase();

  return {
    productName,
    organizationName: org?.name ?? PLATFORM_NAME,
    logoUrl:
      inlineLogoOf(org ? { logoUrl: org.logo_url, logoSquareUrl: org.logo_square_url } : null) ??
      null,
    brandColor: pdf.brandColor,
    footerLines,
    ...resolveEmailSender(
      org
        ? {
            fromName: org.email_from_name,
            fromAddress: org.email_from_address,
            emailDomain: org.email_domain,
            emailDomainStatus: org.email_domain_status,
            replyTo: org.email_reply_to,
          }
        : null,
      { name: productName, address: defaultFromAddress },
    ),
    customOrigin: domain ? `https://${domain}` : null,
  };
}
