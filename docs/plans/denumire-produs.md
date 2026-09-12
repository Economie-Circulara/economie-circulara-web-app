# Denumirea produsului — analiză și decizie

> **DECIS (2026-09-12): produsul se numește „Provenio".** Redenumirea e aplicată în cod,
> teste și documentație. Restul documentului păstrează analiza care a dus la decizie.

**Context (2026-09-12):** „Provenio" **nu e un nume decis**. A apărut în faza de
mockup (`docs/design/Lateris_Trace.dc.html`) și s-a propagat ca nume de produs prin
titlurile de pagină, valorile de fallback și footerul certificatului. **Nu vine de la
client:** nu apare nici în `docs/brain-dump.md`, nici în `docs/design-prompt.md`.

Decizia devine urgentă acum, pentru că numele apare în locuri cu consecințe:

1. **Entry point-ul public** al platformei (rădăcina domeniului) — nu poate purta numele
   unei organizații anume. Rezolvat arhitectural: pagina afișează brandul unei organizații
   **doar** când tenantul se rezolvă din subdomeniu / domeniu propriu / segment de path;
   pe domeniul platformei descrie funcția. Vezi `src/app/page.tsx`.
2. **Footerul certificatului de trasabilitate** — „trasabilitate emisă de {platformă}".
   Apare pe un document pe care clientul îl dă mai departe partenerilor lui.
3. **Disclaimerul legal** propus în `docs/analiza-standarde-certificat.md` numește
   platforma ca furnizor de software, distinct de emitentul certificatului.
4. **Contractul de licență** către clienți (vezi `docs/analiza-cerere-finantare-client-paas.md`).
5. **Domeniul** — modelul comercial e „entry point per client" (subdomeniu sau domeniu
   propriu), deci e nevoie de un domeniu-rădăcină al platformei pentru subdomenii de tenant
   (`<client>.<platformă>.ro`) și pentru `NEXT_PUBLIC_ROOT_DOMAIN`.

## De ce „Lateris" e o alegere slabă

- **Citește ca numele unui client**, nu al unei platforme multi-tenant — exact obiecția
  ridicată. Platforma se vinde mai multor firme.
- **Prea îngust:** *later* (lat.) = cărămidă. Platforma nu e despre cărămizi; e generică
  peste materiale (agregate, beton, balast, deșeuri de umplutură) și e vândută și unor
  firme fără legătură cu zidăria.
- Nu spune nimic despre ce face produsul.

## Criterii

| Criteriu | De ce |
| --- | --- |
| Înțeles imediat de un profesionist român | Cumpărătorul e o firmă RO de construcții/reciclare |
| Funcționează și internațional | Context de finanțare UE + revânzare; fără diacritice, fără capcane de pronunție |
| Neutru față de tipul de material | Produsul e generic; nu-l legăm de cărămizi sau beton |
| Sună instituțional, de încredere | Produsul emite documente folosite în relații comerciale și la control |
| Domeniu liber (.ro + un TLD internațional) | Nevoie reală de domeniu-rădăcină pentru subdomenii de tenant |

## Opțiuni, cu disponibilitate verificată (2026-09-12, prin Vercel)

### 1. Provenio — **ALES**

