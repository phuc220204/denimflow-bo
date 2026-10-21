# 0001 — The web app is deployed as a Cloudflare Worker with static assets

Status: accepted
Date: 2026-10-19

## Context

Open decision O2 (PROJECT_STATE): host the React/Vite web app on **Cloudflare Pages** or on **Cloudflare Workers with static assets**. Both are free for this project's traffic. Cloudflare's documentation recommends Workers for new projects while Pages remains supported. The web is a single-page app: every unknown path (e.g. `/orders/123`) must serve `index.html`.

## Decision

Deploy `apps/web` as a Worker with static assets, configured by `apps/web/wrangler.jsonc` (`assets.directory = ./dist`, `assets.not_found_handling = "single-page-application"`), built and deployed by **Workers Builds** from the GitHub repository (production branch `main`, preview builds for pull requests). Settings are documented in `DEVELOPMENT_SETUP.md` §7.

## Consequences

- Pros: follows Cloudflare's current recommendation; the SPA fallback and the asset directory are versioned in the repo (`wrangler.jsonc`) instead of only living in a dashboard; the same config can later add a Worker script (e.g. headers) without changing host.
- Cons / trade-offs: Workers Builds defaults to pnpm 10, so the build must set `PNPM_VERSION` to the version pinned in `package.json`; `VITE_*` values are build variables, so changing them needs a rebuild.
- Follow-ups: the deployed URL goes into the API `CORS_ORIGINS` and the Supabase Auth Site URL / redirect URLs (T0.7).
