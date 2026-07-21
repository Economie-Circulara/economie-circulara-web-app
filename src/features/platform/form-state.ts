/**
 * Starea formularelor de platforma (server actions + useActionState). Traieste separat
 * de `actions.ts` fiindca un fisier "use server" poate exporta doar functii async — nu
 * si obiecte (starile initiale).
 */
export interface CreateOrganizationState {
  error: string | null;
  message: string | null;
  /** Setat dupa ce randul organizatiei exista in DB — ramane intre reincercari. */
  organizationId: string | null;
  orgName: string;
  orgSlug: string;
  adminEmail: string;
}

export const initialCreateOrganizationState: CreateOrganizationState = {
  error: null,
  message: null,
  organizationId: null,
  orgName: "",
  orgSlug: "",
  adminEmail: "",
};

export interface OrgStatusState {
  error: string | null;
}

export const initialOrgStatusState: OrgStatusState = { error: null };
