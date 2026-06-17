---
phase: 12-local-development-harness
plan: 03
subsystem: infra
tags: [deno, local-dev, orchestrator, subprocess, signal-handling, gitignore]

# Dependency graph
requires:
  - phase: 12-01
    provides: relay/blossom dev entrypoints (apps/relay/src/dev.ts, apps/blossom/src/dev.ts)
  - phase: 12-02
    provides: gateway dev entrypoint (apps/gateway/src/dev.ts) and SPA .env.development

provides:
  - Root dev orchestrator (scripts/dev.ts) spawning all four services as subprocesses with colored output
  - deno task dev entry in root deno.json
  - .gitignore entries for dev-relay.db and .dev-blossom-storage/

affects: []

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Subprocess orchestration: Deno.Command with stdout/stderr piped, pipeOutput() via TextDecoderStream for line-by-line colored prefix output"
    - "Clean shutdown: SIGINT/SIGTERM listeners → SIGTERM children → Promise.allSettled → 5s force-kill timeout → Deno.exit(0)"

key-files:
  created:
    - scripts/dev.ts
  modified:
    - deno.json
    - .gitignore

key-decisions:
  - "scripts/dev.ts runs service dev entrypoints directly via deno run --allow-all (not deno task) to avoid deno task subprocess overhead and preserve color output"
  - "SPA spawned with npm run dev in apps/spa cwd — Vite auto-configured by .env.development from Plan 02"
  - "shuttingDown flag prevents re-entrant shutdown and suppresses exit-code messages during clean shutdown"

patterns-established:
  - "Dev orchestrator pattern: spawn subprocesses → stream colored output → register signal handlers → keep-alive Promise"

requirements-completed: [DEV-05, DEV-07]

# Metrics
duration: 2min
completed: 2026-03-22
---

# Phase 12 Plan 03: Root Dev Orchestrator Summary

**Single `deno task dev` command that spawns relay (cyan), blossom (magenta), gateway (yellow), and SPA (green) with colored output and clean SIGINT/SIGTERM shutdown**

## Performance

- **Duration:** ~2 min
- **Started:** 2026-03-22T14:39:05Z
- **Completed:** 2026-03-22T14:41:00Z
- **Tasks:** 1 auto + 1 checkpoint (human-verify)
- **Files modified:** 3 (1 created, 2 modified)

## Accomplishments
- scripts/dev.ts orchestrates all four local dev services as subprocesses with colored output prefixes
- Each service's stdout and stderr piped through TextDecoderStream with line-by-line prefix: `[relay]`, `[blossom]`, `[gateway]`, `[spa]`
- SIGINT/SIGTERM handlers with 5-second force-kill timeout ensure clean Ctrl+C shutdown
- Startup banner shows all four service URLs at a glance
- deno.json `dev` task added — single command to run the entire stack
- .gitignore updated with dev-relay.db, dev-relay.db-*, .dev-blossom-storage/

## Task Commits

Each task was committed atomically:

1. **Task 1: Root dev orchestrator, deno task, gitignore** - `c137b20` (feat)
2. **Task 2: Human smoke test checkpoint** - awaiting user verification

## Files Created/Modified
- `scripts/dev.ts` - Root dev orchestrator: spawns 4 services, colored output, signal handlers, startup banner
- `deno.json` - Added `"dev": "deno run --allow-all scripts/dev.ts"` task
- `.gitignore` - Added dev-relay.db, dev-relay.db-*, .dev-blossom-storage/ entries

## Decisions Made
- **Direct `deno run` vs `deno task`:** Used `deno run --allow-all apps/relay/src/dev.ts` (not `deno task relay:dev`) because the services don't have named dev tasks — they only have dev entrypoints run directly.
- **SPA cwd:** `npm run dev` spawned with `cwd: "apps/spa"` so Vite resolves config and node_modules relative to the SPA directory.
- **shuttingDown flag:** Guards against re-entrant shutdown (e.g., multiple SIGINT signals) and suppresses spurious "exited with code" messages during normal Ctrl+C flow.

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
None.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Phase 12 capstone complete (pending human smoke test verification)
- `deno task dev` is the primary developer-facing deliverable
- No blockers for future phases

---
*Phase: 12-local-development-harness*
*Completed: 2026-03-22*

## Self-Check: PASSED

- scripts/dev.ts: FOUND
- deno.json: FOUND
- .gitignore: FOUND
- .planning/phases/12-local-development-harness/12-03-SUMMARY.md: FOUND
- commit c137b20 (Task 1): FOUND
