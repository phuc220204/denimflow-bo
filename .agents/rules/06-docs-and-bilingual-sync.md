# 06 — Docs and bilingual sync

## Which file is the truth for what

| Topic | File |
|---|---|
| Scope, roles, MVP acceptance criteria, glossary | `docs/<lang>/PRD.md` |
| BR-01..19, workflow steps, state machines, FR traceability, deviations log | `docs/<lang>/BUSINESS_RECONCILIATION.md` |
| Schema, constraints, transactions, seed | `docs/<lang>/DATABASE_DESIGN.md` |
| Setup, env vars, deploy, troubleshooting | `docs/<lang>/DEVELOPMENT_SETUP.md` |
| Architecture decisions | `docs/adr/NNNN-title.md` |
| Team workflow guide for humans (Vietnamese): env, branch/commit conventions, pre-push checklist | `Tutorial_denimflow-bo.md` (keep in sync with rule 03) |
| Onboarding: clone, install, run checks and the API locally, common problems | `docs/<lang>/GETTING_STARTED.md` (update when setup steps change) |
| Team task board (Vietnamese, single language): who takes which task, dependencies | `docs/TASK_BOARD.md` (details stay in `.agents/tasks/`) |
| UI design system, Vietnamese UI glossary, Stitch prompts (single language, Vietnamese UI text) | `docs/design/` |
| Original business documents (Proposal V2.0, Appendix) | `docs/reference/` (read-only source) |

Precedence when they disagree: `docs/reference` (business intent) → `BUSINESS_RECONCILIATION.md` (agreed interpretation) → `PRD.md` → code. A conflict is a question for the owner, then a row in `BUSINESS_RECONCILIATION.md` §7.

## Bilingual rule

- `docs/en` is canonical for agents; `docs/vi` mirrors it for the team and the lecturer.
- Change both in the same PR. If you cannot translate now, put `<!-- sync: pending -->` as the first line of the stale file and say so in the PR.
- Keep identifiers (BR-xx, FR-xx, step codes, table names, enum values) identical in both languages. Translate prose only; keep established technical terms in English (Gate, Snapshot, Workflow Instance, ...).
- Same headings structure and numbering in both languages so that sections can be compared side by side.

## When to update what

| Change | Update |
|---|---|
| Implemented or changed a business rule | `BUSINESS_RECONCILIATION.md` §2 status + §7 log |
| Schema change | Migration, `DATABASE_DESIGN.md`, seed if needed |
| New env variable | `.env.example`, `DEVELOPMENT_SETUP.md` §4 |
| Finished a task | Check boxes in the task file, `PROJECT_STATE.md` |
| Architectural decision with trade-offs | New ADR |
| Changed branch/commit/PR conventions or pre-push commands | Rule 03, `Tutorial_denimflow-bo.md`, `README.md`, PR template, `AGENTS.md` (same PR) |

## ADR template (`docs/adr/NNNN-title.md`)

```
# NNNN — Title
Status: proposed | accepted | superseded by NNNN
Date: YYYY-MM-DD
## Context
## Decision
## Consequences (pros / cons / trade-offs)
```
