/**
 * Abstractie peste providerul de email (Task X1). Doua implementari:
 *
 *  - `ConsoleEmailProvider` (dezvoltare/mock): NU trimite nimic, doar
 *    jurnalizeaza in consola serverului. E providerul implicit ori de cate ori
 *    lipsesc credentialele reale — inclusiv in teste (AGENTS.md §2.2: testele nu
 *    depind de servicii externe reale).
 *  - `HttpApiEmailProvider` (real, stub configurabil prin env): POST JSON catre
 *    un API HTTP de email generic (compatibil cu formatul minimal folosit de
 *    Resend/Postmark: `{ from, to, subject, html, text }`), autentificat cu un
 *    Bearer token. Configurare: `EMAIL_API_URL` + `EMAIL_API_KEY` (vezi
 *    `.env.example`). Fara retry/backoff — suficient pt. MVP; nu e exercitata in
 *    teste (fetch-ul real nu ruleaza in CI), doar formatul cererii (fetch mockuit
 *    in provider.test.ts).
 *
 * `getEmailProvider()` alege implementarea in functie de configurare — serviciul
 * (`service.ts`) nu stie si nu trebuie sa stie care e providerul activ.
 */

export interface EmailAddress {
  name?: string | null;
  address: string;
}

export interface EmailMessage {
  to: string;
  from: EmailAddress;
  subject: string;
  html: string;
  text: string;
}

export interface EmailProvider {
  send(message: EmailMessage): Promise<void>;
}

function formatFrom(from: EmailAddress): string {
  return from.name ? `${from.name} <${from.address}>` : from.address;
}

/** Providerul de dezvoltare/testare: nu trimite nimic, doar jurnalizeaza. */
export class ConsoleEmailProvider implements EmailProvider {
  async send(message: EmailMessage): Promise<void> {
    console.info(
      `[notifications] (mock, fara provider de email configurat) catre ${message.to} ` +
        `de la ${formatFrom(message.from)}: "${message.subject}"`,
    );
  }
}

/**
 * Provider real, minimal — vezi comentariul de sus. Constructorul primeste
 * explicit url/cheia (nu citeste `process.env` direct) ca sa ramana usor
 * testabil/instantiabil independent de mediu.
 */
export class HttpApiEmailProvider implements EmailProvider {
  constructor(
    private readonly apiUrl: string,
    private readonly apiKey: string,
  ) {}

  async send(message: EmailMessage): Promise<void> {
    const response = await fetch(this.apiUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${this.apiKey}`,
      },
      body: JSON.stringify({
        from: formatFrom(message.from),
        to: message.to,
        subject: message.subject,
        html: message.html,
        text: message.text,
      }),
    });

    if (!response.ok) {
      const detail = await response.text().catch(() => "");
      throw new Error(
        `Providerul de email a răspuns cu eroare (${response.status}): ${detail || response.statusText}`,
      );
    }
  }
}

/**
 * Alege providerul de email in functie de mediu: `EMAIL_API_URL` +
 * `EMAIL_API_KEY` setate -> providerul real (HTTP API); altfel providerul mock
 * (dezvoltare/teste). Nu esueaza niciodata din lipsa de credentiale.
 */
export function getEmailProvider(): EmailProvider {
  const apiUrl = process.env.EMAIL_API_URL;
  const apiKey = process.env.EMAIL_API_KEY;
  if (apiUrl && apiKey) {
    return new HttpApiEmailProvider(apiUrl, apiKey);
  }
  return new ConsoleEmailProvider();
}
