import { SignOutButton } from "@/features/auth/sign-out-button";

export interface TopbarProps {
  email: string | null;
  roleLabel: string;
}

/** Bara de sus a shell-ului: identitatea utilizatorului + delogare. */
export function Topbar({ email, roleLabel }: TopbarProps) {
  return (
    <header className="flex items-center justify-between border-b pb-4">
      <span className="text-sm text-muted-foreground">{roleLabel}</span>
      <div className="flex items-center gap-3">
        <span className="text-sm font-medium">{email}</span>
        <SignOutButton />
      </div>
    </header>
  );
}
