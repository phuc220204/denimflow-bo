# BUSINESS_RECONCILIATION — DenimFlow BO

Version 0.1 · 2026-10-16 · Language: EN (canonical) · Mirror: `docs/vi/BUSINESS_RECONCILIATION.md`

## 1. Purpose and precedence

This file reconciles the **business intent** (Proposal V2.0 and its Appendix, in `docs/reference/`) with the **implementation**: for every business rule and requirement it states where it is enforced, in which module, in which sprint, and its status. It also records every place where the implementation interprets or deviates from the Proposal (§7).

Precedence when sources disagree: `docs/reference` (intent) → this file (agreed interpretation) → `PRD.md` → code. A conflict is never resolved silently: ask the owner, then add a row to §7.

Status values: `TODO`, `IN PROGRESS`, `DONE`, `DEFERRED` (outside MVP, deliberately), `DEVIATION` (implemented differently, see §7).

## 2. Business rules (BR-01 .. BR-19)

"Layer" = where the rule is enforced: **E** engine (`packages/engine`), **A** API service, **D** database constraint/trigger, **W** web (UX only, never the only enforcement).

| ID | Rule | Layer | Module | Sprint | Status |
|---|---|---|---|---|---|
| BR-01 | Publish only valid templates: exactly one start step, an end step exists, every step has a path to an end, no orphan steps, every rework loop has an iteration limit | E, A (publish), W (preview) | workflow | S2 | DONE |
| BR-02 | Versions are immutable. Editing a template creates a new version; a template with running orders may only be deactivated, never deleted | A, D (trigger + partial unique index) | workflow | S2 | DONE |
| BR-03 | At Confirm, snapshot the PUBLISHED version of the Style; a Style without a PUBLISHED template cannot be confirmed | A, E | order | S3 | DONE |
| BR-04 | Only colors listed in the Fabric–Color Matrix for the selected fabric type may be chosen | A, D (data), W (filter) | order, catalog | S1 data / S3 | DONE |
| BR-05 | Once CUTTING starts, fabric–color–wash is locked. Changing it needs BR-13 or cancelling the order | A | order | S3 (lock enforced from S4) | DONE |
| BR-06 | CUTTING may not start unless fabric is fully allocated per the BOM | E (Gate) | inventory, execution | S3–S4 | DONE |
| BR-07 | Total cut quantity per size may not exceed plan + configured tolerance | E, A | execution | S4 | DONE |
| BR-08 | Quantity conservation: quantity entering the next step ≤ good quantity of the previous step; the difference must match recorded defects or wastage | E, A, D (row lock + CHECK) | execution | S4 | DONE |
| BR-09 | Outsourced wash/dye: quantity received must be reconciled with quantity sent; a mismatch needs a recorded reason | A, E | execution | S4 | DONE |
| BR-10 | QC Fail/Rework must select a step to return to and record a reason. Beyond the max rework loops, the order goes to the Planner | E, A | quality | S5 | TODO |
| BR-11 | Separation of duties: whoever performed a step may not approve QC of that step; the Process Engineer may not confirm completion of production steps | A | execution, quality | S4 / S5 | DONE |
| BR-12 | Cancelling needs a reason. Before CUTTING release all allocations; from CUTTING onward record cut fabric and cost | A | order | post-MVP (FR-10) | DEFERRED |
| BR-13 | Changing a running workflow: only unstarted steps may be inserted/skipped, mandatory steps cannot be skipped, Process Engineer approval required | E, A | workflow, execution | post-MVP (FR-19/20) | DEFERRED |
| BR-14 | Gatekeeper: a step opens only when all predecessors are complete and their Gates pass | E | execution | S4 | DONE |
| BR-15 | A step configured "evidence required" cannot complete without ≥ 1 attachment | E (Gate), A | execution | S4 | DONE |
| BR-16 | Every state transition, workflow change and quantity entry writes an AuditLog (who, when, old, new) that cannot be edited or deleted | A (same transaction), D (append-only trigger) | audit | S0 foundation, every sprint | DONE |
| BR-17 | An order with a custom request passes CUSTOM_REVIEW: feasibility check (reject if infeasible); if feasible, clone the nearest template into a dedicated workflow, validate (BR-01), approve (Process Engineer), replace the snapshot; sample approval mandatory before cutting | A, E | workflow, order | post-MVP (FR-27) | DEFERRED (see R-04) |
| BR-18 | Clean wash runs by default. It may be skipped only at the customer's request to reduce cost; the Planner records reason and confirmation, the step becomes SKIPPED and an AuditLog is written; final QC then uses SKIP_CLEAN_WASH | A, E | order, execution | S3 | DONE |
| BR-19 | Every Style has two QC Profiles (FULL_PROCESS, SKIP_CLEAN_WASH) with their own shrinkage and color-fading thresholds, configured by the Process Engineer. An order with `skipCleanWash = true` may be confirmed only with the customer's signed acknowledgement attached; its final QC and handover use SKIP_CLEAN_WASH, otherwise FULL_PROCESS. Changing the skip decision after Confirm is a runtime change (BR-13) and needs a new acknowledgement | A, E, W | order, quality | data S1, Confirm S3, QC S5 | DONE (Confirm slice DONE) |

