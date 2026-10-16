# PRD — DenimFlow BO

Version 0.1 (draft) · 2026-10-16 · Language: EN (canonical) · Mirror: `docs/vi/PRD.md`
Business source: `docs/reference/` (Proposal V2.0, Appendix). Rule-by-rule mapping: `BUSINESS_RECONCILIATION.md`.

## 1. Summary

DenimFlow BO is the internal Back Office of a jeans subcontracting workshop. It manages the full lifecycle of a subcontracting order (fabric–color selection, BOM and allocation, cutting, sewing, dyeing, washing, finishing, QC, packing, handover) and runs on a **Dynamic Workflow**: the chain of operations is versioned data that a Process Engineer configures, not hard-coded logic.

## 2. Problem and goals

Problems of a jeans workshop: processes differ per product and change often; fabric–color mistakes ruin whole lots; managers cannot see work in progress; defects cannot be traced to a lot, operation and person.

Goals (what success looks like):

1. Change the process by configuration: add, remove, reorder steps and publish a new version without a code release.
2. Every order runs on exactly one versioned process (snapshot at Confirm); later template edits never disturb running orders.
3. A gate between steps: the next step opens only with full quantity, required evidence and QC pass.
4. Know where every lot is and how many pieces are good, defective, reworked.
5. Trace a defect to fabric lot, operation, person and time (audit trail).

Non-goals: payments, quotations, deposits, shipping integrations, customer-facing app, accounting/payroll, other garment types, CAD/pattern design, a scripting language for workflows.

## 3. Scope

| In scope | Out of scope |
|---|---|
| One product type (jeans), multiple Styles and sizes | Other garments |
| Order intake → handover (subcontracting BO stage) | Fabric manufacturing, pattern design |
| Template design, versioning, assignment by Style | Free-form scripting of workflows |
| WIP by bundle, good/defect/rework quantities, audit log, dashboard | Payroll, HR, accounting |
| Customer/brand name as a reference text on the order | Online payment, carrier integration |

## 4. Users and permissions (RBAC)

| Role | Core responsibility |
|---|---|
| ADMIN | Accounts, roles, catalogs (Style, Fabric, Color, Matrix), AuditLog |
| PROCESS_ENGINEER | Workflow templates, publish, QC Profile thresholds, approves runtime changes (post-MVP) |
| PRODUCTION_PLANNER | Creates/confirms orders, fabric–color, BOM, batches, exceptions |
| WAREHOUSE_KEEPER | Fabric lots, allocation, material issue, fabric inspection support |
| STATION_OPERATOR | Works the worklist of their own station: start/complete, enter quantities, evidence |
| QC_INSPECTOR | Inspections, Pass/Rework/Reject, defects |
| MANAGER | Read-only dashboards and reports |

Capability matrix (✔ = may do, 👁 = may view):

| Capability | ADM | PE | PLN | WK | OP | QC | MGR |
|---|---|---|---|---|---|---|---|
| Manage users, catalogs, Fabric–Color Matrix | ✔ | | | | | | |
| Design / publish workflow templates | | ✔ | | | | | |
| Configure QC Profile thresholds | | ✔ | | | | | |
| Create / edit / Confirm production order | | | ✔ | | | | |
| Select fabric–color, compute BOM | | | ✔ | | | | |
| Manage fabric lots, allocate materials | | | 👁 | ✔ | | | |
| Start / complete steps, enter quantities (own station) | | | | | ✔ | | |
| Perform QC inspection, decide Pass/Rework/Reject | | | | | | ✔ | |
| Record customer acknowledgement | | | ✔ | | | | |
| Packing and handover | | | ✔ | | | | |
| Dashboard / reports | 👁 | 👁 | 👁 | | | | ✔ |
| View AuditLog | ✔ | | | | | | 👁 |

Separation of duties (BR-11): the Process Engineer cannot confirm completion of a production step; whoever performed a step cannot approve its QC.

## 5. MVP functional requirements and acceptance criteria

MVP = 14 FRs. Full list and status: `BUSINESS_RECONCILIATION.md` §5. Minimal slices of FR-03, FR-28, FR-29 are included because BR-06/18/19 are mandatory.

