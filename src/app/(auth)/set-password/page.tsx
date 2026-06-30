import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { SetPasswordForm } from "@/features/auth/set-password-form";

export const metadata = { title: "Seteaza parola — Lateris Trace" };

/**
 * Accesat prin link-ul de invitatie / resetare (callback-ul a creat deja o sesiune).
 * Fara sesiune valida nu se poate seta parola -> inapoi la login.
 */
export default async function SetPasswordPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login?error=auth");

  return <SetPasswordForm />;
}
