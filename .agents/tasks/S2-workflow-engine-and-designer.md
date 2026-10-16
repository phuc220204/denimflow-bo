# Sprint 2 — Workflow engine core and designer (FR-04, FR-05)

Goal: a Process Engineer can build, validate and publish the "Jean Standard" template; the engine can decide legal transitions in pure TypeScript.
Read: `BUSINESS_RECONCILIATION.md` §2 (BR-01, BR-02, BR-14), §3 (14 steps), §4 (state machines); `DATABASE_DESIGN.md` §4.2; `rules/01-architecture-boundaries.md`; `skills/add-engine-rule.md`.

### T2.1 Engine domain model and State machines   [agent]
Branch: `feat/engine-state-machines`
FR/BR: FR-11 (foundation)
Do: types for template/version/step/transition (plain data); `ProductionOrder` and `StepInstance` State machines with the transition tables from §4; illegal transitions return an error value, not an exception.
Acceptance:
- [ ] Table-driven test covers every allowed transition and a sample of forbidden ones.

### T2.2 Condition evaluator (Strategy) and JSON AST   [agent]
Branch: `feat/engine-conditions`
FR/BR: FR-04
Do: AST operators `eq`, `neq`, `and`, `or`, `not`, with operands from `order.*` fields (`washTypeId`, `dyeRequired`, `embroideryRequired`, `isCustom`, `skipCleanWash`, ...). Zod schema for the AST in `packages/shared`. No `eval`.
Acceptance:
- [ ] Unknown field/operator is rejected by the schema.
- [ ] Tests for each operator and nesting.

### T2.3 Template validation BR-01   [agent]
Branch: `feat/engine-template-validation`
FR/BR: FR-05, BR-01
Do: validate exactly one start step, ≥1 end step, every step reaches an end, no orphan steps, every REWORK transition has a `maxRework` limit, no unbounded cycles. Return a list of violations with step ids.
Acceptance:
- [ ] One test per violation type plus a valid "Jean Standard" fixture.

### T2.4 Workflow persistence and publish   [agent]
Branch: `feat/workflow-templates-api`
FR/BR: FR-04, FR-05, BR-01, BR-02
Do: tables + migration (RLS, partial unique index: one PUBLISHED version per template, trigger: no edits to step rows of a non-DRAFT version); endpoints for template/version/step/transition CRUD in DRAFT, `POST /workflow/versions/:id/publish` (runs BR-01 in the engine, then sets PUBLISHED and retires the previous one), assign template to Style.
Acceptance:
- [ ] Editing a PUBLISHED version fails at the API **and** at the DB trigger.
- [ ] Publishing an invalid template returns the violation list and changes nothing.
- [ ] Seed script creates "Jean Standard" (14 steps, see §3) as PUBLISHED and assigns it to the demo Style.

### T2.5 Designer UI (MVP)   [agent]
Branch: `feat/web-workflow-designer`
FR/BR: FR-04, FR-05
Do: form-based step list (add/remove/reorder, step type, station, mandatory, requiresEvidence, condition builder, maxRework), transitions editor, **read-only** React Flow graph preview, Validate and Publish buttons showing violations. Drag-and-drop editing is out of MVP.
Acceptance:
- [ ] Process Engineer builds a small template from scratch, sees the graph, fixes a reported violation, publishes.
- [ ] Other roles cannot reach the designer.

Sprint exit: update docs/state; demo: publish "Jean Standard" and show a rejected invalid template.
