import { getSite } from "@/lib/site";
import { appLoginUrl, telHref } from "@/lib/links";

// Pasii de trasabilitate sunt aceiasi pentru toti tenantii: descriu ce face aplicatia.
const TRACE_STEPS = [
  {
    title: "Fiecare lot are o origine",
    text: "Materia primă, inclusiv cea reciclată, intră în evidență pe loturi, cu furnizorul sau clientul de la care provine.",
  },
  {
    title: "Producția consumă loturi, nu cantități",
    text: "Fiecare proces înregistrează din ce loturi a consumat și ce loturi noi a produs, cu pierderile reale.",
  },
  {
    title: "Livrarea vine cu certificat",
    text: "La închiderea comenzii se emite automat certificatul de trasabilitate: din ce este făcut produsul livrat.",
  },
];

export default async function HomePage() {
  const { content, branding } = await getSite();
  const loginUrl = appLoginUrl(content.appDomain);
  const { contact, legal, euFunding } = content;
  const year = new Date().getFullYear();

  return (
    <>
      <header className="header">
        <div className="container header-inner">
          <a href="#top" className="brand" aria-label={`${branding.name} - începutul paginii`}>
            {branding.logo ? (
              // Site static fara optimizator de imagini; logo-ul poate fi un URL din Storage.
              // eslint-disable-next-line @next/next/no-img-element
              <img src={branding.logo} alt={branding.name} />
            ) : (
              <span>{branding.name}</span>
            )}
          </a>
          <nav className="nav" aria-label="Secțiuni">
            <a href="#despre">Despre</a>
            <a href="#servicii">Servicii</a>
            <a href="#trasabilitate">Trasabilitate</a>
            <a href="#contact">Contact</a>
          </nav>
          <a className="btn btn-primary" href={loginUrl}>
            Intră în cont
          </a>
        </div>
      </header>

      <main id="top">
        <section className="hero">
          <div className="container hero-inner">
            <div>
              <span className="eyebrow">{branding.name}</span>
              <h1>{content.tagline}</h1>
              <p className="lead">{content.description}</p>
              <div className="actions">
                <a className="btn btn-primary" href={loginUrl}>
                  Portalul clienților
                </a>
                <a className="btn btn-outline" href="#contact">
                  Contactează-ne
                </a>
              </div>
            </div>
            <CertificatePreview name={branding.name} />
          </div>
        </section>

        <section id="despre" className="section">
          <div className="container">
            <h2>{content.about.title}</h2>
            <div className="prose">
              {content.about.paragraphs.map((p) => (
                <p key={p}>{p}</p>
              ))}
            </div>
            {content.stats.length > 0 && (
              <div className="stats">
                {content.stats.map((s) => (
                  <div className="stat" key={s.label}>
                    <strong>{s.value}</strong>
                    <span>{s.label}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </section>

        <section id="servicii" className="section section-alt">
          <div className="container">
            <h2>{content.services.title}</h2>
            <div className="cards">
              {content.services.items.map((s) => (
                <article className="card" key={s.title}>
                  <div className="card-bar" aria-hidden="true" />
                  <h3>{s.title}</h3>
                  <p>{s.text}</p>
                </article>
              ))}
            </div>
          </div>
        </section>

        <section id="trasabilitate" className="section">
          <div className="container">
            <h2>Trasabilitate de la lot la livrare</h2>
            <p className="section-intro">
              Știi exact din ce este făcut ce primești. Fiecare pas este înregistrat, iar
              certificatul de trasabilitate îl dovedește.
            </p>
            <ol className="steps">
              {TRACE_STEPS.map((s) => (
                <li className="step" key={s.title}>
                  <h3>{s.title}</h3>
                  <p>{s.text}</p>
                </li>
              ))}
            </ol>
          </div>
        </section>

        <section className="section section-flush">
          <div className="container">
            <div className="portal">
              <div>
                <h2>{content.portal.title}</h2>
                <p>{content.portal.text}</p>
                <div className="actions">
                  <a className="btn btn-accent" href={loginUrl}>
                    Intră în cont
                  </a>
                </div>
              </div>
              {content.portal.bullets.length > 0 && (
                <ul>
                  {content.portal.bullets.map((b) => (
                    <li key={b}>{b}</li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        </section>

        <section id="contact" className="section section-alt">
          <div className="container">
            <h2>Contact</h2>
            <p className="section-intro">Scrie-ne sau sună-ne și revenim cu o ofertă.</p>
            <div className="contact-grid">
              {contact.phone && (
                <a className="contact-item" href={telHref(contact.phone)}>
                  <span>Telefon</span>
                  <strong>{contact.phone}</strong>
                </a>
              )}
              {contact.email && (
                <a className="contact-item" href={`mailto:${contact.email}`}>
                  <span>Email</span>
                  <strong>{contact.email}</strong>
                </a>
              )}
              {contact.address && (
                <div className="contact-item">
                  <span>Adresă</span>
                  <strong>{contact.address}</strong>
                </div>
              )}
              {contact.hours && (
                <div className="contact-item">
                  <span>Program</span>
                  <strong>{contact.hours}</strong>
                </div>
              )}
            </div>
          </div>
        </section>
      </main>

      <footer className="footer">
        <div className="container footer-inner">
          {euFunding && (
            <div className="eu">
              {euFunding.logos.length > 0 && (
                <div className="eu-logos">
                  {euFunding.logos.map((src) => (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img key={src} src={src} alt="" />
                  ))}
                </div>
              )}
              <p>{euFunding.text}</p>
            </div>
          )}
          <div className="footer-row">
            <p>
              © {year} {legal.companyName}
              {legal.cui && ` · CUI ${legal.cui}`}
              {legal.regCom && ` · ${legal.regCom}`}
            </p>
            <a href={loginUrl}>{content.appDomain}</a>
          </div>
        </div>
      </footer>
    </>
  );
}

/** Ilustratie: un certificat de trasabilitate simplificat (date de exemplu). */
function CertificatePreview({ name }: { name: string }) {
  const rows = [
    { label: "Lot materie primă reciclată", qty: "62%" },
    { label: "Lot materie primă nouă", qty: "38%" },
    { label: "Produs livrat · comanda CMD-0142", qty: "12,0 t" },
  ];
  return (
    <figure className="cert" aria-label="Exemplu de certificat de trasabilitate">
      <div className="cert-head">
        <strong>Certificat de trasabilitate</strong>
        <span>{name}</span>
      </div>
      <div className="cert-body">
        {rows.map((r) => (
          <div className="cert-row" key={r.label}>
            <span className="cert-dot" aria-hidden="true" />
            <span>{r.label}</span>
            <small>{r.qty}</small>
          </div>
        ))}
      </div>
      <figcaption className="cert-foot">
        Exemplu ilustrativ · fiecare lot, cu originea lui
      </figcaption>
    </figure>
  );
}
