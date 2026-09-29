import type { Metadata } from "next";
import type { ReactNode } from "react";
import "@fontsource-variable/archivo";
import "@fontsource-variable/nunito-sans";
import "@fontsource-variable/manrope";
import "@fontsource/barlow/400.css";
import "@fontsource/barlow/600.css";
import "@fontsource/barlow/700.css";
import "@fontsource/barlow/800.css";
import "./globals.css";
import { getSite } from "@/lib/site";

// Fonturile temelor sunt self-hosted (@fontsource): build-ul nu depinde de Google
// Fonts, iar browserul descarca doar fontul folosit de tema activa.

export async function generateMetadata(): Promise<Metadata> {
  const { content, branding } = await getSite();
  const url = `https://${content.siteDomain}`;
  return {
    metadataBase: new URL(url),
    title: `${branding.name} - ${content.tagline}`,
    description: content.description,
    alternates: { canonical: "/" },
    icons: branding.logo ? { icon: branding.logo } : undefined,
    openGraph: {
      type: "website",
      locale: "ro_RO",
      url,
      siteName: branding.name,
      title: `${branding.name} - ${content.tagline}`,
      description: content.description,
    },
    // Pagina cu texte placeholder nu se indexeaza.
    robots: content.draft ? { index: false, follow: false } : undefined,
  };
}

export default async function RootLayout({ children }: { children: ReactNode }) {
  const { branding } = await getSite();
  return (
    <html lang="ro" data-theme={branding.theme}>
      <body>{children}</body>
    </html>
  );
}
