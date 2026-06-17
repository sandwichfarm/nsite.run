---
phase: 02-relay
plan: 01
subsystem: database
tags: [nostr, libsql, nip-01, nip-09, nip-11, nip-33, deno, relay, bunny-db]

# Dependency graph
requires:
  - phase: 01-monorepo-and-build-infrastructure
    provides: "Monorepo workspace, shared types (NostrEvent, NostrFilter, NsiteKind), ALLOWED_KINDS constant, validation functions, esbuild bundling"
provides:
  - "ALLOWED_KINDS with kind 5 (NIP-09 deletion) added"
  - "NsiteKind.DELETION entry in shared types"
  - "Relay-local types: ClientMessage, RelayMessage, Subscription, ConnectionState, RateLimitBucket"
  - "DB schema DDL for events, tags, schema_version tables with all indexes"
  - "Database layer: createDb, initSchema, insertEvent, insertReplaceableEvent, insertParameterizedReplaceableEvent, queryEvents, deleteEvents, checkDuplicate"
  - "NIP-11 relay info document handler: buildNip11Response()"
  - "@nostr/tools/pure and @libsql/client/web imports in relay deno.json"
affects: [02-relay-02, any phase implementing WebSocket relay handler]

# Tech tracking
tech-stack:
  added:
    - "@nostr/tools@^2.23.3/pure (jsr) — event verification, hash computation"
    - "@libsql/client/web (npm) — Bunny DB (libSQL) HTTP-based client for edge runtimes"
  patterns:
    - "InValue[] typing for all @libsql/client/web batch/execute args"
    - "SCHEMA_DDL as string[] array run via db.execute() on cold start (idempotent)"
    - "Batch writes with 'write' mode for atomic event + tag inserts"
    - "Soft-delete via deleted_at column for NIP-09 deletion"
    - "buildFilterQuery() for NIP-01 filter-to-SQL translation with subquery for single-letter tag filters"

key-files:
  created:
    - "apps/relay/src/types.ts — ClientMessage, RelayMessage, Subscription, ConnectionState, RateLimitBucket types"
    - "apps/relay/src/schema.ts — SCHEMA_DDL DDL for events/tags/schema_version tables"
    - "apps/relay/src/db.ts — complete database access layer"
    - "apps/relay/src/nip11.ts — NIP-11 relay info document builder"
  modified:
    - "packages/shared/src/constants.ts — added kind 5 to ALLOWED_KINDS"
    - "packages/shared/src/types.ts — added DELETION: 5 to NsiteKind"
    - "packages/shared/src/validation_test.ts — 2 new tests for kind 5"
    - "apps/relay/deno.json — added @nostr/tools/pure and @libsql/client/web imports"

key-decisions:
  - "InValue[] (not unknown[]) for libSQL args — required by @libsql/client/web type constraints"
  - "Soft-delete (deleted_at column) for NIP-09 deletion events — allows deletion event audit trail"
  - "deleted_at IS NULL added to all queryEvents filter conditions to exclude deleted events"
  - "supported_kinds in NIP-11 sourced from ALLOWED_KINDS array to stay in sync with enforcement"
  - "Tag inserts use INSERT OR IGNORE to handle concurrent duplicate prevention"

patterns-established:
  - "DB batch writes: always use db.batch([...], 'write') for atomic event + tag inserts"
  - "Filter query: buildFilterQuery() returns {sql, args: InValue[]} from NostrFilter"
  - "NIP-33 upsert: DELETE WHERE kind+pubkey+d_tag+created_at<=?, then INSERT OR IGNORE"
  - "NIP-01 replaceable upsert: DELETE WHERE kind+pubkey+created_at<=?, then INSERT OR IGNORE"

requirements-completed: [RELAY-01, RELAY-02, RELAY-03, RELAY-04, RELAY-05, RELAY-07, RELAY-08]

# Metrics
duration: 4min
completed: 2026-03-13
---

# Phase 2 Plan 01: Relay Foundation — Types, Schema, DB, and NIP-11

**libSQL event store with NIP-09 soft-delete, NIP-33 d-tag upsert, and NIP-11 relay info document, backed by @nostr/tools/pure and @libsql/client/web**

## Performance