| FR | Acceptance criteria (Given / When / Then) |
|---|---|
| **FR-01** Login, RBAC | Given a valid Supabase user with an active profile, when they log in, then the web shows only their role's menu. Given no/invalid token, API returns 401. Given a wrong role, API returns 403. Given a deactivated profile, API returns 403. Role is read from `profiles`, not token metadata. |
| **FR-02** Master data | Admin creates/edits Style, FabricType, ColorOption and toggles Fabric–Color Matrix cells. Codes are unique. A referenced row cannot be deleted. Every write creates an AuditLog row. |
| **FR-04** Edit template | Process Engineer builds a DRAFT template: steps (type, role/station, mandatory, requiresEvidence, requiresQc, condition, maxRework), transitions (normal/rework). A non-DRAFT version cannot be edited. |
| **FR-05** Validate, publish, assign | Publishing runs BR-01 and lists every violation with its step; invalid ⇒ nothing changes. Valid ⇒ version PUBLISHED, previous one RETIRED, only one PUBLISHED per template. The template can be assigned as a Style's default. |
| **FR-07** Create and Confirm order | Planner creates a DRAFT (Style, size lines, due date, flags). Confirm fails unless data is complete and the Style has a PUBLISHED template (BR-03). Confirm is **atomic**: order CONFIRMED, Workflow Instance and all Step Instances created, ORDER_CONFIRM DONE, first step READY, AuditLog written; any failure leaves no partial data. |
| **FR-08** Fabric–color | Color choices are limited to the matrix for the chosen fabric; the API rejects other pairs (BR-04). Fields lock once CUTTING starts (BR-05). |
| **FR-09** BOM, allocation, Material Request | BOM is computed from size lines and norms. Warehouse Keeper allocates from lots without exceeding available meters (also under concurrency). A shortage creates a Material Request. CUTTING stays blocked until the fabric line is fully allocated (BR-06). |
| **FR-11** Instance and gates | Steps open only when predecessors are DONE/SKIPPED and all Gates pass (BR-14). A false Condition makes the step SKIPPED. The template edit after Confirm does not change the instance. |
| **FR-12** Worklist | An operator sees READY/IN_PROGRESS/REWORK steps of their station only; Start and Complete are role- and station-checked and audited. |
| **FR-13** Quantities | Operator enters good/defect quantities per bundle (or per size at cutting). BR-08 and BR-07 are enforced; two parallel entries cannot exceed the allowed total. Outsourced dye/wash requires sent vs received reconciliation (BR-09). |
| **FR-16** QC | Inspector records sample size, defects, measured shrinkage % and fading level. The system compares with the order's QC Profile thresholds and proposes Pass/Rework/Reject; the inspector decides. The inspector cannot approve QC of a step they performed (BR-11). |
| **FR-17** Rework | Rework/Reject requires a target step and a reason; `reworkCount` increments; above `maxRework` the order is flagged for the Planner (BR-10). |
| **FR-21** Dashboard | Manager/Planner see orders by status, WIP count per step, good/defect/rework totals, orders waiting for QC. Numbers match the database. |
| **FR-26** Packing and handover | After FINAL_QC passes, packing list by size and a handover record stating the QC Profile used are created; the order becomes COMPLETED when the last step is DONE. |

Minimal slices:

- **FR-03 (lots only):** create/list fabric lots with available meters.
- **FR-28 (data + selection):** two QC Profiles per Style (`FULL_PROCESS`, `SKIP_CLEAN_WASH`) with thresholds; the order uses the profile chosen at Confirm.
- **FR-29:** when `skipCleanWash = true`, Confirm is blocked until a signed acknowledgement file is attached (private Storage); CLEAN_WASH becomes SKIPPED with an AuditLog row (BR-18).

Deferred (not in MVP): FR-06, FR-10 (Hold/Cancel), FR-14 (stretch), FR-18 (optional), FR-19/20 (runtime change), FR-22, FR-23, FR-24, FR-25 (optional), FR-27 (custom branch). See `BUSINESS_RECONCILIATION.md` §5 and §7 (R-04, R-10, R-12).

## 6. Demo scenario (acceptance of the whole MVP)

Seed: Style `JN-SLIM-01`; fabric `DN-12-RIGID` (12 oz, rigid); colors Indigo and Black allowed, Grey not allowed; wash type "Stone wash"; one fabric lot with enough meters; template "Jean Standard" PUBLISHED; QC Profiles with **demo placeholder** thresholds (FULL_PROCESS: shrinkage ≤ 3.0 %, fading ≤ 1; SKIP_CLEAN_WASH: shrinkage ≤ 5.0 %, fading ≤ 2).

1. **Process Engineer** shows the published template and tries to publish a broken copy (orphan step): violations are listed.
2. **Planner** creates an order of 100 pcs (sizes 28/30/32/34), wash = Stone wash, picks fabric `DN-12-RIGID`; Grey is not offered; picks Indigo; BOM appears.
3. **Warehouse Keeper** allocates from the lot; a second order shows a shortage and a Material Request.
4. **Planner** presses Confirm: instance with all steps appears; EMBROIDERY, DYEING, FABRIC_INSPECT, PP_SAMPLE are SKIPPED by their conditions.
5. **Operators** run CUTTING (an over-tolerance entry is rejected, BR-07), SEWING (a quantity above the cut quantity is rejected, BR-08), EFFECT_WASH, CLEAN_WASH, FINISHING.
6. **QC Inspector** inspects FINAL_QC: first result REWORK back to FINISHING (reason recorded); after rework, PASS.
7. **Planner** creates packing and handover (shows `FULL_PROCESS`); order COMPLETED.
8. **Variation:** a second order with `skipCleanWash = true`: Confirm is blocked until the acknowledgement is uploaded; CLEAN_WASH is SKIPPED; the same measured values (shrinkage 4.0 %, fading 2) PASS under `SKIP_CLEAN_WASH` but fail under `FULL_PROCESS`.
9. **Manager** opens the dashboard; **Admin** shows the AuditLog trail of the order.

