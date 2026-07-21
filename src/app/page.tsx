import Link from "next/link";
import { redirect } from "next/navigation";
import { Button } from "@/components/ui/button";
import { getCurrentUser, homePathForRole } from "@/features/auth/session";

/**
 * Landing public. Un utilizator deja autentificat e trimis direct la home-ul rolului
 * sau (super-admin) la platforma — ca sa nu ramana blocat pe o pagina generica fara
 * navigatie. Vizitatorii anonimi primesc un CTA clar de autentificare.
 */
export default async function Home() {
  const user = await getCurrentUser();
  if (user) redirect(homePathForRole(user.role));

  return (
    <main className="bg-pattern flex min-h-svh flex-col items-center justify-center gap-6 p-8">
      <div className="flex flex-col items-center gap-4 text-center">
        <h1 className="text-4xl font-bold tracking-tight">Lateris Trace</h1>
        <p className="max-w-md text-muted-foreground">
          Platforma de trasabilitate a materialelor in economia circulara: stoc, procese de
          reciclare si productie, comenzi si certificate de trasabilitate — pentru fiecare
          organizatie.
        </p>
      </div>
      <div className="flex flex-wrap items-center justify-center gap-3">
        <Button asChild variant="accent">
          <Link href="/login">Autentificare</Link>
        </Button>
        <Button asChild variant="outline">
          <Link href="/showcase">Design system</Link>
        </Button>
      </div>
    </main>
  );
}
