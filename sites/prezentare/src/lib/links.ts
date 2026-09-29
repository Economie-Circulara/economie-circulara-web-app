/** Pagina de login a aplicatiei tenantului (subdomeniul din `content.appDomain`). */
export function appLoginUrl(appDomain: string): string {
  return `https://${appDomain}/login`;
}

/** `tel:` fara spatii/puncte, cu `+` pastrat (ex. "0722 123 456" -> "tel:0722123456"). */
export function telHref(phone: string): string {
  return `tel:${phone.replace(/[^\d+]/g, "")}`;
}