## 7. Non-functional requirements

| Area | Requirement |
|---|---|
| Cost | Hosting cost = 0 (free tiers only) |
| Performance | Typical API calls under ~1 s once awake (assumption; measure in S0). Cold start of the free API host (~1 min) is accepted and mitigated by a keep-alive ping |
| Scale | Small workshop: tens of users, hundreds of orders. No horizontal scaling needed |
| Integrity | Multi-row changes are transactional; quantity conservation under concurrency; AuditLog append-only |
| Security | JWT on every request; RBAC; RLS deny-all; private file bucket with signed URLs; no secrets in the repo (public repo) |
| Usability | Operator screens need few taps and work on a tablet-size screen; latest Chrome/Edge supported |
| Maintainability | Modular Monolith; engine is pure and unit-tested; docs bilingual and kept in sync |
| i18n | The UI is in Vietnamese (decision D8); strings still live in a dictionary. Glossary: `docs/design/DESIGN.md` |
| Backup | Free-tier backup guarantees are unclear: keep migrations and seed in git and provide an export script before the final demo |

## 8. Constraints and assumptions

- Free tiers (re-verify on provider pages before relying on numbers): Render free web service sleeps after 15 min idle (~1 min cold start); Supabase free projects pause after about a week of inactivity and have small DB/storage quotas; Cloudflare static hosting limits are generous for this app.
- Team works through PRs on a public repository; no real customer data may be committed.
- Assumptions Q1–Q19 of the Appendix are tracked in `BUSINESS_RECONCILIATION.md` §6.

## 9. Release plan

| Sprint | Outcome |
|---|---|
| S0 | Walking skeleton deployed (web → API → DB → Auth), CI |
| S1 | Login, RBAC, master data, Matrix, QC Profile data |
| S2 | Engine core, template designer, validation, publish |
| S3 | Order create/Confirm/snapshot, BOM, allocation |
| S4 | Worklist, quantities, Gates, separation of duties |
| S5 | QC, rework, handover, dashboard, E2E demo |

Details: `.agents/tasks/`.

## 10. Open decisions

Tracked in `PROJECT_STATE.md` (O1 deadline, O2 Cloudflare Pages vs Workers, O4 parallel steps, O5 custom/Hold/Cancel, O6 evidence, O7 QC numbers).

## 11. Glossary

| Term | Meaning |
|---|---|
| **BO (Back Office)** | The internal system used by workshop staff, not by retail buyers |
| **Dynamic Workflow** | The chain of operations stored as versioned data instead of code |
| **Workflow Template / Version** | A reference process for a group of Styles / an immutable version of it |
| **Workflow Instance / Step Instance** | The actual run of a template for one order / the run of one step |
| **Snapshot** | At Confirm, the order pins the PUBLISHED version; later edits never affect it |
| **Condition** | Rule deciding whether a step runs (e.g. only if the order has a wash) |
| **Gate (gatekeeper)** | Conditions that must hold before the next step opens (full quantity, evidence, QC pass) |
| **BOM (Bill of Materials)** | Material requirements for an order: fabric, thread, buttons, rivets, zipper, labels, packaging |
| **Material Request** | A request to buy missing material |
| **Bundle** | A tagged group of cut pieces moving together through the line |
| **WIP** | Work in progress |
| **CMT (Cut, Make, Trim)** | Subcontracting model: the workshop cuts and sews customer-ordered goods |
| **AQL** | Acceptance Quality Limit: sampling-based quality threshold |
| **Fabric_Inspect (FABRIC_INSPECT)** | Incoming fabric inspection and shrinkage test before cutting |
| **PP Sample (PP_SAMPLE)** | Pre-production sample approved before cutting |
| **Effect wash** | Wash that creates a look (stone, distressed) |
| **Clean wash** | Wash that stabilizes shrinkage and color fading so the customer sees no change at first laundering; default on, skippable at the customer's request |
| **QC Profile** | Per-Style set of final-QC thresholds: `FULL_PROCESS` or `SKIP_CLEAN_WASH` |
| **Customer acknowledgement** | Signed customer confirmation required when clean wash is skipped (BR-19) |
| **Rework loop** | QC sends the order back to a step; limited by `maxRework` |
| **RBAC** | Role-based access control |
| **AuditLog** | Append-only record of who changed what and when |
