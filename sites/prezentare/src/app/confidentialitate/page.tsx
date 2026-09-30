import type { Metadata } from "next";
import Link from "next/link";
import { getSite } from "@/lib/site";

export async function generateMetadata(): Promise<Metadata> {
  const { branding } = await getSite();
  return {
    title: `Confidențialitate - ${branding.name}`,
    alternates: { canonical: "/confidentialitate" },
  };
}

/**
 * Nota de informare pentru formularul „Cere o ofertă” (plan
 * docs/plans/site-cerere-oferta.md). Text minim, generat din continutul tenantului -
 * DE VALIDAT JURIDIC de client inainte ca site-ul sa iasa din `draft`.
 */
export default async function PrivacyPage() {
  const { content, branding } = await getSite();
  const { legal, contact } = content;
  const contactLine = [contact.email, contact.phone].filter(Boolean).join(" / ");

  return (
    <>
      <header className="header">
        <div className="container header-inner">
          <Link href="/" className="brand">
            {branding.name}
          </Link>
        </div>
      </header>
      <main className="container legal-page">
        <h1>Confidențialitatea datelor</h1>
        <p>
          Această pagină explică ce date colectăm prin formularul „Cere o ofertă” de pe{" "}
          {content.siteDomain} și cum le folosim.
        </p>

        <h2>Cine prelucrează datele</h2>
        <p>
          {legal.companyName}
          {legal.cui && `, CUI ${legal.cui}`}
          {legal.regCom && `, ${legal.regCom}`}
          {contact.address && `, cu sediul în ${contact.address}`}.
        </p>

        <h2>Ce date colectăm</h2>
        <ul>
          <li>numele și numărul de telefon;</li>
          <li>adresa de email, dacă o completați;</li>
          <li>serviciul ales și detaliile cererii.</li>
        </ul>
        <p>Site-ul nu folosește cookie-uri și nu urmărește vizitatorii.</p>

        <h2>De ce și pe ce temei</h2>
        <p>
          Pentru a vă contacta și a vă trimite oferta cerută, pe baza acordului pe care îl dați
          bifând căsuța din formular. Datele nu sunt folosite pentru reclame și nu sunt vândute.
        </p>

        <h2>Unde ajung și cât timp le păstrăm</h2>
        <p>
          Cererea ajunge pe emailul firmei și în aplicația de gestiune a firmei{" "}
          {`(${content.appDomain})`}, găzduită în Uniunea Europeană. O păstrăm cât este nevoie
          pentru a răspunde cererii și pentru o eventuală colaborare care rezultă din ea.
        </p>

        <h2>Drepturile dumneavoastră</h2>
        <p>
          Puteți cere oricând accesul la date, corectarea sau ștergerea lor și vă puteți retrage
          acordul{contactLine && `, scriindu-ne la ${contactLine}`}. Aveți dreptul să depuneți o
          plângere la Autoritatea Națională de Supraveghere a Prelucrării Datelor cu Caracter
          Personal (ANSPDCP).
        </p>

        <p>
          <Link href="/">Înapoi la pagina principală</Link>
        </p>
      </main>
    </>
  );
}
