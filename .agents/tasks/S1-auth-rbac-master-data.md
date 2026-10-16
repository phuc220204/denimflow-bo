# Sprint 1 — Auth, RBAC, master data (FR-01, FR-02)

Goal: all 7 roles can log in and see only their menu; Admin manages the catalogs the rest of the system depends on.
Read: `PRD.md` §4 (RBAC), `DATABASE_DESIGN.md` §4.1 (catalog tables).

### T1.1 Profiles and role management   [agent]
Branch: `feat/auth-profiles`
FR/BR: FR-01
Do:
- Admin endpoints to create/deactivate users (create the Supabase Auth user with the service role from the API, then insert `profiles`). List users.
- Seed the 7 demo users (fake emails, passwords from env/seed script output, not committed).
Acceptance:
- [ ] Deactivated profile gets 403 on every endpoint.
- [ ] A non-Admin gets 403 on user management.
- [ ] Role is read from `profiles`, not from JWT metadata (test with a forged metadata claim).

### T1.2 Web shell with role-based navigation   [agent]
Branch: `feat/web-role-navigation`
FR/BR: FR-01
Do: sidebar per role (Admin, Process Engineer, Planner, Warehouse Keeper, Station Operator, QC Inspector, Manager), route guards, 403 page.
Acceptance:
- [ ] Each role sees only its menu; direct URL to a forbidden route shows 403.

### T1.3 Catalog: Style, FabricType, ColorOption, WashType, Station   [agent]
Branch: `feat/catalog-master-data`
FR/BR: FR-02
Do: tables + migration (RLS), CRUD endpoints (Admin only; read for others), list/edit screens, seed reference data.
Acceptance:
- [ ] Codes unique; deleting a referenced row is rejected with a clear message.
- [ ] Every write produces an `AuditLog` row.

### T1.4 Fabric–Color Matrix   [agent]
Branch: `feat/catalog-fabric-color-matrix`
FR/BR: FR-02, BR-04 (data side)
Do: `fabric_color_rules` (unique pair), matrix editor (grid of fabric × color toggles), endpoint `GET /catalog/fabrics/:id/allowed-colors`.
Acceptance:
- [ ] Toggling a cell persists; allowed-colors returns only `isAllowed = true`.

### T1.5 QC Profile configuration (data only)   [agent]
Branch: `feat/catalog-qc-profiles`
FR/BR: FR-28 (minimal), BR-19 (data side)
Do: every Style gets two QC Profiles (FULL_PROCESS, SKIP_CLEAN_WASH) with `maxShrinkagePercent`, `maxColorFadingLevel`; Process Engineer edits; seed **placeholder demo values** and label them as demo data in the UI.
Acceptance:
- [ ] A Style cannot be saved as "ready" without both profiles (decide with owner whether to block or warn).

Sprint exit: update `BUSINESS_RECONCILIATION.md` §2/§5 statuses and `PROJECT_STATE.md`.
