import type { Database } from "@/lib/database.types";
import type { EmailDnsRecord, EmailDomainStatus } from "./email-domain";

export type OrgStatus = Database["public"]["Enums"]["org_status"];

export interface OrganizationSummary {
  id: string;
  name: string;
  slug: string;
  customDomain: string | null;
  /** Cheia temei vizuale (`organizations.theme`). */
  theme: string;
  /** Organizarea meniului + panoului (`organizations.layout`). */
  layout: string;
  status: OrgStatus;
  createdAt: string;
  /** Numar de profile (useri) legate de organizatie, indiferent de rol. */
  userCount: number;
  /** URL-ul pe care organizatia isi acceseaza tenantul (custom domain / subdomeniu / path). */
  accessUrl: string;
  /** Domeniul de trimitere a emailurilor + verificarea lui (plan email-white-label-per-domeniu). */
  email: OrganizationEmailSettings;
}

export interface OrganizationEmailSettings {
  domain: string | null;
  fromName: string | null;
  fromAddress: string | null;
  replyTo: string | null;
  status: EmailDomainStatus;
  records: EmailDnsRecord[];
  checkedAt: string | null;
}
