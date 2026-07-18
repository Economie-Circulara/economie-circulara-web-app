# Task X1 — Notificari email

Plan scurt (AGENTS.md §1.1), scris inainte de codare.

## Scop

La fiecare tranzitie de status a unei comenzi (trimisa/acceptata/livrata/inchisa/
anulata), trimite un email catre client, folosind sender-ul white-label al
organizatiei (`organizations.email_from_name`/`email_from_address`). Jurnalizeaza
fiecare incercare in tabelul `notifications` (queued -> sent/failed). Nu rupe
tranzitia comenzii daca emailul esueaza. PASTREAZA wiring-ul certificatului (Task
G) din `orders/notifications.ts`.

## Ce se adauga

1. `supabase/migrations/0011_notifications.sql` (aditiva): enum-uri
   `notification_type` / `notification_status` + tabel `notifications` + RLS
   (staff SELECT pe organizatia proprie; INSERT/UPDATE DOAR `service_role` —
   niciun grant de insert/update catre `authenticated`).
2. `src/lib/database.types.ts`: intrarea `notifications` (Tables) + cele doua
   enum-uri noi, in stilul manual folosit pt. `order_counters`/RPC-urile Task E/G
   (fara acces la `pnpm gen:types` in acest mediu).
3. `src/features/notifications/`:
   - `types.ts` — `NotificationRecord`, alias-uri pt. enum-urile DB.
   - `provider.ts` — interfata `EmailProvider` + `ConsoleEmailProvider` (mock,
     jurnalizeaza, folosit implicit in dev/teste) + `HttpApiEmailProvider` (stub
     real, configurabil prin env `EMAIL_API_URL`/`EMAIL_API_KEY`) +
     `getEmailProvider()` (alege intre ele).
   - `templates.ts` — `renderOrderStatusEmail(data, toStatus)` (randare PURA, RO)
     + `notificationTypeForOrderStatus(status)` (mapare status -> tip notificare,
     `null` pt. `draft`).
   - `service.ts` — `sendOrderStatusNotification(event, provider?)`: rezolva
     tipul, verifica idempotenta (notificare `sent` deja existenta pt.
     comanda+tip), incarca datele comenzii/clientului/organizatiei prin clientul
     ADMIN, randeaza, insereaza `queued`, apeleaza providerul, actualizeaza
     `sent`/`failed`. Nu arunca daca DOAR providerul esueaza.
4. `src/features/orders/notifications.ts`: `onOrderStatusChanged` apeleaza acum
   `sendOrderStatusNotification` la FIECARE tranzitie (try/catch, doar
   jurnalizare la eroare) — apelul catre `generateCertificateForOrder` la
   `closed` (Task G) ramane NESCHIMBAT, doar mutat dupa blocul de notificare.
5. Teste colocate (Vitest, mocks): `templates.test.ts`, `provider.test.ts`,
   `service.test.ts` + extinderea `orders/notifications.test.ts` (verifica ca
   hook-ul apeleaza ambele servicii si ca o eroare la notificare nu o blocheaza
   pe cea de certificat, si invers).

## Decizii/trade-off-uri

- **Citirea datelor comenzii/clientului/organizatiei foloseste clientul ADMIN**
  (nu clientul legat de sesiune, ca la `certificates/service.ts`): serviciul
  ruleaza DUPA ce tranzitia a fost deja autorizata de action-ul apelant, deci nu
  mai e nevoie de o a doua verificare RLS aici, iar hook-ul ramane corect
  indiferent de contextul de sesiune/cookie al apelantului.
- **Idempotenta**: o notificare `sent` deja existenta pt. (comanda, tip) opreste
  o retrimitere — suficient pt. cerinta "idempotent rezonabil", fara sa introduca
  un mecanism de deduplicare mai complex (ex. cheie unica compusa) — in afara
  scope-ului acestui task.
- **Providerul real e un stub minimal** (POST JSON generic, fara retry/backoff),
  neexercitat in teste (doar formatul cererii, cu `fetch` mockuit). Alegerea
  providerului activ (real vs. mock) e determinata STRICT de prezenta
  `EMAIL_API_URL`/`EMAIL_API_KEY` — nicio dependenta de un SMTP real in teste.
- **Invitatiile de staff (T1.3)** raman neschimbase — `inviteStaffAction` continua
  sa foloseasca emailul built-in Supabase Auth. Enum-ul `notification_type`
  include `staff_invite` pt. consistenta viitoare, dar nu e emis de niciun cod
  in acest task (optional, neutilizat inca).
