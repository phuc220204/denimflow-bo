# Dev demo accounts (template)

Copy this file to `account-dev.md` (git-ignored) and fill in the password the owner sends you privately:

```bash
cp account-dev.example.md account-dev.md
```

These accounts exist only on the **Supabase dev** project (`denimflow-dev`). They are created by `pnpm --filter @denimflow/api db:seed`, which also resets them to `SEED_DEFAULT_PASSWORD` from `apps/api/.env`.

**Password (all 7 accounts):** `<ask the owner; never write it in this template>`

| Role | Email | Station |
|---|---|---|
| ADMIN | `admin@denimflow.internal` | — |
| PROCESS_ENGINEER | `pe@denimflow.internal` | — |
| PRODUCTION_PLANNER | `planner@denimflow.internal` | — |
| WAREHOUSE_KEEPER | `warehouse@denimflow.internal` | — |
| STATION_OPERATOR | `operator@denimflow.internal` | `CUT-01` (cutting) |
| QC_INSPECTOR | `qc@denimflow.internal` | `QC-01` |
| MANAGER | `manager@denimflow.internal` | — |

## Rules (people and AI agents)

- Dev only. Never use these accounts or this password on production (`denimflow-prod` has its own seed password).
- `account-dev.md` must stay git-ignored: never commit it, never paste the password into a PR, issue, commit message, code, test, log or a shared chat.
- Agents may read `account-dev.md` to log in to the local web app or to run `pnpm --filter @denimflow/api smoke:roles`; they must not copy the password anywhere else.
- If the password leaks, tell the owner: they change `SEED_DEFAULT_PASSWORD` and run `db:seed` again.
