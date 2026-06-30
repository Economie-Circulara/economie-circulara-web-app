import type * as React from "react";

/** Layout centrat pentru ecranele de autentificare (login, resetare, set parola). */
export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <main className="bg-pattern flex min-h-svh items-center justify-center p-6">
      <div className="w-full max-w-sm rounded-xl border bg-card p-8 shadow-sm">{children}</div>
    </main>
  );
}
