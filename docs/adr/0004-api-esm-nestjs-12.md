# 0004 — The API is an ES module on NestJS 12, tested with Vitest

Status: accepted
Date: 2026-10-17

## Context

The project docs were written assuming "NestJS defaults to CommonJS" and "Jest for API tests" (rule 05, task T0.3). When T0.4 started, the current NestJS release was 12.1.3, which ships as **ESM only** (`"type": "module"`). Its CLI offers two templates: `ts` (no `"type": "module"`, Jest run with Node's `--experimental-vm-modules` flag) and `ts-esm` (`"type": "module"`, Vitest).

## Decision

`apps/api` uses the official NestJS 12 `ts-esm` template: `"type": "module"`, `module`/`moduleResolution` = `nodenext` (relative imports end in `.js`), Vitest + Supertest for tests. Prisma 7 generates an ESM client (`moduleFormat = "esm"`). Owner decision, 2026-10-17.

## Consequences

- Pros: matches how NestJS 12 is published; no experimental Node flag; one test runner (Vitest) for engine, shared, web and API.
- Cons / trade-offs: relative imports need the `.js` extension; some older NestJS examples online use CommonJS and Jest and need adapting.
- `@denimflow/shared` and `@denimflow/engine` keep their dual ESM + CJS build (cheap, keeps CJS tools working), but the CJS output is no longer required by the API.
- Workspace packages expose a `@denimflow/source` export condition (their `src/index.ts`). The API's `tsconfig.json` and Vitest use the sources, so a fresh clone can type-check and test without building; `tsconfig.build.json` drops the condition so the runtime uses `dist/`.
- Follow-ups: rule 05 and HELP.md updated in the same PR; the sentence "NestJS default is CommonJS" in task T0.3 is corrected in a docs follow-up (it overlaps an open docs PR).
