@AGENTS.md

# Claude Code notes

- `AGENTS.md` (imported above) holds all project rules. Do not duplicate rules here.
- Skills and rules live in `.agents/`, not in `.claude/`. They are not loaded automatically: open the relevant file in `.agents/rules/` or `.agents/skills/` when the task needs it (the "Read before you code" list in `AGENTS.md` tells you which).
- Use plan mode for any task that touches more than ~3 files or changes the database schema, and show the plan to the owner first.
- Reply to the owner in Vietnamese (technical terms stay in English) and explain the reasoning, as described in `AGENTS.md` §7.
