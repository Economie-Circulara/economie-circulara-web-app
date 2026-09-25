# Asistent AI - performanta, quick wins (PR 1 din 2)

## Problema

Asistentul (DeepSeek) raspunde greu si des cu „împarte cererea în pași mai mici” sau
nu intelege. Cauzele gasite in cod (nu doar in model):

1. `MAX_STEPS = 5` in `run.ts`, iar fiecare runda = UN apel de tool (fara paralele).
   O comanda cu client + cateva produse + stoc depaseste usor 5 runde -> mesajul
   generic „împarte în pași”, care arunca tot ce s-a gasit.
2. Thinking mode DeepSeek pornit automat la FIECARE runda -> un CoT lung per cautare,
   tura dureaza zeci de secunde.
3. Rezultatele tool-urilor taiate cu `JSON.stringify(...).slice(0, 6000)` -> JSON rupt.

## Schimbari

- `provider.ts`: thinking mode DeepSeek devine opt-in (`ASSISTANT_THINKING=enabled`);
  `reasoning_content` primit se retrimite in continuare (necesar cand e activ).
- `run.ts`: `MAX_STEPS` 5 -> 12; la limita, un ultim apel FARA tool-uri cere modelului
  un rezumat (ce a gasit + ce lipseste); mesajul generic ramane doar ca fallback.
- `tool-result.ts` (nou): `serializeToolResult` - trunchiere care pastreaza JSON valid
  (listele pierd elemente de la coada + nota `trunchiat/total/afisate`).
- `.env.example`: documentat `ASSISTANT_THINKING`.

## Teste

- `provider.test.ts`: thinking oprit implicit, pornit doar cu env / flag.
- `run.test.ts`: rezumat la limita de pasi (apel fara tool-uri), fallback, JSON valid.
- `tool-result.test.ts`: trunchierea.

## Impact asupra asistentului (regula 2.4)

Decizie: `none` - niciun tool nou/modificat, registrul ramane neschimbat; se schimba
doar bucla si furnizorul.

## Urmeaza (PR 2)

Cautari multiple intr-un apel, ID-uri pastrate intre ture, cautare toleranta
(diacritice, SRL/SC), indicator de progres - `docs/plans/asistent-performanta-part2.md`.
