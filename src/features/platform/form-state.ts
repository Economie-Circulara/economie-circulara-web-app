/** Starea partajata a formularelor de platforma (server actions + useActionState). */
export interface CreateOrganizationState {
  error: string | null;
  message: string | null;
  /** Setat dupa ce randul organizatiei exista in DB - ramane intre reincercari. */
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