- **Duration:** 4 min
- **Started:** 2026-03-13T15:45:08Z
- **Completed:** 2026-03-13T15:49:40Z
- **Tasks:** 3
- **Files modified:** 8

## Accomplishments
- Added kind 5 (NIP-09 deletion) to ALLOWED_KINDS and NsiteKind; 16 shared tests pass
- Built complete DB layer with atomic batch writes, NIP-33 parameterized replaceable upsert, NIP-01 replaceable upsert, NIP-01 filter query builder, and soft-delete for NIP-09
- Created NIP-11 relay info document handler with CORS, supported_kinds from ALLOWED_KINDS, and all required limitation fields

## Task Commits

Each task was committed atomically:

1. **Task 1: Add dependencies and update shared constants for kind 5** - `68d83fd` (feat)
2. **Task 2: Create relay types, DB schema, and database layer** - `9f51180` (feat)
3. **Task 3: Create NIP-11 relay info document handler** - `32a1c20` (feat)

**Plan metadata:** (docs commit below)

## Files Created/Modified
- `packages/shared/src/constants.ts` - Added kind 5 to ALLOWED_KINDS with NIP-09 comment
- `packages/shared/src/types.ts` - Added DELETION: 5 to NsiteKind const
- `packages/shared/src/validation_test.ts` - 2 new tests for kind 5 (16 total)
- `apps/relay/deno.json` - Added @nostr/tools/pure and @libsql/client/web imports
- `apps/relay/src/types.ts` - ClientMessage, RelayMessage, Subscription, ConnectionState, RateLimitBucket
- `apps/relay/src/schema.ts` - SCHEMA_DDL: events, tags, schema_version DDL + indexes
- `apps/relay/src/db.ts` - Full DB layer: createDb, initSchema, insertEvent, insertReplaceableEvent, insertParameterizedReplaceableEvent, queryEvents, deleteEvents, checkDuplicate
- `apps/relay/src/nip11.ts` - buildNip11Response() returning NIP-11 JSON with CORS

## Decisions Made
- Used `InValue[]` type assertion for libSQL batch args — the @libsql/client/web `InArgs` type is `Array<InValue>` and TypeScript couldn't infer `unknown[]` as compatible. Explicit cast is correct and clean.
- Soft-delete approach for NIP-09: set `deleted_at` instead of hard-deleting, preserving the deletion event audit trail and allowing NIP-09 compliance verification.
- All queryEvents results filter `deleted_at IS NULL` at SQL level for efficiency.
- `supported_kinds` in NIP-11 document sourced from `[...ALLOWED_KINDS].sort()` to stay synchronized with relay enforcement automatically.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Fixed InValue[] type for @libsql/client/web batch args**
- **Found during:** Task 2 (Create relay types, DB schema, and database layer)
- **Issue:** `args: unknown[]` in batch statements caused TS2322 type errors — @libsql/client/web requires `InArgs` (= `Array<InValue>`) not `unknown[]`
- **Fix:** Imported `InValue` from `@libsql/client/web`, used `InValue[]` as the type for all statement args arrays. Added `as InValue[]` assertions where needed.
- **Files modified:** apps/relay/src/db.ts
- **Verification:** `deno check apps/relay/src/db.ts` passes with 0 errors
- **Committed in:** 9f51180 (Task 2 commit)

---

**Total deviations:** 1 auto-fixed (Rule 1 — type error)
**Impact on plan:** Required for TypeScript correctness with the libSQL client API. No scope creep.

## Issues Encountered
None — all tasks executed cleanly after the InValue[] type fix.

## User Setup Required
None - no external service configuration required at this stage. Relay database connection (BUNNY_DB_URL, BUNNY_DB_AUTH_TOKEN) and operator npub will be documented in a later setup guide before deployment.

## Next Phase Readiness
- All types, schema, and DB functions are ready for the WebSocket relay handler (Plan 02-02)
- NIP-11 handler is ready to wire into the main fetch handler in main.ts
- @nostr/tools/pure is imported and available for event verification in handler.ts
- One item pending before production: replace PLACEHOLDER_NPUB in nip11.ts with operator's actual npub

---
*Phase: 02-relay*
*Completed: 2026-03-13*
