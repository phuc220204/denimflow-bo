# .agents

Material for AI coding agents. Not loaded automatically by any tool: `AGENTS.md` tells the agent which file to open.

| Folder | Purpose | When to open |
|---|---|---|
| `rules/` | Standing conventions (architecture, code style, git, security, testing, docs) | Before writing code in the relevant area |
| `skills/` | Step-by-step procedures for recurring jobs (add a module, add a migration, add an engine rule, add a web feature) | When the task matches the skill |
| `tasks/` | Backlog per sprint with acceptance criteria | At the start of every work session |

All files are English only.

Adding a new rule or skill: keep it short (under ~120 lines), imperative, with a "why" line per rule. Link to `docs/` instead of copying business text.
