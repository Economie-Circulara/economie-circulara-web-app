# Handoff — continuarea proiectului Lateris Trace

> **Pentru:** o sesiune nouă de AI (sau dezvoltator) care preia proiectul.
> **Data:** 2026-07-19. **Autor:** sesiunea de orchestrare (Claude).
> **Scop:** tot ce trebuie știut ca să continui fără să re-derivi contextul.

Acesta e un handoff de **continuare** (stare + proces). Pentru cerințe/decizii de
business, vezi [`handoff.md`](handoff.md) (documentul original) și
[`plans/implementation-plan.md`](plans/implementation-plan.md).

---

## 1. Ce este proiectul (30 secunde)

**Lateris Trace** — platformă web **multi-tenant** pentru **trasabilitatea materialelor
în economia circulară**. Clientul plătitor = firma producătoare/reciclatoare. Selling
point = **certificatul de trasabilitate PDF** (din ce loturi de materie primă, inclusiv
reciclată, e făcut un produs livrat). Stack: **Next.js 16 (App Router) + TS + Supabase
(Postgres/Auth/Storage) + shadcn/ui**, hosting **Vercel**. Roluri: super-admin, admin,
operator, client.

---

## 2. Stare curentă: **PLANUL COMPLET LIVRAT ÎN MAIN**

Toate cele 3 waves + Milestone-urile 1-3 + review-fixes sunt **mergeite în `main`**.

**Migrări (0000-0016, 17 fișiere, validate pe Postgres real în CI):**

| Mig. | Ce |
| --- | --- |
| 0000-0002 | extensii, schemă de bază, auth/tenant |
| 0003 | RLS hardening (anti-escaladare profiles + politici client pe status) |
| 0004 | stock service (`consume_fifo`/`create_lot`/`set_lot_block`) |
| 0005 | `item_kind` (physical/service) |
| 0006 | bucket documente |
| 0007 | comenzi: `order_counters`, `accept_order`, `cancel_order` |
| 0008 | `reconditioning` (lot_provenance) |
| 0009 | certificate: `certificate_counters`, `generate_certificate_number`, bucket |
| 0010 | retur: `accept_return_order` + fix RLS `order_links_client_insert` |
| 0011 | notificări (tabel) |
| 0012 | guard org suspendată (RLS `app.org_is_active` în `is_staff_of`/`is_admin_of`) |
| 0013 | livrări (`deliveries` + `delivery_declaration_status`) |
| 0014 | completare guard suspendare (client_addresses + SELECT-uri client) + index |
| 0015 | timestamps comenzi (`accepted_at`/`delivered_at`/`closed_at`) |
| 0016 | hardening review (order_links guard + unique `profiles.client_id`) |

**Verticale de feature** (fiecare în `src/features/<domeniu>/`, cu teste colocate):
`auth`, `settings`, `platform` (super-admin), `clients`, `items`, `recipes`, `stock`,
`production`, `orders`, `returns`, `certificates`, `client-portal`, `notifications`,
`reports`, `search`, `deliveries`.

**~584 teste unitare** (Vitest) verzi. Build verde. Deploy Vercel activ.

---

## 3. Arhitectură & convenții (CITEȘTE înainte de a coda)

- **AGENTS.md** = sursa de adevăr pentru proces + reguli de business (§4). Citește-l.
- **Izolare pe feature:** logică **pură** (testabilă, fără Supabase) separată de **IO**
  (`repository.ts`/`queries.ts`) și UI. Vezi `certificates/traceability.ts` (pur) +
  `certificates/repository.ts` (IO) ca model.
- **Migrări aditive, numerotate, una per task.** Următorul număr liber: **0017**.
  NU edita migrări existente.
- **RPC-uri Postgres `SECURITY INVOKER`** pentru operațiile multi-pas (rulează în
  tranzacția implicită → atomicitate + rollback; RLS activ). Coduri de eroare tipizate
  (LT00x stoc, OR00x comenzi, RT00x retur, CT00x certificate).
- **RLS peste tot**, pe `organization_id`. Helper-e `app.*` SECURITY DEFINER
  (`org_id`, `role`, `client_id`, `is_staff_of`, `is_admin_of`, `is_super_admin`,
  `org_is_active`). Testul de izolare: `supabase/tests/rls_isolation.sql`.
