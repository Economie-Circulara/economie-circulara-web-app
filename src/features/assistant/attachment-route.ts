import { NextResponse } from "next/server";
import { attachmentSignedUrl, getAttachment } from "./attachments";

/**
 * Deschiderea / descarcarea unui atasament din chat. Accesul trece prin `getAttachment`
 * (RLS pe sesiunea utilizatorului - doar atasamentele proprii), apoi redirect catre un
 * URL semnat de 60s. Redirect si nu streaming prin server: raspunsurile functiilor
 * Vercel sunt limitate la 4.5MB (un PDF poate avea 10MB), iar un HTML atasat nu ajunge
 * sa fie servit de pe originea aplicatiei.
 */
export async function attachmentRedirect(id: string, download: boolean): Promise<Response> {
  const attachment = await getAttachment(id);
  if (!attachment) return new NextResponse("Atașament inexistent.", { status: 404 });

  const url = await attachmentSignedUrl(attachment, { expiresInSeconds: 60, download });
  if (!url) return new NextResponse("Fișierul nu a putut fi deschis.", { status: 502 });

  return NextResponse.redirect(url, {
    status: 307,
    headers: { "Cache-Control": "private, no-store" },
  });
}
