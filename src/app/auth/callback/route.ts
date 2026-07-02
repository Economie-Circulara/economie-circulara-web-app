import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";

/**
 * Endpoint comun de callback pentru OAuth (Google), magic link si resetare parola.
 * Schimba `code`-ul pe o sesiune (cookie) si redirecteaza la `next` (sau radacina).
 *
 * Provizionare: un cont valid trebuie sa aiba un rand in `public.profiles`, creat de
 * admin la invitatie. Magic link-ul foloseste `shouldCreateUser: false`, deci e sigur -
 * dar OAuth (Google) poate crea un rand nou in `auth.users` FARA profil daca sign-up-ul
 * public nu e dezactivat din dashboard-ul Supabase (vezi docs/setup.md). Un utilizator in
 * flux de resetare parola are deja profil (a fost invitat anterior), deci verificarea de
 * mai jos nu strica acel flux.
 */
export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const next = searchParams.get("next") ?? "/";

  if (code) {
    const supabase = await createClient();
    const { data, error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error && data.user) {
      const { data: profile } = await supabase
        .from("profiles")
        .select("id")
        .eq("id", data.user.id)
        .maybeSingle();

      if (!profile) {
        // Autentificat la nivel de Supabase Auth, dar fara profil provizionat -> nu are
        // acces. Delogam ca sa nu ramana un cookie de sesiune orfan si trimitem un mesaj
        // clar la login.
        await supabase.auth.signOut();
        return NextResponse.redirect(`${origin}/login?error=unprovisioned`);
      }

      // `next` e mereu o cale relativa controlata de noi (nu input liber al userului).
      return NextResponse.redirect(`${origin}${next.startsWith("/") ? next : `/${next}`}`);
    }
  }

  return NextResponse.redirect(`${origin}/login?error=auth`);
}
