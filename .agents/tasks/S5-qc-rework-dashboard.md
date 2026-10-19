# Sprint 5 — QC, rework, QC Profile, dashboard, handover, polish (FR-16, FR-17, FR-21, FR-26)

Goal: the full demo scenario (`PRD.md` §6) runs end to end on the deployed system.
Read: `BUSINESS_RECONCILIATION.md` BR-10, BR-11, BR-18, BR-19, §4; `DATABASE_DESIGN.md` §4.4, §7.3.

### T5.1 QC inspection   [agent]
Branch: `feat/quality-inspection`
FR/BR: FR-16, BR-11, BR-19
Do: QC Inspector screen for steps in WAITING_QC: sample size, defect counts by type/bundle, measured shrinkage % and color-fading level; the engine picks thresholds via the order's QC Profile (Strategy) and proposes PASS/REWORK/REJECT; inspector confirms. Final QC stores `qcProfileId` in the inspection.
Acceptance:
- [x] Same measured values pass under SKIP_CLEAN_WASH and fail under FULL_PROCESS when thresholds differ (test with fixtures).
- [x] The inspector cannot approve QC for a step they performed (BR-11).

### T5.2 Rework routing   [agent]
Branch: `feat/quality-rework`
FR/BR: FR-17, BR-10
Do: REWORK/REJECT requires a target step and a reason; transition kind REWORK; `reworkCount` increments; above `maxRework`, mark for Planner exception handling (order stays visible, flagged).
Acceptance:
- [ ] Loop limit enforced; reason mandatory; audit rows written.

### T5.3 Defects   [agent]
Branch: `feat/quality-defects`
FR/BR: FR-18 (High, optional)
Do: defect records per inspection and bundle; simple list.

### T5.4 Packing and handover   [agent]
Branch: `feat/order-handover`
FR/BR: FR-26
Do: after FINAL_QC pass: packing list by size, handover record that states the QC Profile used; order → COMPLETED when the last step is DONE.
Acceptance:
- [ ] Handover cannot be created while FINAL_QC is not DONE.
- [ ] Handover record shows FULL_PROCESS or SKIP_CLEAN_WASH.

### T5.5 Dashboard   [agent]
Branch: `feat/dashboard-wip`
FR/BR: FR-21
Do: Manager/Planner dashboard: orders by status, WIP count per step, good/defect/rework totals, orders waiting on QC. Recharts. Read-only endpoints with efficient queries (indexes from `DATABASE_DESIGN.md` §6).
Acceptance:
- [ ] Numbers match the database for the demo data (test with a fixture).

### T5.6 AuditLog viewer (FR-25, optional)   [agent]
Branch: `feat/audit-log-viewer-rebuild`
Admin screen with filters by entity, actor, date. Append-only trigger already blocks edits.
Acceptance:
- [x] `GET /audit` (paged, max 100 rows per page) filters by entity type, entity id, actor and an inclusive date range; invalid input gives 422.
- [x] Only ADMIN and MANAGER may read it (401 without login, 403 for other roles); `GET /audit/filter-options` feeds the dropdowns.
- [x] The screen shows who, when, action and entity, and a dialog with the before/after values field by field.

### T5.7 E2E demo and polish   [agent + human]
Branch: `test/e2e-demo`
Do: Playwright test for the demo scenario against a seeded database; fix UX rough edges; reseed script for demo day; performance sanity on the free tiers; update `PROJECT_STATE.md`; re-check free-tier limits on provider pages.
Acceptance:
- [ ] Demo scenario passes in CI and on the deployed system.
- [ ] Owner has rehearsed the "wake up the API" step before the demo.
