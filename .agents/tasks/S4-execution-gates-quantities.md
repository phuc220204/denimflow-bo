# Sprint 4 — Execution: worklist, quantities, Gates (FR-12, FR-13)

Goal: station operators work orders through the steps; the engine opens steps only when Gates pass; quantities are conserved even under concurrency.
Read: `BUSINESS_RECONCILIATION.md` BR-07, BR-08, BR-09, BR-11, BR-14, BR-15, BR-16, §4; `DATABASE_DESIGN.md` §4.4, §7.2.

### T4.1 Gate chain (Chain of Responsibility)   [Tran Hoang Phuc / agent]
Branch: `feat/engine-gate-chain`
FR/BR: FR-11, BR-14, BR-06, BR-08, BR-15
Do: gate links in the order of `skills/add-engine-rule.md`; each link returns pass/block with a BR id. Engine function `evaluateStepReadiness(instanceSnapshot)` returns which PENDING steps become READY or SKIPPED.
Acceptance:
- [x] Tests per link and for the chain order; a SKIPPED predecessor counts as done.

### T4.2 Worklist, Start and Complete   [agent]
Branch: `feat/execution-worklist`
FR/BR: FR-12, BR-11, BR-16
Do: `GET /worklist` (steps in READY/IN_PROGRESS/REWORK for the user's station), `POST /steps/:id/start`, `POST /steps/:id/complete`; on complete: next state WAITING_QC or DONE by step config, then run readiness evaluation and open successors, all in one transaction with AuditLog. Operator UI optimized for few taps.
Acceptance:
- [x] An operator sees only their station's steps.
- [x] Completing a step opens the next one; completing the last step is handled in S5.

### T4.3 Quantity entry with conservation   [agent]
Branch: `feat/execution-quantities`
FR/BR: FR-13, BR-07, BR-08, BR-09
Do: `step_quantity_entries`; bundles created at CUTTING (codes `PO-…-B001`); entry endpoint locks the step row (`FOR UPDATE`), validates BR-08 (qtyIn ≤ previous good) and BR-07 (cut ≤ plan + tolerance), writes aggregates on `step_instances`. For outsourced DYEING/WASH, record sent/received and require a reason on mismatch (BR-09).
Acceptance:
- [x] **Concurrency test:** two parallel entries cannot jointly exceed the allowed quantity.
- [x] Differences between steps must be explained by recorded defects/wastage.

### T4.4 Evidence (FR-14, only if time)   [agent]
Branch: `feat/execution-evidence`
FR/BR: FR-14, BR-15
Do: upload through signed URL to the private bucket, client-side image compression, attach to `evidence`; Gate blocks completion of steps with `requiresEvidence` and no attachment. Seed `requiresEvidence = true` for FINISHING once this ships.
Acceptance:
- [ ] Step with `requiresEvidence` cannot complete without ≥ 1 attachment.

### T4.5 Separation of duties   [agent]
Branch: `feat/execution-separation-of-duties`
FR/BR: BR-11
Do: record who performed each step; block QC approval by the same person; block Process Engineer from completing production steps.
Acceptance:
- [x] Both violations return `BR-11` and are covered by tests (the self-approval check is wired into the QC decision in T5.1).

Sprint exit: demo an order from READY CUTTING to DONE FINISHING with a deliberate over-quantity rejection.
