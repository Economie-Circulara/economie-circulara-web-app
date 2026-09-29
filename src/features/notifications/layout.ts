import type { EmailBrand } from "./email-brand";

/**
 * Layout-ul comun al emailurilor (Auth + notificari de comanda), cu brandul
 * organizatiei. HTML pe tabele + stiluri inline - singura forma randata consecvent de
 * clientii de email (Gmail, Outlook). Tot textul variabil e escapat.
 */
export interface EmailContent {
  /** Textul scurt afisat in lista de emailuri, langa subiect. */
  preheader?: string;
  /** Paragrafele mesajului (text simplu; `\n` = rand nou). */
  paragraphs: string[];
  /** Butonul principal (link). */
  action?: { label: string; url: string };
  /** Un cod de afisat mare (ex. cod de confirmare). */
  code?: string;
  /** Nota mica de sub buton (ex. valabilitatea linkului). */
  note?: string;
}

export interface RenderedLayout {
  html: string;
  text: string;
}

export function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

/** Doar linkuri http(s) ajung in `href`/`src` (niciodata `javascript:` etc.). */
function safeUrl(url: string): string | null {
  try {
    const parsed = new URL(url);
    return parsed.protocol === "https:" || parsed.protocol === "http:" ? parsed.toString() : null;
  } catch {
    return null;
  }
}

const HEX_RE = /^#[0-9a-f]{3}(?:[0-9a-f]{3})?$/i;

export function renderEmailLayout(brand: EmailBrand, content: EmailContent): RenderedLayout {
  const color = HEX_RE.test(brand.brandColor) ? brand.brandColor : "#1f4a37";
  const logo = brand.logoUrl ? safeUrl(brand.logoUrl) : null;
  const actionUrl = content.action ? safeUrl(content.action.url) : null;

  const header = logo
    ? `<img src="${escapeHtml(logo)}" alt="${escapeHtml(brand.organizationName)}" height="40" style="display:block;height:40px;max-width:220px;border:0;" />`
    : `<span style="font-size:18px;font-weight:700;color:${color};">${escapeHtml(brand.productName)}</span>`;

  const paragraphs = content.paragraphs
    .map(
      (p) =>
        `<p style="margin:0 0 16px;line-height:1.5;">${escapeHtml(p).replace(/\n/g, "<br/>")}</p>`,
    )
    .join("\n");

  const button =
    content.action && actionUrl
      ? `<p style="margin:24px 0;"><a href="${escapeHtml(actionUrl)}" style="display:inline-block;background:${color};color:#ffffff;text-decoration:none;font-weight:600;padding:12px 20px;border-radius:6px;">${escapeHtml(content.action.label)}</a></p>
<p style="margin:0 0 16px;font-size:12px;color:#6b7280;line-height:1.5;">Dacă butonul nu funcționează, copiați adresa în browser:<br/><span style="word-break:break-all;">${escapeHtml(actionUrl)}</span></p>`
      : "";

  const code = content.code
    ? `<p style="margin:24px 0;font-size:28px;font-weight:700;letter-spacing:6px;color:${color};">${escapeHtml(content.code)}</p>`
    : "";

  const note = content.note
    ? `<p style="margin:0 0 16px;font-size:12px;color:#6b7280;">${escapeHtml(content.note)}</p>`
    : "";

  const footer = [brand.organizationName, ...brand.footerLines]
    .map((line) => escapeHtml(line))
    .join("<br/>");

  const html = [
    "<!doctype html>",
    '<html lang="ro">',
    '<head><meta charset="utf-8" /><meta name="viewport" content="width=device-width, initial-scale=1" /></head>',
    '<body style="margin:0;padding:0;background:#f4f4f5;font-family:Arial,Helvetica,sans-serif;color:#1f2937;">',
    content.preheader
      ? `<div style="display:none;max-height:0;overflow:hidden;">${escapeHtml(content.preheader)}</div>`
      : "",
    '<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f4f4f5;padding:24px 12px;">',
    '<tr><td align="center">',
    '<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background:#ffffff;border-radius:8px;overflow:hidden;">',
    `<tr><td style="height:4px;background:${color};font-size:0;line-height:0;">&nbsp;</td></tr>`,
    `<tr><td style="padding:24px 28px 8px;">${header}</td></tr>`,
    `<tr><td style="padding:16px 28px 8px;font-size:15px;">${paragraphs}${code}${button}${note}</td></tr>`,
    `<tr><td style="padding:16px 28px 24px;border-top:1px solid #e5e7eb;font-size:12px;color:#6b7280;line-height:1.5;">${footer}</td></tr>`,
    "</table>",
    `<p style="font-size:11px;color:#9ca3af;margin:12px 0 0;">Mesaj trimis automat de ${escapeHtml(brand.productName)}.</p>`,
    "</td></tr>",
    "</table>",
    "</body>",
    "</html>",
  ].join("\n");

  const textParts = [...content.paragraphs];
  if (content.code) textParts.push(content.code);
  if (content.action && actionUrl) textParts.push(`${content.action.label}: ${actionUrl}`);
  if (content.note) textParts.push(content.note);
  textParts.push(["--", brand.organizationName, ...brand.footerLines].join("\n"));

  return { html, text: `${textParts.join("\n\n")}\n` };
}
