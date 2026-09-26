import type { Metadata } from "next";
import { Archivo, IBM_Plex_Mono, Spectral } from "next/font/google";
import { ThemeProvider } from "next-themes";
import { ImplicitSessionBridge } from "@/features/auth/implicit-session-bridge";
import { getHostProductName } from "@/features/branding/queries";
import "./globals.css";

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

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="ro"
      className={`${archivo.variable} ${ibmPlexMono.variable} ${spectral.variable}`}
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