## 3. Default workflow template "Jean Standard"

This table is the specification of the seed data (`prisma/seed.ts`). Step types, conditions and QC flags are **proposals** (R-06, R-07, R-09); confirm with the owner if they conflict with workshop practice.

Responsible role names follow the `Role` enum in `DATABASE_DESIGN.md` §5. Conditions use the JSON AST (R-09); the table shows them in readable form.

| # | Code | Operation | stepType | Responsible role / station | Mandatory | Runs when (condition) | requiresQc | Gate to count as complete |
|---|---|---|---|---|---|---|---|---|
| 1 | ORDER_CONFIRM | Order intake and confirmation | APPROVAL | PRODUCTION_PLANNER | yes | always | no | Style, size run, quantity, due date complete; custom flag known; acknowledgement attached if `skipCleanWash` (BR-19) |
| C | CUSTOM_REVIEW | Custom branch: feasibility review, dedicated workflow | APPROVAL | PRODUCTION_PLANNER + PROCESS_ENGINEER | no | `isCustom` (post-MVP, R-04) | no | Feasible and dedicated workflow approved (BR-17) |
| 2 | FABRIC_COLOR_SELECT | Fabric and color selection | SELECTION | PRODUCTION_PLANNER | yes | always | no | Pair valid per matrix (BR-04) |
| 3 | BOM_ALLOCATE | BOM and material allocation | MATERIAL | PRODUCTION_PLANNER + WAREHOUSE_KEEPER | yes | always | no | Fully allocated or a Material Request exists |
| 4 | FABRIC_INSPECT | Incoming fabric inspection / shrinkage test | QC | QC_INSPECTOR | no | `fabricInspectRequired` | no | Shrinkage within threshold |
| 5 | PP_SAMPLE | Pre-production sample approval | APPROVAL | PRODUCTION_PLANNER + QC_INSPECTOR | no | `ppSampleRequired` (forced when `isCustom`) | no | Sample approved |
| 6 | CUTTING | Spreading and cutting | PRODUCTION | STATION_OPERATOR / CUTTING | yes | always | no | Cut qty per size within plan + tolerance (BR-07); bundle tags attached |
| 7 | EMBROIDERY | Embroidery / print | PRODUCTION | STATION_OPERATOR / EMBROIDERY | no | `embroideryRequired` | no | Quantity complete |
| 8 | SEWING | Sewing | PRODUCTION | STATION_OPERATOR / SEWING | yes | always | yes (in-line) | Sewn ≤ cut (BR-08); in-line inspection passed |
| 9 | DYEING | Dyeing | PRODUCTION | STATION_OPERATOR / DYEING | no | `dyeRequired` | no | Full quantity back; color matches standard; partial dye area correct (BR-09 if outsourced) |
| 10 | EFFECT_WASH | Effect (distressing) wash | PRODUCTION | STATION_OPERATOR / WASH | no | `washTypeId` is set | no | Full quantity back; effect matches sample |
| 11 | CLEAN_WASH | Clean wash | PRODUCTION | STATION_OPERATOR / WASH | no (skippable) | NOT `skipCleanWash` | no | When run: full quantity, shrinkage and fading within threshold; when skipped: SKIPPED + AuditLog (BR-18) |
| 12 | FINISHING | Finishing (trim, press, labels, buttons) | PRODUCTION | STATION_OPERATOR / FINISHING | yes | always | no | Full quantity; evidence if enabled (BR-15) |
| 13 | FINAL_QC | Final QC | QC | QC_INSPECTOR | yes | always | n/a (is the inspection) | AQL pass and thresholds of the order's QC Profile (BR-19) |
| 14 | PACK_HANDOVER | Packing and handover | PRODUCTION | PRODUCTION_PLANNER (packing) | yes | always | no | Full good quantity; handover record issued |