- **Reguli de business cheie** (AGENTS.md §4): stoc scăzut la **acceptarea** comenzii
  (nu livrare); FIFO; certificat automat la **închidere**; fără prețuri/facturare;
  un client = un user; retur readuce în stoc; fără livrări/producție parțiale;
  contracte = arhivare (nu gestiune).
- **UI în română, cod/identificatori în engleză.** Teste: **mocks, nu spies.**
- Comenzi: `pnpm dev|build|typecheck|lint|test`; DB: `pnpm db:reset|gen:types`
  (necesită Docker — vezi §5).

---

## 4. ⚠️ GOTCHA CRITIC: `database.types.ts` e ÎNTREȚINUT MANUAL

**Mediul Claude-Code-on-web NU are Docker/ghcr.io**, deci `supabase gen types` /
`pnpm gen:types` **nu pot rula** aici. `src/lib/database.types.ts` a fost **întreținut
manual** (adăugiri în stilul generat) pe tot parcursul. Consecințe:

- **NU rula `pnpm gen:types` în mediul web** și nu-i lua output-ul de bun — de două ori
  regenerarea (făcută de user pe un Supabase fără toate migrările) a ieșit **incompletă**
  (lipseau tabele/RPC-uri) și a trebuit respinsă. **Versiunea din repo (hand-maintained)
  e sursa de adevăr — e completă.**
- Verificarea de **drift** din `.github/workflows/db.yml` e **non-blocantă** și
  normalizează prin prettier (prinde drift real de schemă, nu de format). `database.types.ts`
  e în `.prettierignore`.
- **Regenerarea canonică corectă** (când cineva are Docker): `supabase db reset` (aplică
  TOATE migrările local) **apoi** `pnpm gen:types`, apoi commit. După o regenerare
  confirmată completă, drift-check-ul poate deveni blocant (vezi comentariile din db.yml).
- Când adaugi o migrare cu tabel/coloană/RPC nou: **adaugă manual tipul** în
  `database.types.ts` (vezi cum sunt adăugate `order_counters`, `deliveries`, coloanele
  `accepted_at` etc. — alfabetic, stilul existent).

---

## 5. Mediul de execuție (limitări)

- **Fără Docker/ghcr.io** în sesiunea web → nu poți rula Supabase local, `db:reset`,
  `gen:types`, sau testele E2E. Toate migrările/SQL se validează **doar în CI**
  (`db.yml` pe runnerele GitHub, unde ghcr.io e accesibil).
- Playwright/Chromium **sunt** disponibile (`/opt/pw-browsers`), dar E2E are nevoie de un
  Supabase live → rulează doar în CI (job manual acum, vezi §7).
- Scrie SQL **atent** (nu-l poți rula local); stilul migrărilor existente. Atenție la
  valori enum: `unit_of_measure` = kg|tona|mc|litru|bucata|sac|palet (**NU `buc`**).

---

## 6. Proces de lucru (branch, milestone, CI)

- **Branch de dezvoltare:** `claude/app-plan-review-w3cr7a`. Dezvoltă acolo, **PR către
  `main`**. După ce un PR se merge, **repornește branch-ul din main**
  (`git checkout -B claude/app-plan-review-w3cr7a origin/main`) pentru munca următoare.
- **Cadență:** un PR per milestone/batch coerent. Commit-uri mici, mesaj clar.
  `docs/prompt-log.md` primește o intrare la fiecare commit (regula AGENTS.md §1.2).
- **`main` e protejat** → merge prin PR. Checks:
  - **`verify`** (ci.yml): typecheck + lint + test + build. **Blocant.**
  - **`migrations`** (db.yml): pornește Supabase real, aplică toate migrările + seed,
    rulează `rls_isolation.sql`. **Blocant — ăsta e gate-ul care validează migrările/RLS.**
  - **`e2e`** (e2e.yml): **manual-only acum** (`workflow_dispatch`), nu rulează pe PR.
  - Vercel: deploy preview.
