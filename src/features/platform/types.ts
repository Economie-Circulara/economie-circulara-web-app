import type { Database } from "@/lib/database.types";

export type OrgStatus = Database["public"]["Enums"]["org_status"];

export interface OrganizationSummary {
  id: string;
  name: string;
  slug: string;
  customDomain: string | null;
  status: OrgStatus;
  createdAt: string;
  /** Numar de profile (useri) legate de organizatie, indiferent de rol. */
  userCount: number;
  /** URL-ul pe care organizatia isi acceseaza tenantul (custom domain / subdomeniu / path). */
  accessUrl: string;
}
