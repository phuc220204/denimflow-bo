# Sprint 3 — Order, Confirm, snapshot, materials (FR-07, FR-08, FR-09, FR-11)

Goal: a Planner creates an order, picks a valid fabric–color, gets a BOM, allocates fabric; **Confirm** creates the Workflow Instance atomically.
Read: `BUSINESS_RECONCILIATION.md` BR-03, BR-04, BR-05, BR-06, BR-18, BR-19, §4; `DATABASE_DESIGN.md` §4.3, §7.1.

### T3.1 Order draft and size lines   [Tran Hoang Phuc / agent]
Branch: `feat/order-draft`
FR/BR: FR-07
Do: tables (`production_orders`, `order_size_lines`), endpoints and screens to create/edit a DRAFT order: Style, size run, due date, notes, customer reference, flags (`washTypeId`, `dyeRequired`, `dyeMode`, `dyeSource`, `embroideryRequired`, `fabricInspectRequired`, `ppSampleRequired`, `skipCleanWash`, `isCustom`).
Acceptance:
- [x] Order number is generated uniquely (format `PO-YYYY-NNNN`).
- [x] `ppSampleRequired` is forced true when `isCustom` (BR-17 data side).

### T3.2 Fabric and color selection   [Tran Hoang Phuc / agent]
Branch: `feat/order-fabric-color`
FR/BR: FR-08, BR-04, BR-05
Do: color dropdown filtered by `allowed-colors`; API rejects invalid pairs; lock fields once CUTTING has started.
Acceptance:
- [x] Invalid pair → `BR-04` violation.
- [x] After CUTTING starts, change attempt → `BR-05` violation.

### T3.3 BOM calculation (Strategy)   [agent]
Branch: `feat/order-bom`
FR/BR: FR-09
Do: BOM strategy "by size norm" in the engine (norm table in seed: meters of fabric per size, thread, buttons, rivets, zipper, labels, packaging; wastage %). Persist `bom_lines`.
Acceptance:
- [x] Deterministic test: known size run → known BOM.

### T3.4 Allocation and Material Request   [agent]
Branch: `feat/inventory-allocation`
FR/BR: FR-09, BR-06
Do: `fabric_lots`, `material_allocations`, `material_requests`; Warehouse Keeper allocates from lots (≤ available, row lock); shortage creates a Material Request; screens for the Keeper.
Acceptance:
- [x] Over-allocation rejected; two concurrent allocations never exceed stock.
- [x] CUTTING Gate blocks until the fabric BOM line is fully allocated (BR-06).

### T3.5 Confirm order (atomic snapshot)   [agent]
Branch: `feat/order-confirm`
FR/BR: FR-07, FR-11, BR-03, BR-16, BR-18, BR-19
Do: `POST /orders/:id/confirm` in **one transaction**: check data completeness and PUBLISHED template (BR-03); **reject `isCustom = true` with a clear message** because the custom branch is post-MVP (R-04); if `skipCleanWash`, require a `CustomerAcknowledgement` (file upload to private Storage bucket) and select the SKIP_CLEAN_WASH profile, else FULL_PROCESS (BR-19); create `workflow_instances` + all `step_instances` (PENDING, first READY, optional steps evaluated by Conditions → SKIPPED, CLEAN_WASH marked SKIPPED with AuditLog when skipping, BR-18); set order CONFIRMED; write AuditLog.
Acceptance:
- [x] Failure at any point leaves no partial rows (test by forcing an error mid-transaction).
- [x] Style without PUBLISHED template cannot be confirmed (BR-03).
- [x] An order with `isCustom = true` cannot be confirmed in the MVP (R-04).
- [x] `skipCleanWash` without acknowledgement is blocked (BR-19).
- [x] Editing the template later does not change the confirmed order's instance.

Sprint exit: demo "create → select → BOM → allocate → Confirm", show the instance and audit rows.
