# Features

Fiecare vertical de business traieste in propriul folder aici, conform regulii de
izolare din [`AGENTS.md`](../../AGENTS.md) si a planului de implementare
([`docs/plans/implementation-plan.md`](../../docs/plans/implementation-plan.md)).

Structura recomandata pentru un feature:

```
src/features/<feature>/
  components/    # UI specific feature-ului
  actions/       # server actions (mutatii)
  queries/       # citiri (data fetching)
  <feature>.types.ts
  *.test.ts(x)   # teste unitare colocate
```

Domeniile planificate (Wave 2): `clients`, `items`, `recipes`, `stock`, `production`,
`orders`, `returns`, `certificates`, `client-portal`, `admin-orgs`.
