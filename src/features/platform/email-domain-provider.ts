import { mapProviderStatus, type EmailDnsRecord, type EmailDomainStatus } from "./email-domain";

/**
 * Adapter peste API-ul de domenii al providerului de email (plan:
 * docs/plans/email-white-label-per-domeniu.md, Etapa 2) - ca la rutare / e-Transport,
 * restul codului nu stie de Resend. Implementare unica: `ResendDomainProvider`, activa
 * doar cu `RESEND_API_KEY` (cheie cu acces COMPLET - cheile „sending access” nu pot
 * gestiona domenii). Fara cheie nu exista mock: un mock care marcheaza domenii drept
 * verificate ar face aplicatia sa trimita de pe domenii pe care providerul le respinge.
 */
export interface EmailDomainInfo {
  id: string;
  name: string;
  status: EmailDomainStatus;
  records: EmailDnsRecord[];
}

export interface EmailDomainProvider {
  /** Creeaza domeniul (sau il reia daca exista deja in cont) cu tracking-ul oprit. */
  createDomain(name: string): Promise<EmailDomainInfo>;
  /** Cere o noua verificare DNS si intoarce starea curenta. */
  verifyDomain(id: string): Promise<EmailDomainInfo>;
  getDomain(id: string): Promise<EmailDomainInfo>;
  removeDomain(id: string): Promise<void>;
}

/** Eroare raportata de provider (mesajul e afisat super-adminului). */
export class EmailDomainProviderError extends Error {
  constructor(
    message: string,
    public readonly status: number,
  ) {
    super(message);
    this.name = "EmailDomainProviderError";
  }
}

const RESEND_API = "https://api.resend.com";
/** Regiunea EU (Irlanda) - datele raman in UE, ca Supabase. */
const RESEND_REGION = "eu-west-1";

interface ResendRecord {
  record?: string;
  type?: string;
  name?: string;
  value?: string;
  priority?: number;
  status?: string;
}

interface ResendDomain {
  id: string;
  name: string;
  status?: string;
  records?: ResendRecord[];
}

function mapDomain(domain: ResendDomain): EmailDomainInfo {
  return {
    id: domain.id,
    name: domain.name,
    status: mapProviderStatus(domain.status),
    records: (domain.records ?? []).map((r) => ({
      type: r.type ?? r.record ?? "",
      name: r.name ?? "",
      value: r.value ?? "",
      priority: typeof r.priority === "number" ? r.priority : null,
      status: r.status ?? "",
    })),
  };
}

export class ResendDomainProvider implements EmailDomainProvider {
  constructor(
    private readonly apiKey: string,
    private readonly fetchImpl: typeof fetch = fetch,
  ) {}

  private async request<T>(method: string, path: string, body?: unknown): Promise<T> {
    const response = await this.fetchImpl(`${RESEND_API}${path}`, {
      method,
      headers: {
        Authorization: `Bearer ${this.apiKey}`,
        ...(body ? { "Content-Type": "application/json" } : {}),
      },
      body: body ? JSON.stringify(body) : undefined,
    });
    const text = await response.text().catch(() => "");
    let json: unknown = null;
    try {
      json = text ? JSON.parse(text) : null;
    } catch {
      json = null;
    }
    if (!response.ok) {
      const message =
        (json as { message?: string } | null)?.message || response.statusText || "eroare";
      throw new EmailDomainProviderError(
        `Resend a raspuns cu eroare (${response.status}): ${message}`,
        response.status,
      );
    }
    return json as T;
  }

  /** Link-urile Auth nu trebuie rescrise de tracking (docs/setup.md). Best-effort. */
  private async disableTracking(id: string): Promise<void> {
    await this.request("PATCH", `/domains/${id}`, {
      click_tracking: false,
      open_tracking: false,
    }).catch(() => undefined);
  }

  async createDomain(name: string): Promise<EmailDomainInfo> {
    let id: string;
    try {
      const created = await this.request<ResendDomain>("POST", "/domains", {
        name,
        region: RESEND_REGION,
      });
      id = created.id;
    } catch (err) {
      // Domeniul exista deja in contul Resend (ex. adaugat manual) -> il reluam.
      if (!(err instanceof EmailDomainProviderError) || ![403, 409, 422].includes(err.status)) {
        throw err;
      }
      const list = await this.request<{ data?: ResendDomain[] }>("GET", "/domains");
      const existing = list.data?.find((d) => d.name.toLowerCase() === name.toLowerCase());
      if (!existing) throw err;
      id = existing.id;
    }
    await this.disableTracking(id);
    return this.getDomain(id);
  }

  async verifyDomain(id: string): Promise<EmailDomainInfo> {
    await this.request("POST", `/domains/${id}/verify`);
    return this.getDomain(id);
  }

  async getDomain(id: string): Promise<EmailDomainInfo> {
    return mapDomain(await this.request<ResendDomain>("GET", `/domains/${id}`));
  }

  async removeDomain(id: string): Promise<void> {
    await this.request("DELETE", `/domains/${id}`);
  }
}

/** Providerul configurat sau `null` (fara `RESEND_API_KEY` - gestionare indisponibila). */
export function getEmailDomainProvider(): EmailDomainProvider | null {
  const key = process.env.RESEND_API_KEY;
  return key ? new ResendDomainProvider(key) : null;
}
