# 03 — Git and PR workflow

The repository is **public** and `main` is protected by a ruleset: pull request required, 1 approval, approval of the latest push, conversations resolved, squash merge only, linear history, no force push, no deletion. Direct pushes are rejected (`GH013`).

## Flow (GitHub Flow)

1. `git switch main && git pull`
2. `git switch -c <type>/<module>-<topic>` — e.g. `feat/order-confirm-snapshot`, `fix/engine-gate-order`, `docs/database-design`, `chore/ci-keepalive`.
3. Small commits using Conventional Commits.
4. `git push -u origin <branch>`; open a PR with the template; link the task id.
5. Wait for CI and 1 approval from someone other than the last pusher. Address comments; push more commits.
6. **Squash and merge**. The branch is deleted automatically.

## Rules for agents

- Never run `git push origin main`, never force-push, never rewrite pushed history.
- Do not merge a PR unless the owner explicitly asks.
- Open or update a PR only when the owner asks you to push; otherwise leave commits local and tell the owner.
- Keep one task per branch and one concern per PR; aim for a diff under ~400 lines (excluding lockfile and generated migrations).
- Rebase on or merge `main` before opening the PR if it has diverged. Resolve `pnpm-lock.yaml` conflicts by taking `main`'s file and re-running `pnpm install`.

## Commit messages

`<type>(<scope>): <summary in imperative mood, lower case, no period>`

- Types: `feat`, `fix`, `docs`, `refactor`, `test`, `chore`, `ci`, `perf`, `build`.
- Scope = module or package: `order`, `workflow`, `engine`, `web`, `shared`, `db`, `ci`, `docs`.
- Body explains *why* when it is not obvious. Reference rules/tasks: `Refs: BR-03, T3.2`.
- The PR title becomes the squash commit message: write it as a Conventional Commit.

## What never goes into a commit

`.env*` (except `.env.example`), `node_modules`, build output, personal tokens, real customer data, large binaries. Prisma migrations **are** committed. Generated Prisma client is not.

## Branch protection note

Required status checks are added to the ruleset after the first green `ci.yml` run (owner task in Sprint 0). Until then, discipline: do not merge a PR with failing local checks.
