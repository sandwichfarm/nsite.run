---
gsd_state_version: 1.0
milestone: v1.3
milestone_name: Local Dev
status: unknown
stopped_at: Completed 12-03-PLAN.md Task 1 (root dev orchestrator) — awaiting Task 2 human smoke test
last_updated: "2026-03-22T15:39:03.799Z"
progress:
  total_phases: 1
  completed_phases: 1
  total_plans: 3
  completed_plans: 3
---

# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-03-21)

**Core value:** Provide reliable, always-available nsite infrastructure that serves sites fast via progressive caching while making the relay and blossom accessible to the broader nsite ecosystem.
**Current focus:** Phase 12 — local-development-harness

## Current Position

Phase: 12 (local-development-harness) — EXECUTING
Plan: 3 of 3

## Accumulated Context

### Decisions

See PROJECT.md Key Decisions table.

Recent decisions affecting Phase 12:

- [Phase 11]: v1.2 complete — continuous phase numbering continues at 12 for v1.3
- [Phase 12 Plan 01]: LocalStorageClient uses structural cast (as unknown as StorageClient) in dev.ts because router types storage as concrete class, not interface
- [Phase 12 Plan 01]: Relay dev.ts duplicates ~25 lines from main.ts instead of importing it to avoid @libsql/client/web import map conflict that rejects file: URLs
- [Phase 12 Plan 01]: LocalStorageClient.blobUrl() uses serverUrl (not cdnHostname) — local blossom serves blobs directly
- [Phase 12]: Gateway dev.ts duplicates router.ts routing logic to swap blossom stub statically imported at module-level — avoids BUNNY_STORAGE_* env var requirement in dev
- [Phase 12]: .env.local renamed to .env.production.local so Vite .env.development takes effect in dev mode without being overridden by higher-priority .env.local
- [Phase 12-03]: scripts/dev.ts runs services via direct deno run --allow-all entrypoints; SPA via npm run dev in apps/spa cwd; shuttingDown flag prevents re-entrant shutdown

### Pending Todos

None.

### Blockers/Concerns

None.

## Session Continuity

Last session: 2026-03-22T14:41:19.848Z
Stopped at: Completed 12-03-PLAN.md Task 1 (root dev orchestrator) — awaiting Task 2 human smoke test
Resume file: None
