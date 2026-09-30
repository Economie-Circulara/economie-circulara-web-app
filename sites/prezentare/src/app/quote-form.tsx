"use client";

import { useState, type FormEvent } from "react";
import { sendQuote, validateQuote, type QuoteFormValues } from "@/lib/quote";

interface QuoteFormProps {
  appDomain: string;
  services: string[];
  /** Contactul direct, afisat daca trimiterea esueaza. */
  fallbackContact: string | null;
}

type Status =
  | { kind: "idle" }
  | { kind: "sending" }
  | { kind: "sent" }
  /** `network`: esec la trimitere (nu validare) -> aratam contactul direct. */
  | { kind: "error"; message: string; network: boolean };

const EMPTY = { name: "", phone: "", email: "", message: "", consent: false, website: "" };

/**
 * Formularul „Cere o ofertă” (plan docs/plans/site-cerere-oferta.md). Cererea ajunge in
 * aplicatia firmei si pe emailul ei. Fara cookie-uri, fara scripturi terte.
 */
export function QuoteForm({ appDomain, services, fallbackContact }: QuoteFormProps) {
  const [values, setValues] = useState<QuoteFormValues>({ service: services[0], ...EMPTY });
  const [status, setStatus] = useState<Status>({ kind: "idle" });

  const set = <K extends keyof QuoteFormValues>(key: K, value: QuoteFormValues[K]) =>
    setValues((v) => ({ ...v, [key]: value }));

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const invalid = validateQuote(values);
    if (invalid) {
      setStatus({ kind: "error", message: invalid, network: false });
      return;
    }
    setStatus({ kind: "sending" });
    const result = await sendQuote(appDomain, values);
    if (result.ok) {
      setValues({ service: values.service, ...EMPTY });
      setStatus({ kind: "sent" });
    } else {
      setStatus({ kind: "error", message: result.error, network: true });
    }
  }

  if (status.kind === "sent") {
    return (
      <div className="quote quote-sent" id="oferta" role="status">
        <h2>Cererea a fost trimisă</h2>
        <p>Mulțumim! Vă contactăm în cel mai scurt timp.</p>
        <button
          type="button"
          className="btn btn-outline"
          onClick={() => setStatus({ kind: "idle" })}
        >
          Trimite altă cerere
        </button>
      </div>
    );
  }

  return (
    <form className="quote" id="oferta" onSubmit={onSubmit} noValidate>
      <h2>Cere o ofertă</h2>
      <p className="quote-sub">Spune-ne de ce ai nevoie și te sunăm noi.</p>

      <div className="field">
        <label htmlFor="q-service">Serviciu</label>
        <select
          id="q-service"
          value={values.service}
          onChange={(e) => set("service", e.target.value)}
        >
          {services.map((s) => (
            <option key={s}>{s}</option>
          ))}
        </select>
      </div>
      <div className="field-row">
        <div className="field">
          <label htmlFor="q-name">Nume</label>
          <input
            id="q-name"
            autoComplete="name"
            placeholder="Nume și prenume"
            value={values.name}
            onChange={(e) => set("name", e.target.value)}
            maxLength={120}
            required
          />
        </div>
        <div className="field">
          <label htmlFor="q-phone">Telefon</label>
          <input
            id="q-phone"
            type="tel"
            inputMode="tel"
            autoComplete="tel"
            placeholder="07xx xxx xxx"
            value={values.phone}
            onChange={(e) => set("phone", e.target.value)}
            maxLength={40}
            required
          />
        </div>
      </div>
      <div className="field">
        <label htmlFor="q-email">
          Email <span className="optional">(opțional)</span>
        </label>
        <input
          id="q-email"
          type="email"
          autoComplete="email"
          value={values.email}
          onChange={(e) => set("email", e.target.value)}
          maxLength={200}
        />
      </div>
      <div className="field">
        <label htmlFor="q-message">Detalii</label>
        <textarea
          id="q-message"
          placeholder="Cantitate, locația șantierului, termen"
          value={values.message}
          onChange={(e) => set("message", e.target.value)}
          maxLength={2000}
          rows={3}
        />
      </div>

      {/* Capcana pentru boti: ascunsa oamenilor si cititoarelor de ecran. */}
      <div className="hp" aria-hidden="true">
        <label htmlFor="q-website">Website</label>
        <input
          id="q-website"
          tabIndex={-1}
          autoComplete="off"
          value={values.website}
          onChange={(e) => set("website", e.target.value)}
        />
      </div>

      <label className="consent">
        <input
          type="checkbox"
          checked={values.consent}
          onChange={(e) => set("consent", e.target.checked)}
        />
        <span>
          Sunt de acord ca datele de mai sus să fie folosite pentru a fi contactat în legătură cu
          această cerere. <a href="/confidentialitate">Detalii</a>
        </span>
      </label>

      <button className="btn btn-primary" type="submit" disabled={status.kind === "sending"}>
        {status.kind === "sending" ? "Se trimite..." : "Trimite cererea"}
      </button>
      {status.kind === "error" && (
        <p className="quote-error" role="alert">
          {status.message}
          {status.network && fallbackContact && ` Contact direct: ${fallbackContact}.`}
        </p>
      )}
    </form>
  );
}
