---
phase: 12-local-development-harness
plan: 02
subsystem: infra
tags: [deno, local-dev, gateway, blossom, vite, env-vars]

# Dependency graph
requires:
  - phase: 12-01
    provides: LocalStorageClient class used by blossom-dev stub

provides:
  - Gateway local dev entrypoint (apps/gateway/src/dev.ts) with env vars pointing at local services
  - Dev-only blossom stub (apps/gateway/src/stubs/blossom-dev.ts) using LocalStorageClient instead of StorageClient
  - SPA .env.development auto-configuring Vite dev server to connect to local gateway
affects: [12-03-orchestrator]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Dev entrypoint without router.ts: recreate routing logic directly in dev.ts to swap one static import (blossom.ts -> blossom-dev.ts) without modifying production files"
    - "SPA env file strategy: .env.development for shared local dev config (committed), .env.production.local for secrets (gitignored via *.local)"

key-files:
  created:
    - apps/gateway/src/dev.ts
    - apps/gateway/src/stubs/blossom-dev.ts
    - apps/spa/.env.development
  modified: []

key-decisions:
  - "Gateway dev.ts duplicates routing logic from router.ts instead of importing it, because router.ts statically imports blossom.ts which throws on missing BUNNY_STORAGE_* env vars"
  - ".env.local renamed to .env.production.local: root .gitignore has *.local pattern which gitignores both, but .env.development (without .local suffix) is committed and only applies in Vite dev mode"
  - "Redirect in dev.ts uses http:// not https:// for invalid subdomains since BASE_DOMAIN is localhost"

patterns-established:
  - "Static import swap via duplication: when a module's static import must be replaced for dev, duplicate the ~50-line wrapper instead of trying to override imports at runtime"

requirements-completed: [DEV-01, DEV-04, DEV-06]

# Metrics
duration: 5min
completed: 2026-03-22
---

# Phase 12 Plan 02: Gateway Dev Entrypoint + SPA Env Config Summary

**Gateway local dev entrypoint with dev-only LocalStorageClient blossom stub and Vite .env.development auto-configuring SPA to connect to local gateway on localhost:8080**

## Performance

- **Duration:** ~5 min
- **Started:** 2026-03-22T14:35:00Z
- **Completed:** 2026-03-22T14:40:00Z
- **Tasks:** 2
- **Files modified:** 3 created + 1 renamed (gitignored)

## Accomplishments
- Gateway dev entrypoint (dev.ts) sets RELAY_URL/BLOSSOM_URL/SPA_ASSETS_URL/BASE_DOMAIN env vars, injects Bunny.v1.serve polyfill, patches upgradeWebSocket, and recreates the router.ts routing logic with blossom-dev substitution
- Dev-only blossom stub uses LocalStorageClient (from Plan 01) — no BUNNY_STORAGE_* credentials needed for local dev
- SPA .env.development auto-configures VITE_NSITE_RELAY=ws://localhost:8080 and VITE_NSITE_BLOSSOM=http://localhost:8080 for all devs without manual setup
- Zero production file modifications — main.ts, router.ts, stubs/blossom.ts all unchanged

## Task Commits

Each task was committed atomically:

1. **Task 1: Gateway dev entrypoint and dev-only blossom stub** - `0cee19b` (feat)
2. **Task 2: Configure SPA environment for local development** - `0497265` (feat)

## Files Created/Modified
- `apps/gateway/src/dev.ts` - Dev entrypoint: env var injection, Bunny polyfill, upgradeWebSocket patch, routing logic with blossom-dev stub
- `apps/gateway/src/stubs/blossom-dev.ts` - Dev-only blossom stub using LocalStorageClient instead of StorageClient
- `apps/spa/.env.development` - Vite dev-mode env vars pointing at local gateway (ws://localhost:8080, http://localhost:8080)
- `apps/spa/.env.local` - Renamed to `.env.production.local` (gitignored, contains production wss://next.nsite.run credentials)

## Decisions Made
- **dev.ts duplicates router.ts routing logic:** Cannot import router.ts because it statically imports `stubs/blossom.ts` which throws during init when BUNNY_STORAGE_* env vars are missing. Duplicating the ~50-line routing function (and substituting the blossom import) is the cleanest solution with zero production file changes.
- **.env.local renamed to .env.production.local:** The root `.gitignore` has a `*.local` pattern that matches both filenames (so both are gitignored/not committed). Vite loads `.env.development` only in dev mode (MODE=development), so `.env.local` — which previously had higher priority than `.env.development` — no longer overrides local dev settings.
- **http:// redirect for localhost:** The invalid-subdomain redirect in dev.ts uses `http://` instead of the production `https://` since BASE_DOMAIN is set to `localhost` in dev mode.

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
- `.env.local` was gitignored (matched `*.local` in root `.gitignore`) so `git mv` failed. Used regular `mv` instead — outcome is identical since neither file is tracked by git.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Gateway dev entrypoint ready for use by Plan 03 orchestrator (scripts/dev.ts)
- SPA env configuration complete — `npm run dev` auto-targets local gateway without manual setup
- No blockers for Plan 03 (orchestrator + root deno task dev)

---
*Phase: 12-local-development-harness*
*Completed: 2026-03-22*

## Self-Check: PASSED

- apps/gateway/src/dev.ts: FOUND
- apps/gateway/src/stubs/blossom-dev.ts: FOUND
- apps/spa/.env.development: FOUND
- .planning/phases/12-local-development-harness/12-02-SUMMARY.md: FOUND
- commit 0cee19b (Task 1): FOUND
- commit 0497265 (Task 2): FOUND
