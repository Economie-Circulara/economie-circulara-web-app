import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { LoginForm } from "@/features/auth/login-form";
import { getCurrentUser, homePathForRole } from "@/features/auth/session";
import { getOrgBranding } from "@/features/auth/queries";
import { resolveTenant } from "@/features/auth/tenant";

export const metadata = { title: "Autentificare — Lateris Trace" };

interface LoginPageProps {
  searchParams: Promise<{ error?: string }>;
}

export default async function LoginPage({ searchParams }: LoginPageProps) {
  // Daca e deja autentificat, mergi direct la dashboard-ul rolului.
  const user = await getCurrentUser();
  if (user) redirect(homePathForRole(user.role));

  // Branding per tenant (subdomeniu / custom domain) pentru ecranul de login.
  const h = await headers();
  const hint = resolveTenant(h.get("host"), "/", process.env.NEXT_PUBLIC_ROOT_DOMAIN);
  const branding = await getOrgBranding(hint);

  const { error } = await searchParams;

  return (
    <LoginForm
      orgName={branding?.name ?? "Lateris Trace"}
      logoUrl={branding?.logoUrl ?? undefined}
      errorCode={error}
    />
  );
}
