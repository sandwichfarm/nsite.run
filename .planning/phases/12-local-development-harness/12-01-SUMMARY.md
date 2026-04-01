---
phase: 12-local-development-harness
plan: 01
subsystem: infra
tags: [deno, local-dev, filesystem, sqlite, libsql, bunny-polyfill, websocket]

# Dependency graph
requires: []
provides:
  - LocalStorageClient class implementing StorageClient interface via Deno FS APIs
  - Relay dev entrypoint with Bunny.v1.serve polyfill and @libsql/client/node + file: SQLite
  - Blossom dev entrypoint with Bunny.v1.serve polyfill and LocalStorageClient
affects: [12-02-gateway-dev, 12-03-orchestrator]

# Tech tracking
tech-stack:
  added: ["@std/path (jsr:@std/path@^1.0.6, already in deno.lock)", "npm:@libsql/client/node for file: URL SQLite support"]
  patterns: ["dev entrypoint pattern: inject polyfill → patch globals → import handler directly"]

key-files:
  created:
    - apps/blossom/src/storage/local.ts
    - apps/blossom/src/storage/local.test.ts
    - apps/relay/src/dev.ts
    - apps/blossom/src/dev.ts
  modified:
    - apps/blossom/deno.json

key-decisions:
  - "LocalStorageClient uses structural cast (as unknown as StorageClient) in dev.ts because router types storage as concrete StorageClient class, not an interface — dev-only workaround"
  - "Relay dev.ts duplicates ~25 lines from main.ts instead of importing it to avoid @libsql/client/web import map conflict that rejects file: URLs"
  - "LocalStorageClient.blobUrl() uses serverUrl not cdnHostname because local blossom serves blobs directly (no CDN redirect)"
  - "Add @std/path to apps/blossom/deno.json import map (was missing though already locked in deno.lock)"

patterns-established:
  - "Dev entrypoint pattern: set env vars → inject globalThis.Bunny polyfill → patch Request.prototype → import handler modules → start Deno.serve"
  - "TDD flow: write failing tests → commit RED → implement → run tests → verify GREEN → commit"

requirements-completed: [DEV-01, DEV-02, DEV-03]

# Metrics
duration: 4min
completed: 2026-03-22
---

# Phase 12 Plan 01: Local Dev Foundation Summary

**Filesystem-backed LocalStorageClient + relay/blossom Deno dev entrypoints with Bunny.v1.serve polyfill and local SQLite, enabling both services to run without any cloud credentials**

## Performance

- **Duration:** ~4 min
- **Started:** 2026-03-22T14:28:35Z
- **Completed:** 2026-03-22T14:31:41Z
- **Tasks:** 3 (plus TDD RED commit)
- **Files modified:** 5

## Accomplishments
- LocalStorageClient with full Deno FS implementation (put/get/head/delete/list/getJson/putJson/getText/getToml) — 16 tests all pass
- Relay dev entrypoint uses npm:@libsql/client/node for file: SQLite support, patches Request.prototype.upgradeWebSocket for Deno native WebSocket upgrade
- Blossom dev entrypoint wires router directly with LocalStorageClient — no Bunny Storage credentials required for local dev
- Zero modifications to production main.ts files in either service

## Task Commits

Each task was committed atomically:

1. **TDD RED: LocalStorageClient tests (failing)** - `b68818e` (test)
2. **Task 1: LocalStorageClient implementation** - `1441cfc` (feat)
3. **Task 2: Relay dev entrypoint** - `5650e23` (feat)
4. **Task 3: Blossom dev entrypoint** - `23579d4` (feat)

_Note: Task 1 is TDD — RED commit (b68818e) then GREEN commit (1441cfc)_

## Files Created/Modified
- `apps/blossom/src/storage/local.ts` - LocalStorageClient class with Deno FS-backed storage
- `apps/blossom/src/storage/local.test.ts` - 16 filesystem round-trip tests (put/get/delete/list/json)
- `apps/relay/src/dev.ts` - Relay dev entrypoint: Bunny polyfill + WS shim + @libsql/client/node + SQLite
- `apps/blossom/src/dev.ts` - Blossom dev entrypoint: Bunny polyfill + LocalStorageClient + router
- `apps/blossom/deno.json` - Added @std/path to import map (needed for LocalStorageClient)

## Decisions Made
- **Structural cast in blossom dev.ts:** The router types storage as the concrete `StorageClient` class (not an interface), so `LocalStorageClient` cannot be passed directly without a cast. Used `as unknown as StorageClient` in the dev-only entrypoint — acceptable since both implement the same interface.
- **Relay duplicates main.ts logic:** Cannot import relay main.ts from dev.ts because main.ts hardcodes `@libsql/client/web` in its import, which goes through the deno.json import map and rejects `file:` URLs. Duplicating the ~25 lines avoids this conflict entirely.
- **blobUrl uses serverUrl not CDN:** For local dev, blossom serves blobs directly, so `blobUrl()` returns a localhost URL rather than a CDN URL.
- **@std/path added to blossom deno.json:** Already in deno.lock workspace-wide but wasn't in the blossom-level import map — added `"@std/path": "jsr:@std/path@^1.0.6"`.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Fixed TypeScript cast for Request.prototype patching in relay dev.ts**
- **Found during:** Task 2 (relay dev entrypoint)
- **Issue:** `(Request.prototype as Record<string, unknown>)` fails type-check because `Request` does not have index signature — TypeScript rejects the cast
- **Fix:** Changed to `(Request.prototype as unknown as Record<string, unknown>)` which goes through `unknown` first
- **Files modified:** apps/relay/src/dev.ts
- **Verification:** `deno check apps/relay/src/dev.ts` passes
- **Committed in:** 5650e23 (Task 2 commit)

**2. [Rule 3 - Blocking] Added @std/path to blossom deno.json import map**
- **Found during:** Task 1 (LocalStorageClient)
- **Issue:** `@std/path` not in blossom's import map even though it was already in deno.lock — import failed at type-check
- **Fix:** Added `"@std/path": "jsr:@std/path@^1.0.6"` to apps/blossom/deno.json imports
- **Files modified:** apps/blossom/deno.json
- **Verification:** `deno check apps/blossom/src/storage/local.ts` passes
- **Committed in:** 1441cfc (Task 1 commit)

**3. [Rule 3 - Blocking] Fixed list test to use direct file paths instead of nested dirs**
- **Found during:** Task 1 (LocalStorageClient TDD)
- **Issue:** Test put files at `lists/pk/pubkey123/index.json` then called `list("lists/pk/")` — but those create subdirectories at the top level, not files, so list() returned 0 results (it only returns files, not directories, matching Bunny API behavior)
- **Fix:** Changed test to put files directly at `listtest/ab/file1.json` and `listtest/ab/file2.json` then list `"listtest/ab/"`
- **Files modified:** apps/blossom/src/storage/local.test.ts
- **Verification:** All 16 tests pass
- **Committed in:** 1441cfc (Task 1 commit)

---

**Total deviations:** 3 auto-fixed (1 bug, 2 blocking)
**Impact on plan:** All auto-fixes required for correctness. No scope creep.

## Issues Encountered
- StorageClient is typed as a concrete class not an interface in router.ts — LocalStorageClient cannot be passed without a cast. Used structural cast in dev.ts as an acceptable dev-only workaround.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- LocalStorageClient, relay dev.ts, and blossom dev.ts are ready for use by Plan 02 (gateway dev entrypoint)
- Plan 03 orchestrator (scripts/dev.ts) can reference these entrypoints as subprocess spawn targets
- No blockers

---
*Phase: 12-local-development-harness*
*Completed: 2026-03-22*
