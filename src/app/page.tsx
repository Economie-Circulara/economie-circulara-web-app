import Link from "next/link";
import { Button } from "@/components/ui/button";

export default function Home() {
  return (
    <main className="bg-pattern flex min-h-svh flex-col items-center justify-center gap-5 p-8">
      <h1 className="text-4xl font-bold tracking-tight">Lateris Trace</h1>
      <p className="max-w-md text-center text-muted-foreground">
        Platforma de trasabilitate a materialelor in economia circulara. Schela initiala (Wave 0).
        Vezi <code>docs/plans/implementation-plan.md</code> pentru pasii urmatori.
      </p>
      <Button asChild variant="accent">
        <Link href="/showcase">Vezi design system-ul</Link>
      </Button>
    </main>
  );
}
