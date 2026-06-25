# Prompt Log

Jurnal al sarcinilor lucrate de agenti AI in acest repo. Conform regulii 1.2 din
[`AGENTS.md`](../AGENTS.md), la **fiecare commit** se adauga o intrare aici.
Cele mai noi intrari sus.

Format intrare:
- **Data** — YYYY-MM-DD
- **Agent / model**
- **Cerut** — rezumat al sarcinii
- **Facut** — rezumat al modificarilor

---

## 2026-06-25 — Claude Opus 4.8
- **Cerut:** task-ul de scaffolding (T0.1) sa aiba ca criteriu de acceptare completarea
  sectiunii §3.1 din AGENTS.md (cai catre domenii + comenzi).
- **Facut:** adaugat criteriul de acceptare „AGENTS.md §3.1 completat" la T0.1 in
  `docs/plans/implementation-plan.md`.

## 2026-06-25 — Claude Opus 4.8
- **Cerut:** creare AGENTS.md cu reguli generale (planuri in `docs/plans/`, prompt log
  la commit, actualizare reguli la corectii, teste unitare obligatorii, descriere proiect
  + cai/comenzi), plus fisier de prompt log.
- **Facut:** adaugat `AGENTS.md` (reguli de proces, testare, descriere proiect, reguli de
  business). Creat `docs/prompt-log.md`. Mutat planul in `docs/plans/implementation-plan.md`
  si actualizat link-urile din `docs/index.md`.

## 2026-06-25 — Claude Opus 4.8
- **Cerut:** plan de implementare care imparte proiectul in task-uri pentru agenti AI.
- **Facut:** adaugat `docs/plans/implementation-plan.md` (waves, dependente, contracte
  interne, criterii de acceptare, spikes) si link din `docs/index.md`.
