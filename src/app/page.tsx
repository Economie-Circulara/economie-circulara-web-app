import { headers } from "next/headers";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Button } from "@/components/ui/button";
import { getOrgBranding } from "@/features/auth/queries";
import { getCurrentUser, homePathForRole } from "@/features/auth/session";
import { resolveTenant } from "@/features/auth/tenant";
import { PLATFORM_DESCRIPTION, PLATFORM_NAME } from "@/lib/brand";

export const metadata = {
  title: PLATFORM_NAME,
  description: PLATFORM_DESCRIPTION,
};

/**
 * Pagina publica de intrare.
 *
 * Doua moduri, dupa cum se rezolva tenantul din cerere (`resolveTenant`: custom domain ->
 * subdomeniu -> segment de path):
 *
 *  - **pe domeniul platformei** (fara tenant): entry point generic. NU afiseaza numele
 *    niciunei organizatii si nici un brand inventat - descrie ce face platforma.
 *  - **pe domeniul/subdomeniul unui client** (tenant rezolvat): afiseaza brandul acelei
 *    organizatii (denumire + logo), ca ecranul de login. Asa intrarea per client e
 *    white-label, iar rădăcina platformei rămâne neutra.
 *
 * Inainte pagina era schela Wave 0, cu un brand hardcodat si un buton catre `/showcase`,
 * care e `notFound()` in productie - deci singurul CTA era rupt exact in productie.
 */

const CAPABILITIES = [
  {
    title: "Certificat de trasabilitate",
    body: "La închiderea comenzii se generează automat un PDF care arată din ce loturi de materie primă — inclusiv reciclată — provine produsul livrat.",
  },
  {
    title: "Stoc pe loturi, cu istoric",
    body: "Fiecare intrare creează un lot cu proveniență — achiziție, reciclare, recondiționare, retur. Consum FIFO și jurnal complet al mișcărilor, exportabil.",
  },
  {
    title: "Producție și reciclare",
    body: "Procese cu output fix sau input fix: sistemul calculează consumul, înregistrează randamentul și leagă loturile rezultate de cele consumate.",
  },
  {
    title: "Livrări, avize și e-Transport",
    body: "Planificarea livrării, avizul de însoțire a mărfii și declararea în RO e-Transport, cu codul UIT păstrat pe livrare.",
  },
  {
    title: "Portal pentru clienți",
    body: "Clientul vede catalogul, își trimite comenzile, urmărește statusul și descarcă documentele și certificatele comenzilor proprii.",
  },
  {
    title: "Rapoarte și conformitate",
    body: "Rapoarte operaționale pe perioadă, cu export PDF și CSV, și evidența materialelor secundare reintegrate în producție.",
  },
];

interface HomeProps {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}

function firstParam(value: string | string[] | undefined): string | null {
  if (Array.isArray(value)) return value[0] ?? null;
  return value ?? null;
}

export default async function Home({ searchParams }: HomeProps = {}) {
  const params = (await searchParams) ?? {};
  const code = firstParam(params.code);
  const tokenHash = firstParam(params.token_hash);
  if (code || tokenHash) {
    const query = new URLSearchParams();
    for (const [key, value] of Object.entries(params)) {
      if (Array.isArray(value)) {
        value.forEach((entry) => query.append(key, entry));
      } else if (value !== undefined) {
        query.set(key, value);
      }
    }
    redirect(`/auth/callback?${query.toString()}`);
  }

  const user = await getCurrentUser();
  if (user) redirect(homePathForRole(user.role));

  const h = await headers();
  const hint = resolveTenant(h.get("host"), "/", process.env.NEXT_PUBLIC_ROOT_DOMAIN);
  const branding = await getOrgBranding(hint);

  // Pe intrarea unui client, titlul e denumirea organizatiei; pe domeniul platformei,
  // nu inventam un brand - spunem ce face platforma.
  const heading = branding?.name ?? "Trasabilitatea materialelor în economia circulară";

  return (
    <div className="bg-pattern flex min-h-svh flex-col">
      <header className="flex items-center justify-between gap-4 px-6 py-5 sm:px-10">
        <div className="flex min-w-0 items-center gap-3">
          {branding?.logoUrl ? (
            // Logo-ul de tenant vine din Supabase Storage, cu domenii variabile per
            // proiect - <img> simplu, fara next/image (fara allowlist de domenii).
            // eslint-disable-next-line @next/next/no-img-element
            <img src={branding.logoUrl} alt="" className="h-8 w-auto shrink-0" />
          ) : null}
          <span className="truncate text-lg font-semibold tracking-tight">
            {branding?.name ?? PLATFORM_NAME}
          </span>
        </div>
        <Button asChild size="sm" variant="outline">
          <Link href="/login">Autentificare</Link>
        </Button>
      </header>

      <main className="mx-auto flex w-full max-w-5xl flex-1 flex-col justify-center px-6 py-12 sm:px-10">
        <p className="text-accent text-sm font-medium tracking-wide uppercase">
          Economie circulară
        </p>
        <h1 className="mt-3 text-4xl font-bold tracking-tight sm:text-5xl">{heading}</h1>
        <p className="text-muted-foreground mt-5 max-w-2xl text-lg">
          Urmărește drumul materialului de la deșeul intrat în curte până la produsul livrat
          clientului — și dovedește-l cu documente.
        </p>

        <div className="mt-8 flex flex-wrap gap-3">
          <Button asChild variant="accent" size="lg">
            <Link href="/login">Intră în platformă</Link>
          </Button>
        </div>

        <section aria-labelledby="capabilities" className="mt-16">
          <h2 id="capabilities" className="sr-only">
            Ce face platforma
          </h2>
          <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {CAPABILITIES.map((item) => (
              <li key={item.title} className="bg-card rounded-lg border p-5">
                <h3 className="font-semibold">{item.title}</h3>
                <p className="text-muted-foreground mt-2 text-sm">{item.body}</p>
              </li>
            ))}
          </ul>
        </section>
      </main>

      <footer className="text-muted-foreground px-6 py-6 text-xs sm:px-10">
        Accesul se face pe invitație. Dacă organizația ta folosește platforma, cere un cont
        administratorului ei.
      </footer>
    </div>
  );
}