*Proveniența* e exact ce dovedește certificatul: din ce loturi vine materialul livrat. Un
profesionist român înțelege cuvântul fără explicație („proveniența materialului"), iar
rădăcina latină îl face lizibil în toată UE. Neutru față de material. Sună a document, nu
a gadget — potrivit pentru un produs de conformitate.

| Domeniu | Stare |
| --- | --- |
| `provenio.ro` | **liber** |
| `provenio.io` | **liber** (~$30/an) |
| `provenio.eu` | **liber** (Vercel nu vinde `.eu`; se ia de la alt registrar) |
| `provenio.com` / `.app` / `.dev` | ocupate |

Disponibilitatea simultană pe `.ro` + `.io` + `.eu` e neobișnuită și e argumentul decisiv.

### 2. Recircula

Cel mai imediat lizibil pentru piața românească, energic, spune „economie circulară" din
prima. Dezavantaj: accentuează **reciclarea**, nu trasabilitatea și conformitatea — care
sunt diferențiatorul real. `recircula.ro` e **ocupat**; liber doar `recircula.app` (~$10/an),
ceea ce slăbește opțiunea, fiindcă `.app` e slab pentru un domeniu-rădăcină vândut unor
firme tradiționale din construcții.

### 3. Circularis

`circularis.ro` **liber**. Latin-ish, prietenos UE, dar generic: nu spune nimic despre
trasabilitate și seamănă cu multe branduri de „economie circulară".

### 4. Amână decizia, folosește un subdomeniu pe `nvxapp.ro` (deja deținut)

Cost zero, fără blocaj: platforma stă pe ceva de tipul `trace.nvxapp.ro`, iar numele se
decide după recepție. Potrivit **dacă** recepția e în sub 2 săptămâni și prioritatea e
funcționalitatea. Riscul: numele ajunge pe certificate și în contractul de licență, iar
schimbarea ulterioară cere retrimiterea documentelor.

## Atenție la prețul `.ro` prin Vercel

Vercel cere **$110.99/an** pentru `.ro`. Prețul pieței la un registrar acreditat ROTLD e de
ordinul **10-15 €/an** — de 7-10 ori mai ieftin. Recomandare: cumpără `.ro` de la un
registrar românesc și îndreaptă DNS-ul către Vercel; ia prin Vercel doar TLD-urile unde
prețul e rezonabil (`.io` la $30 e aproape de piață).

## Suprafața de redenumire în cod

Numele platformei e acum centralizat în **`src/lib/brand.ts`** (`PLATFORM_NAME`), folosit de
entry point-ul public. Până la decizie, valoarea e un **descriptor**, nu un brand inventat,
iar pagina publică nu afișează niciun nume de firmă când nu există tenant.

Rămâne un singur pass mecanic după decizie: titlurile de pagină (`metadata.title`) și
valorile de fallback `?? "Provenio"` din ~20 de fișiere din `src/app/` și
`src/features/`, plus footerul din `src/features/certificates/pdf.tsx` și textele din
`docs/` (inclusiv disclaimerul din `docs/analiza-standarde-certificat.md`).

---

## Stadiul redenumirii (2026-09-12)

**Aplicat:** 65 de fișiere pentru „Lateris Trace" → „Provenio" și 9 pentru variantele
lowercase (`lateristrace` / `lateris-trace`). Incluse:

- `src/lib/brand.ts` — `PLATFORM_NAME = "Provenio"`, sursa unică la runtime. Cele 8 locuri
  care aveau `?? "Lateris Trace"` ca fallback de brand importă acum constanta, nu un
  literal duplicat.
- `src/features/notifications/service.ts` — adresa implicită de expediere a notificărilor
  a devenit `notificari@provenio.ro` (era `notificari@lateristrace.app`). **Relevant pentru
  configurarea email:** domeniul de pe care pleacă emailurile trebuie verificat la
  providerul de email.
- `src/features/client-portal/cart-context.tsx` — cheia de `localStorage` a coșului
  (`provenio:cart:v1`). Schimbarea golește coșurile existente; fără efect acum, fiindcă
  producția nu are încă utilizatori reali.
- `package.json` — `"name": "provenio"`.
- Titlurile de pagină, footerele din PDF-uri (certificat, aviz, rapoarte), fixture-urile de
  test și documentația, inclusiv disclaimerul din `docs/analiza-standarde-certificat.md`.

**Păstrate intenționat:**

- `docs/design/Lateris_Trace.dc.html` și referințele la el din comentarii — e numele real
  al fișierului de mockup, o referință istorică.
- `Lateris Demo`, organizația demo din `supabase/seed.sql`. E numele unui **tenant**, nu al
  platformei, deci nu e incoerent („o firmă demo în Provenio"). Redenumirea ar atinge
  seed-ul, cele 28 de capturi de ecran, textul manualelor și testele E2E — cost mare,
  valoare mică. Opțional, după recepție.
- Testul-gardă din `src/app/page.test.tsx`, care verifică explicit că „Lateris" **nu** mai
  apare pe entry point-ul platformei.

**Rămas de făcut — o singură apariție:**

```
src/app/(client)/comenzile-mele/[id]/page.tsx:14
export const metadata = { title: "Detalii comandă - Lateris Trace" };
```

Fișierul era în curs de editare de o sesiune concurentă (Codex) în momentul redenumirii, iar
un `sed` peste el i-ar fi putut pierde munca necommitată. De schimbat la prima atingere.

## Pașii de domeniu (de făcut de client — cumpărarea nu se automatizează)

1. **`provenio.ro`** de la un registrar acreditat ROTLD (~10-15 €/an). **Nu** prin Vercel,
   care cere $110.99/an pentru `.ro`.
2. Opțional `provenio.io` ($30/an, aproape de prețul pieței) și/sau `provenio.eu` — ambele
   erau libere la verificare.
3. În Vercel: adaugă domeniul pe proiect și urmează instrucțiunile DNS.
4. Setează `NEXT_PUBLIC_ROOT_DOMAIN=provenio.ro` în variabilele de producție. Abia atunci
   rezolvarea tenantului din **subdomeniu** devine activă (`<client>.provenio.ro`); până
   atunci funcționează pe segment de path.
5. Verifică domeniul la providerul de email, ca notificările să plece de pe
   `notificari@provenio.ro`.
