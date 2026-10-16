# Tasks

One file per sprint. Work top to bottom; one task = one branch = one PR.

## Format

```
### T<sprint>.<n> Title            [owner: agent | owner(human)]
Branch: feat/<module>-<topic>
FR/BR: FR-07, BR-03
Do:
- bullet steps
Acceptance:
- [ ] testable criterion
```

`[owner: human]` tasks are manual steps for the repo owner (creating cloud projects, dashboard settings, ruleset). An agent must not attempt them; it should ask the owner to do them and wait.

## Sprints

| File | Goal | FRs |
|---|---|---|
| `S0-scaffold-and-pipeline.md` | Monorepo, CI, deploy a hello-world through web → API → DB → Auth | — |
| `S1-auth-rbac-master-data.md` | Login, RBAC, catalogs, Fabric–Color Matrix | FR-01, FR-02 |
| `S2-workflow-engine-and-designer.md` | Engine core + template designer + publish | FR-04, FR-05 |
| `S3-order-confirm-snapshot.md` | Create/Confirm order, BOM, allocation, snapshot | FR-07, FR-08, FR-09, FR-11 |
| `S4-execution-gates-quantities.md` | Worklist, quantity entry, Gates | FR-12, FR-13 |
| `S5-qc-rework-dashboard.md` | QC, rework, QC Profile, dashboard, handover, E2E | FR-16, FR-17, FR-21, FR-26 |

Sprint length is a planning default (2 weeks). Compress to fit the real deadline (`PROJECT_STATE.md` O1). Never skip S0: it exposes every infrastructure problem while nothing is at stake.