Transitions: sequential by `seq`, skipping steps whose condition is false. Rework transitions (`kind = REWORK`) from FINAL_QC back to SEWING, CLEAN_WASH (if run) or FINISHING; the target step carries `maxRework` (seed default 2).

Dyeing proposal (from the Proposal, §5): `dyeMode = TOTAL` → default `dyeSource = OUTSOURCED`; `dyeMode = PARTIAL` → default `INTERNAL`. The Planner may override per order.

## 4. State machines

### ProductionOrder

| State | Meaning | Allowed next |
|---|---|---|
| DRAFT | Planner is entering data | CONFIRMED (BR-03, BR-19) |
| CONFIRMED | Snapshot created, waiting for production | IN_PRODUCTION (when CUTTING starts), ON_HOLD, CANCELLED |
| IN_PRODUCTION | Steps running | COMPLETED (last step done), ON_HOLD, CANCELLED |
| ON_HOLD | Paused (materials, customer) | Back to the previous state, CANCELLED |
| COMPLETED | Packed and handed over | final |
| CANCELLED | Cancelled with reason (BR-12) | final |

MVP implements DRAFT → CONFIRMED → IN_PRODUCTION → COMPLETED. ON_HOLD and CANCELLED exist in the enum and state table but their use cases are post-MVP (FR-10).

### StepInstance

| State | Meaning | Allowed next |
|---|---|---|
| PENDING | Not its turn | READY (predecessors done and Gate passes, BR-14), SKIPPED (condition false or BR-18) |
| READY | On the station worklist | IN_PROGRESS (Start) |
| IN_PROGRESS | Quantities/evidence being entered | WAITING_QC (step needs QC) or DONE (BR-15 satisfied) |
| WAITING_QC | Waiting for the QC Inspector | DONE (pass), REWORK (fail/rework, BR-10) |
| REWORK | Being redone | IN_PROGRESS; beyond `maxRework`, Planner handles it |
| DONE | Complete | opens successors |
| SKIPPED | Skipped | counts as done for Gate evaluation |

Interpretation of QC-type steps (R-06): for `stepType = QC` the inspection decision *is* the completion. PASS ⇒ DONE. REWORK ⇒ the chosen target step becomes REWORK (its `reworkCount` + 1), the QC step returns to PENDING and re-runs after the target completes. REJECT ⇒ the order is flagged for the Planner.

## 5. Functional requirement traceability (FR-01 .. FR-29)

MVP = 14 FRs from the Proposal. Items marked ◐ are **minimal slices** pulled into the MVP because a mandatory BR depends on them (R-11).

