import type * as React from "react";
import { getHostTenantBranding } from "@/features/branding/queries";
import { productNameFor } from "@/features/branding/tenant-profiles";

/**
 * Layout pentru ecranele de autentificare (login, resetare, set parola). Implicit un
 * card centrat; temele cu login „split” (`--login-panel-display: flex`, vezi
 * src/app/themes.css) afiseaza pe ecrane late si un panou lateral cu numele aplicatiei.
 * Panoul e doar decorativ - pe mobil si in temele fara panou ramane cardul simplu.
 */
export default async function AuthLayout({ children }: { children: React.ReactNode }) {
  const productName = productNameFor(await getHostTenantBranding());

  return (
    <div className="flex min-h-svh">
      <aside
        aria-hidden="true"
        className="auth-panel relative w-[42%] max-w-xl flex-col justify-between overflow-hidden bg-primary p-12 text-primary-foreground"
      >
        <div className="bg-pattern absolute inset-0 opacity-15" />
        <p className="relative text-sm font-semibold tracking-wide uppercase opacity-80">
          Economie circulară
        </p>
        <div className="relative space-y-4">
          <p className="text-4xl leading-tight font-bold tracking-tight">{productName}</p>
          <p className="max-w-sm text-base opacity-85">
            Trasabilitatea materialelor, de la materia primă la produsul livrat clientului.
          </p>
        </div>
        <div className="relative h-1.5 w-24 rounded-full bg-accent" />
      </aside>

      <main className="bg-pattern flex flex-1 items-center justify-center p-6">
        <div className="w-full max-w-sm rounded-xl border bg-card p-8 shadow-sm">{children}</div>
      </main>
    </div>
  );
}
