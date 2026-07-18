"use server";

import { getCertificateDownloadUrl } from "./service";

export interface CertificateDownloadResult {
  url: string | null;
  error: string | null;
}

/**
 * Genereaza un link semnat de descarcare a PDF-ului certificatului. Apelata
 * direct (nu ca form action) din ecranul de certificat, la click pe
 * "Descarcă PDF" — acelasi pattern ca `documents/actions.ts#getDownloadUrlAction`.
 */
export async function getCertificateDownloadUrlAction(
  certificateId: string,
): Promise<CertificateDownloadResult> {
  try {
    const url = await getCertificateDownloadUrl(certificateId);
    return { url, error: null };
  } catch (err) {
    return {
      url: null,
      error: err instanceof Error ? err.message : "Nu am putut genera link-ul de descărcare.",
    };
  }
}