| FR | Module | Function | Priority | In MVP | Sprint / task | Status |
|---|---|---|---|---|---|---|
| FR-01 | Auth & Master Data | Login, RBAC | MVP | ✔ | S1 T1.1–T1.2 (S0 foundation) | DONE |
| FR-02 | Auth & Master Data | Style, FabricType, ColorOption, Fabric–Color Matrix | MVP | ✔ | S1 T1.3–T1.4 | DONE |
| FR-03 | Auth & Master Data | Fabric stock by lot and trims | High | ◐ lots only | S3 T3.4 | DONE |
| FR-04 | Workflow Designer | Create/edit template (steps, transitions, conditions, gates) | MVP | ✔ | S2 T2.2, T2.4, T2.5 | DONE |
| FR-05 | Workflow Designer | Validate, publish, assign to Style | MVP | ✔ | S2 T2.3, T2.4 | DONE |
| FR-06 | Workflow Designer | Version history, deactivate | Medium | — | post-MVP | DEFERRED |
| FR-07 | Production Order | Create and Confirm order | MVP | ✔ | S3 T3.1, T3.5 | DONE |
| FR-08 | Production Order | Fabric–color selection filtered by matrix | MVP | ✔ | S3 T3.2 | DONE |
| FR-09 | Production Order | BOM, allocation, Material Request | MVP | ✔ | S3 T3.3–T3.4 | DONE |
| FR-10 | Production Order | Hold, Resume, Cancel | High | — | post-MVP | DEFERRED |
| FR-11 | Execution Engine | Instance from snapshot, open steps by Gate | MVP | ✔ | S2 T2.1, S3 T3.5, S4 T4.1 | DONE |
| FR-12 | Execution Engine | Worklist by station, Start/Complete | MVP | ✔ | S4 T4.2 | DONE |
| FR-13 | Execution Engine | Good/defect quantities per bundle, conservation | MVP | ✔ | S4 T4.3 | TODO |
| FR-14 | Execution Engine | Evidence attachments | High | stretch | S4 T4.4 | TODO |
| FR-15 | Execution Engine | Bundle generation and codes | High | ◐ at CUTTING | S4 T4.3 | TODO |
| FR-16 | QC & Rework | QC by checklist/AQL, Pass/Rework/Reject | MVP | ✔ | S5 T5.1 | TODO |
| FR-17 | QC & Rework | Rework routing, loop limit | MVP | ✔ | S5 T5.2 | TODO |
| FR-18 | QC & Rework | Defects by bundle | High | optional | S5 T5.3 | TODO |
| FR-19 | Runtime Change | Propose insert/skip step | Medium | — | post-MVP | DEFERRED |
| FR-20 | Runtime Change | Approve/reject change | Medium | — | post-MVP | DEFERRED |
| FR-21 | Tracking & Report | WIP dashboard | MVP | ✔ | S5 T5.5 | TODO |
| FR-22 | Tracking & Report | Defect rate and run-time reports | Medium | — | post-MVP | DEFERRED |
| FR-23 | Tracking & Report | Traceability by lot and bundle | High | — | post-MVP | DEFERRED |
| FR-24 | Notification & Audit | Notifications (READY, BLOCKED, QC fail) | High | — | post-MVP | DEFERRED |
| FR-25 | Notification & Audit | View/filter AuditLog | High | optional | S5 T5.6 | TODO |
| FR-26 | Notification & Audit | Packing, packing list, handover record | MVP | ✔ | S5 T5.4 | TODO |
| FR-27 | Production Order | Custom request, feasibility, dedicated workflow | High | — | post-MVP | DEFERRED |
| FR-28 | QC & Rework | QC Profile thresholds per Style, applied at final QC | High | ◐ | S1 T1.5, S5 T5.1 | PARTIAL (S1 slice DONE) |
| FR-29 | Production Order | Customer acknowledgement; block Confirm until attached | High | ◐ | S3 T3.5 | DONE |

## 6. Appendix assumptions (Q1 .. Q19): how the code assumes them

| Q | Topic | Assumption built into the code | If the answer changes |
|---|---|---|---|
| Q1–Q3 | BO meaning, CMT model, no commerce | Internal tool; no payments/quotes | None for MVP |
| Q4 | Fabric/color vs workflow | Matrix restricts colors; Conditions use order flags | Add condition operands (AST) |
| Q5 | Who selects fabric–color | Planner | Role permissions only |
| Q6 | Fabric supply | Lots tracked; source not modeled | Add `fabric_lots.source` |
| Q7 | Operations after cutting/sewing | 14 steps of §3 | Edit seed template (data, not code) |
| Q8 | Sewing sub-workflow | Single step | Composite pattern (optional) |
| Q9 | Tracking unit | Bundle | Schema change in `bundles` |
| Q10 | How dynamic | Designer + Conditions in MVP; runtime change post-MVP | BR-13 work |
| Q11 | Parallel + rework | Rework yes; **parallel post-MVP (R-10)** | Engine change: join/fork nodes |
| Q12 | AQL and checklist | Simplified: sample size + defect counts + measured shrinkage/fading vs profile | Checklist tables |
| Q13 | Evidence mandatory? | Configured per step (`requiresEvidence`) | Seed flags |
| Q14 | Delivery constraints | Web, Modular Monolith, option B stack | — |
| Q15 | Name | DenimFlow BO (settled) | — |
| Q16 | Clean wash | Default on, skippable (BR-18) (settled) | — |
| Q17 | Dyeing | TOTAL/PARTIAL × INTERNAL/OUTSOURCED, defaults per Proposal (settled) | — |
| Q18 | Custom subcontracting | Settled in intent; implementation post-MVP (R-04) | — |
| Q19 | QC thresholds and signatory | Per-Style values; **demo placeholders (R-14)**; signatory stored as free-text name | Replace seed values |