- **CLI Supabase e fixat la `2.108.0`** în db.yml/e2e.yml (nu `latest` — evită rate-limit
  „resolve latest release" la rularea simultană a job-urilor).
- **Fără Docker local ⇒ când adaugi migrări, așteaptă CI-ul `migrations` să confirme.**
  Erori tipice prinse doar acolo: enum invalid, aserțiuni RLS, seed inconsistent.

---

## 7. Orchestrarea cu subagenți (cum s-a construit)

Modelul care a funcționat (recomandat pentru continuare):

1. Lansează agenți **Sonnet** în paralel, pe **scope-uri de fișiere DISJUNCTE**
   (un feature-folder fiecare), cu **numere de migrare pre-alocate** ca să nu se ciocnească.
2. **Un singur agent** atinge un fișier partajat (ex. `database.types.ts`, `nav-config.ts`,
   `rls_isolation.sql`) per batch — restul îl evită.
3. **NU folosi worktree-uri** pentru izolare — pornesc din `origin/main` (care poate fi în
   urmă) și duc la vendorizare/merge dureros. Rulează pe arborele partajat cu scope-uri
   disjuncte (a mers curat la toate batch-urile except cel cu worktree).
4. Agenții **nu fac commit/push** — orchestratorul integrează, verifică
   (typecheck/lint/test/build), rezolvă suprapunerile, comite, PR, așteaptă CI, merge.
5. Definește milestone-uri și **fă merge în main după fiecare** (cu validare CI).

---

## 8. Ce RĂMÂNE (nimic de scris de mine — extern/manual + follow-ups mici)

### Extern / manual (utilizatorul)
1. **`supabase db push`** pe main actualizat → toate cele 16 migrări în Supabase-ul lui.
2. **Regenerare tipuri corectă** (opțional): `supabase db reset` local **apoi**
   `pnpm gen:types` — altfel iese incomplet. Sau lasă versiunea hand-maintained.
3. **Faza 3 — Auth:** dezactivează sign-up public + adaugă redirect URLs
   (`/auth/callback`, `/set-password`) în dashboard Supabase.
4. **Credențiale externe:** Socrate.io (e-Transport real) + SMTP (notificări reale).
   Adapterele sunt gata cu **mock/stub** — se cablează prin env când vin credentialele:
   - e-Transport: completează `SocrateETransportProvider.declare` în
     `src/features/deliveries/e-transport.ts` + `ETRANSPORT_PROVIDER=socrate` + `SOCRATE_*`.
   - Email: implementează providerul real în `src/features/notifications/` (interfața
     `EmailProvider` există; acum e mock care loghează).
5. **Screenshot-uri în manual** (`docs/manual/`) — din aplicația rulantă.

### Follow-ups de cod (mici, opționale — findings din review neacoperite)
- **E2E în CI:** infrastructura există (`e2e.yml`, `tests/e2e/mvp-flow.spec.ts`); jobul
  e manual-only fiindcă rularea browser pică și nu a putut fi iterată fără Docker.
  **De stabilizat:** rulează `Actions → E2E → Run workflow`, descarcă `playwright-report`
  de pe run-ul eșuat, iterează pe cauza reală (probabil auth headless / timing / date de
  seed), apoi re-activează triggerul `pull_request` + scoate `continue-on-error` din e2e.yml.
- **`reports/dashboard-queries.ts` `getDashboardKpis`** („Livrate luna curentă") încă
  filtrează pe `updated_at`; acum că există `delivered_at` (0015), poate folosi coloana
  reală (aceeași clasă de fix ca F3).
- **`cancel_order`** nu poate reface stocul într-un lot **șters** (`lot_id is not null` îl
  sare) — edge case rar; eventual creează un lot de ajustare la anulare dacă lotul lipsește.

### Decizii de proiect (netehnice, ale echipei)
- Confirmarea finală a Anexei 1 înainte de depunere (vezi `docs/anexa-1-modificari-propuse.md`).
- Programarea sesiunilor de instruire (vezi `docs/manual/instruire.md`).

---

## 9. Documente de citit (în ordine, pentru context)

1. `AGENTS.md` — proces + reguli de business (**obligatoriu**).
2. `docs/handoff.md` — cerințe/decizii originale.
3. `docs/plans/implementation-plan.md` — planul complet, cu statusuri ✅.
4. `docs/prompt-log.md` — jurnalul cronologic al fiecărui commit (istoricul deciziilor).
5. `docs/analiza-conformitate-anexa.md` — maparea pe cerințele de finanțare.
6. `docs/manual/` — manualul de utilizare + ghid administrare (scris din codul real).
7. `docs/plans/task-*.md` + `docs/plans/fix-*.md` — planul fiecărui task/fix livrat.

---

## 10. Rezumat într-o frază

**Aplicația e completă și în `main` (16 migrări, ~584 teste, deploy Vercel); ce rămâne e
configurare externă (Supabase Auth, Vercel env, credențiale Socrate.io/SMTP), stabilizarea
E2E în CI, și câteva follow-ups mici — nimic din nucleul de business nu mai e de scris.**
