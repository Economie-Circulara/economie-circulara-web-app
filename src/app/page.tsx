import Link from "next/link";
import { Button } from "@/components/ui/button";

export const metadata = {
  title: "Lateris Trace - trasabilitatea materialelor in economia circulara",
  description:
    "Platforma care documenteaza drumul materialelor reciclate: loturi, procese, certificat de trasabilitate, avize si e-Transport.",
};

/**
 * Pagina publica de intrare. Inainte era schela Wave 0 ("Schela initiala...") cu un
 * buton catre `/showcase` — care e `notFound()` in productie, deci linkul era rupt
 * exact in mediul in care il vedea un vizitator.
 *
 * Deliberat STATICA (fara `getCurrentUser`): CTA-ul duce la `/login`, care redirecteaza
 * singur un utilizator deja autentificat catre dashboard-ul rolului lui. Asa pagina
 * publica rămâne prerandata, fara interogari in baza la fiecare vizita.
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

export default function Home() {
  return (
    <div className="bg-pattern flex min-h-svh flex-col">
      <header className="flex items-center justify-between gap-4 px-6 py-5 sm:px-10">
        <span className="text-lg font-semibold tracking-tight">Lateris Trace</span>
        <Button asChild size="sm" variant="outline">
          <Link href="/login">Autentificare</Link>
        </Button>
      </header>

      <main className="mx-auto flex w-full max-w-5xl flex-1 flex-col justify-center px-6 py-12 sm:px-10">
        <p className="text-accent text-sm font-medium tracking-wide uppercase">
          Economie circulară
        </p>
        <h1 className="mt-3 text-4xl font-bold tracking-tight sm:text-5xl">Lateris Trace</h1>
        <p className="text-muted-foreground mt-5 max-w-2xl text-lg">
          Platformă pentru trasabilitatea materialelor în economia circulară. Urmărește drumul
          materialului de la deșeul intrat în curte până la produsul livrat clientului — și
          dovedește-l cu documente.
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
        Accesul se face pe invitație. Dacă organizația ta folosește Lateris Trace, cere un cont
        administratorului ei.
      </footer>
    </div>
  );
}
