# Skill: implement a business rule in the workflow engine

Use for BR-01 (template validation), BR-04..BR-08, BR-10, BR-13..BR-15, BR-19 and any new rule that decides "may this happen?".

## Steps

1. Read the rule text in `BUSINESS_RECONCILIATION.md` §2. Write down in the PR: inputs, decision, error code.
2. **Test first** in `packages/engine/src/**/*.test.ts`, title starts with the id: `BR-08: rejects qtyIn above previous step's good quantity`. Cover the allowed case, the violation, and the boundary (equal, off-by-one, zero).
3. Choose the pattern (see `rules/01-architecture-boundaries.md`):
   - "May step X open?" → add a link to the **Gate chain** (Chain of Responsibility). A link returns `pass` or `block(reason, brId)`; it must not know the other links.
   - "Is this transition legal?" → the **State** tables for order/step.
   - "Which variant applies?" (BOM calculation, QC thresholds by profile, condition evaluation) → **Strategy**.
   - "New kind of step" → handler registered in the **Factory**.
4. Implement with plain data in/out. No I/O, no direct clock or randomness.
5. Emit domain events (**Observer**) instead of calling notifications/audit directly.
6. Wire it in `apps/api` through the service of the owning module (see `add-api-module.md`); the service persists the engine's decision and the audit row in one transaction.
7. Update `BUSINESS_RECONCILIATION.md` §2: status, enforcement layer, test name. Add a §7 log line if the interpretation was not obvious.

## Gate chain order (initial proposal)

1. Predecessors done (BR-14)
2. Materials allocated (BR-06, only before CUTTING)
3. Quantity conservation (BR-08)
4. Evidence present (BR-15)
5. QC passed (BR-10/BR-19)

Order matters for the error the user sees (first failure wins). Keep it documented in code next to the chain definition.
