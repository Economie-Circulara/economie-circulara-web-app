import type { Metadata } from "next";
import { Archivo, Barlow, IBM_Plex_Mono, Manrope, Nunito_Sans, Spectral } from "next/font/google";
import { ThemeProvider } from "next-themes";
import { ImplicitSessionBridge } from "@/features/auth/implicit-session-bridge";
import { getHostProductName, getHostTenantBranding } from "@/features/branding/queries";
import { resolveThemeKey } from "@/features/branding/themes";
import { getCurrentOrg } from "@/features/auth/queries";
import "./globals.css";
// DUPA globals.css: blocurile temelor suprascriu tokenii impliciti.
import "./themes.css";

const archivo = Archivo({
  subsets: ["latin", "latin-ext"],
  variable: "--font-archivo",
  display: "swap",
});

const ibmPlexMono = IBM_Plex_Mono({
  subsets: ["latin", "latin-ext"],
  weight: ["400", "500", "600"],
  variable: "--font-ibm-plex-mono",
  display: "swap",
});

// Fonturile temelor (T5) - declarate aici, descarcate de browser doar cand tema
// care le foloseste e activa (@font-face se incarca la prima utilizare).
const nunitoSans = Nunito_Sans({
  subsets: ["latin", "latin-ext"],
  variable: "--font-nunito-sans",
  display: "swap",
});

const barlow = Barlow({
  subsets: ["latin", "latin-ext"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-barlow",
  display: "swap",
});

const manrope = Manrope({
  subsets: ["latin", "latin-ext"],
  variable: "--font-manrope",
  display: "swap",
});

const spectral = Spectral({
  subsets: ["latin", "latin-ext"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-spectral",
  display: "swap",
});

/**
 * Titlul tab-ului poarta numele aplicatiei de pe hostul curent: pe domeniul unui tenant
 * numele lui (plan multi-domain-tenant-profiles, T3), pe domeniul platformei „Lot cu Lot”.
 * Paginile isi dau doar partea specifica ("Comenzi"), sufixul vine din template.
 */
export async function generateMetadata(): Promise<Metadata> {
  const productName = await getHostProductName();
  return {
    title: { default: productName, template: `%s - ${productName}` },
    description: "Platforma de trasabilitate a materialelor in economia circulara",
  };
}

/**
 * Tema de pe `<html>`: a organizatiei de pe HOSTUL cererii (ecranele publice - login,
 * intrare - au tema tenantului inainte de autentificare); pe domeniul platformei, a
 * organizatiei userului logat. Trebuie sa fie pe `<html>`, nu doar pe `AppShell`:
 * dialogurile si meniul mobil se randeaza in portal, direct sub `<body>`.
 */
async function resolveDocumentTheme(): Promise<string> {
  const hostBranding = await getHostTenantBranding();
  if (hostBranding) return resolveThemeKey(hostBranding.theme);
  return resolveThemeKey((await getCurrentOrg())?.theme);
}

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="ro"
      data-theme={await resolveDocumentTheme()}
      className={`${archivo.variable} ${ibmPlexMono.variable} ${spectral.variable} ${nunitoSans.variable} ${barlow.variable} ${manrope.variable}`}
      suppressHydrationWarning
    >
      <body>
        <ImplicitSessionBridge />
        <ThemeProvider
          attribute="class"
          defaultTheme="system"
          enableSystem
          disableTransitionOnChange
        >
          {children}
        </ThemeProvider>
      </body>
    </html>
  );
}