## 7. Reconciliation log (decisions and deviations)

Add a row whenever the implementation interprets or departs from the Proposal. Never delete rows; mark them superseded.

| ID | Date | Topic | Decision | Reason / trade-off | Status |
|---|---|---|---|---|---|
| R-01 | 2026-10-16 | `User` entity | Implemented as `profiles` (id = Supabase Auth user id); no `passwordHash` stored | Supabase Auth owns credentials; fewer secrets in our DB | Agreed |
| R-02 | 2026-10-16 | Material Request | Added table `material_requests` | FR-09 requires it; the Proposal data model has no entity | Proposed |
| R-03 | 2026-10-16 | Quantities per bundle | Added append-only `step_quantity_entries`; aggregates (`qtyIn/qtyGood/qtyDefect`) kept on `step_instances` | FR-13 says per bundle; aggregates are needed for fast Gate checks | Proposed |
| R-04 | 2026-10-16 | Custom branch (FR-27, BR-17) | Post-MVP. `isCustom` is stored; **Confirm rejects `isCustom = true`** with a clear message; `ppSampleRequired` is forced true when `isCustom` for forward compatibility | BR-17 is mandatory, so silently ignoring it would violate it; rejecting is honest | Proposed |
| R-05 | 2026-10-16 | ORDER_CONFIRM step | The Confirm action completes the ORDER_CONFIRM step in the same transaction; the next step becomes READY | The step cannot be worked from a worklist before the instance exists | Proposed |
| R-06 | 2026-10-16 | QC-type step semantics | See §4: the inspection decision completes a QC step; REWORK routes to a target step and the QC step returns to PENDING | The Proposal state tables do not say how a QC step itself behaves | Proposed |
| R-07 | 2026-10-16 | StepDefinition fields | Added `responsibleRole`, `requiresQc`, `seq`, `isStart`, `isEnd`; `stationType` nullable | Planner/QC steps have no station; worklists need a role | Proposed |
| R-08 | 2026-10-16 | Order flags | Added `embroideryRequired`, `fabricInspectRequired`, `ppSampleRequired`; `washType` modeled as catalog `wash_types` + `washTypeId`; `styles.hasEmbroidery` gives the default | Conditions need explicit data; wash type list is open | Proposed |
| R-09 | 2026-10-16 | Condition format | `conditionExpr` is a **JSON AST** (jsonb) validated by Zod, not a string expression | Safe (no `eval`), easy to validate and to build in a UI | Proposed |
| R-10 | 2026-10-16 | Parallel steps (Q11) | Deferred: MVP engine is sequential + conditional + rework | Largest engine complexity; not needed for the end-to-end demo | Proposed |
| R-11 | 2026-10-16 | Minimal FR-03/28/29 | Pulled into MVP as minimal slices (see ◐ in §5) | BR-06, BR-18, BR-19 are mandatory and FR-16 needs QC Profiles | Proposed |
| R-12 | 2026-10-16 | BR-12, BR-13 | Deferred with FR-10, FR-19, FR-20 | Not in the 14 MVP FRs | Proposed |
| R-13 | 2026-10-16 | BR-15 evidence | Gate implemented in S4; upload UI is stretch (FR-14). Seed `requiresEvidence = false` until the UI ships | Avoid a rule that blocks completion with no way to satisfy it | Proposed |
| R-14 | 2026-10-16 | QC thresholds (Q19) | Seed placeholder demo values, labeled as demo data in the UI | Real numbers depend on fabric and workshop practice | Open |
| R-15 | 2026-10-16 | File references | `fileUrl` fields (acknowledgement, evidence) are stored as private Storage **paths** (`file_path`), served via signed URLs | Public URLs on a public repo's bucket would leak documents | Agreed |
| R-16 | 2026-10-16 | Extra tables | Added `handover_records` (FR-26), `bom_norms` (BOM strategy data), `wash_types` | Needed to implement the listed FRs | Proposed |

"Proposed" rows await the owner's confirmation; change to "Agreed" or rewrite.
