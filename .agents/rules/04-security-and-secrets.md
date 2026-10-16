# 04 — Security and secrets

The repository is **public**. Assume every committed byte is readable by anyone forever, including history.

## Secrets

- Real values live only in: local `.env` files (git-ignored) and the hosting dashboards (Render, Cloudflare, Supabase, GitHub Actions secrets).
- Commit `.env.example` files with **placeholders only** (`SUPABASE_SERVICE_ROLE_KEY=replace-me`).
- Two example files: `apps/api/.env.example` and `apps/web/.env.example`. Server-only variables must never appear in the web file.
- `VITE_*` variables are bundled into public JavaScript. Put nothing secret in them. The Supabase **anon/publishable** key is designed to be public; the **service role/secret** key is not.
- If a secret is committed by mistake: revoke/rotate it immediately, then clean up. Deleting the file in a later commit does not remove it from history.

## Supabase

- Every table: `ALTER TABLE ... ENABLE ROW LEVEL SECURITY;` with **no policies** (deny-all to the auto-generated REST API). Prisma connects as a privileged role and bypasses RLS, so real authorization happens in the NestJS API.
- Service role key: API only. The web talks to Supabase **only for Auth** (login/session) and, if a task says so, signed-URL uploads.
- Storage bucket for evidence and acknowledgements is **private**. Hand out short-lived signed URLs. Validate MIME type and size (images/PDF, small limit) in the API before issuing an upload URL.

## Authentication and authorization

- API verifies the Supabase JWT on every request (signature, expiry, issuer/audience). Follow the Supabase JWT docs for the project's signing method.
- The user's **role comes from `profiles`**, looked up by the JWT subject. Never read the role from user-editable metadata. Deactivated profiles are rejected.
- Enforce separation of duties in code (BR-11): the user who performed a step cannot approve its QC; the Process Engineer cannot confirm completion of a production step.
- CORS: an allowlist from `CORS_ORIGINS`, never `*` in production.

## Input and output

- Validate every request body, query and param with Zod. Reject unknown fields.
- Prisma parameterizes queries. For `$queryRaw`, use the tagged-template form only; never concatenate user input into SQL.
- Do not return stack traces or internal ids of other users' data in errors.

## Data and logs

- No real customer or personal data in seeds, fixtures, screenshots or docs. Use obviously fake data (`Demo Brand Co.`).
- AuditLog is append-only (DB trigger blocks UPDATE/DELETE). Do not add a code path that edits it.

## Dependencies

- Pin versions (lockfile committed). Add a dependency only with justification in the PR: purpose, license, last release, alternatives considered.
- Dependabot alerts and secret scanning with push protection are enabled on the GitHub repo; do not dismiss alerts without a note.
