import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

// Actiunile sunt server actions ("use server"); le mock-uim ca sa nu incerce sa
// contacteze Supabase / Next request context in mediul de test.
vi.mock("./actions", () => ({
  signInWithPasswordAction: vi.fn(),
  signInWithMagicLinkAction: vi.fn(),
  signInWithGoogleAction: vi.fn(),
}));

import { LoginForm } from "./login-form";

describe("LoginForm - mesaje de eroare din `?error=`", () => {
  it("nu afiseaza niciun mesaj cand nu exista `errorCode`", () => {
    render(<LoginForm orgName="Lateris Trace" />);
    expect(screen.queryByText(/Contul tau nu este inca provizionat/i)).not.toBeInTheDocument();
  });

  it("afiseaza mesajul pentru utilizator neprovizionat (`error=unprovisioned`)", () => {
    render(<LoginForm orgName="Lateris Trace" errorCode="unprovisioned" />);
    expect(
      screen.getByText(
        "Contul tau nu este inca provizionat. Cere o invitatie administratorului organizatiei tale.",
      ),
    ).toBeInTheDocument();
  });

  it("afiseaza mesajul pentru sesiune expirata/invalida (`error=auth`)", () => {
    render(<LoginForm orgName="Lateris Trace" errorCode="auth" />);
    expect(screen.getByText(/Link expirat sau invalid/i)).toBeInTheDocument();
  });

  it("afiseaza mesajul pentru esec OAuth (`error=oauth`)", () => {
    render(<LoginForm orgName="Lateris Trace" errorCode="oauth" />);
    expect(screen.getByText(/Nu am putut porni autentificarea cu Google/i)).toBeInTheDocument();
  });

  it("ignora coduri de eroare necunoscute", () => {
    render(<LoginForm orgName="Lateris Trace" errorCode="ceva-necunoscut" />);
    expect(screen.queryByText(/Link expirat/i)).not.toBeInTheDocument();
  });
});
