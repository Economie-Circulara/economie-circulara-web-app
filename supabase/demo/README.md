# Date demo - organizația „Beton Circular SRL (demo)”

Set de date complet pentru recepție și prezentări, izolat într-o organizație proprie
(slug `beton-circular`). Nu atinge alte organizații și nu face parte din migrări.

## Ce conține

- **Conturi** (toate cu aceeași parolă, aleasă la rulare):

  | Email                             | Rol                               | Ce vede                             |
  | --------------------------------- | --------------------------------- | ----------------------------------- |
  | `super@demo.lotculot.eu`          | super_admin                       | `/platform` - toate organizațiile   |
  | `admin@demo.lotculot.eu`          | admin (Andrei Marinescu)          | tot, inclusiv setări și utilizatori |
  | `operator@demo.lotculot.eu`       | operator (Elena Dumitru)          | stoc, comenzi, livrări              |
  | `productie@demo.lotculot.eu`      | operator (Mihai Stan)             | procese de producție                |
  | `client.bravo@demo.lotculot.eu`   | client - Bravo Construct SRL      | portal                              |
  | `client.arcada@demo.lotculot.eu`  | client - Arcada Residence SRL     | portal                              |
  | `client.drumuri@demo.lotculot.eu` | client - Drumuri și Poduri Sud SA | portal                              |

- **~6 luni de istoric** (relativ la data rulării): 8 clienți (inclusiv furnizori și o
  instituție publică), 18 itemi (deșeuri, agregate reciclate, produse din beton,
  echipamente închiriabile, 3 abonamente), 6 rețete, ~75 de loturi pe toate proveniențele,
  ~33 de procese (reciclare, producție, recondiționare, plus procese planificate / în lucru /
  în așteptare / anulate), ~47 de comenzi în toate statusurile, livrări cu UIT declarat /
  eșuat / nedeclarat, închirieri (una cu termen de retur depășit), retururi, o garanție cu
  comandă de înlocuire, loturi blocate, o ajustare de inventar.
- **Certificate PDF** pentru toate comenzile închise și **documente atașate** (contracte,
  fișe tehnice, procese-verbale), marcate vizibil ca demonstrative.

Emailurile de contact ale clienților sunt adrese de test Resend (`delivered+…@resend.dev`),
ca notificările declanșate în timpul unei demonstrații să nu ajungă la terți.

## Cum e construit

`seed-demo.sql` rulează fiecare operațiune prin RPC-urile reale ale aplicației
(`create_lot`, `confirm_process`, `accept_order`, `cancel_order`, `accept_return_order`,
`set_lot_block`, `consume_fifo`) cu identitatea utilizatorului care ar fi făcut-o în UI, deci
FIFO, verificările de stoc, RLS și auditul sunt cele din producție. La final verifică
consistența stocului și face rollback complet la orice eroare.

Certificatele și documentele au nevoie de fișiere în Storage, deci se generează separat, cu
același cod ca aplicația (`scripts/demo/build-demo-artifacts.tsx`), fără chei: scriptul
lucrează doar pe un export JSON, iar urcarea se face cu Supabase CLI.

## Rulare (proiectul legat, `--linked`)

Din rădăcina repo-ului, cu Supabase CLI autentificat și proiectul legat (`supabase link`).
Pentru stack-ul local, înlocuiește `--linked` cu `--local`.

```bash
# 1. Datele (parola NU se comite - fișierul temporar rămâne în afara repo-ului)
DEMO_PASSWORD='…minim 12 caractere…'
sed "s/__DEMO_PASSWORD__/$DEMO_PASSWORD/" supabase/demo/seed-demo.sql > /tmp/seed-demo.sql
supabase db query --linked -f /tmp/seed-demo.sql && rm /tmp/seed-demo.sql

# 2. Export + generare certificate/documente
supabase db query --linked -f scripts/demo/export-demo-data.sql -o json > .demo-artifacts.json
JITI_JSX=1 JITI_ALIAS="{\"@\":\"$PWD/src\"}" pnpm exec jiti scripts/demo/build-demo-artifacts.tsx .demo-artifacts.json .demo-artifacts

# 3. Fișierele în Storage (`cp -r` păstrează numele directorului = numele bucketului),
#    apoi rândurile din baza de date
supabase --experimental storage cp -r .demo-artifacts/storage/certificates ss:/// --linked -j 4
supabase --experimental storage cp -r .demo-artifacts/storage/documents ss:/// --linked -j 4
supabase db query --linked -f .demo-artifacts/artifacts.sql
```

`.demo-artifacts*` e în `.gitignore`.

## Ștergere

```bash
ORG_ID=…   # select id from organizations where slug = 'beton-circular'
supabase --experimental storage rm -r ss:///certificates/$ORG_ID --linked --yes
supabase --experimental storage rm -r ss:///documents/$ORG_ID --linked --yes
supabase db query --linked -f supabase/demo/teardown-demo.sql
```

După ștergere, pașii de rulare pot fi reluați (datele se regenerează relativ la data curentă -
util înainte de o demonstrație, ca „luna aceasta” din dashboard să aibă activitate).
