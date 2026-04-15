---
phase: 03-blossom
plan: 01
subsystem: auth, storage, api
tags: [blossom, nostr-tools, bunny-storage, BUD-01, BUD-09, kind-24242, deno]

# Dependency graph
requires:
  - phase: 03-00
    provides: Phase 03 context, research, and test stubs for auth/storage

provides:
  - "BlobDescriptor, BlobMeta, BlobIndexEntry, Config, AuthResult, StoredReport, BlockedConfig types with NostrEvent re-exported from @nsite/shared"
  - "fromBase64, isValidSha256, isValidPubkey, prefix, jsonResponse, errorResponse utility functions"
  - "StorageClient class with full Bunny Storage REST API (put/get/head/delete/getJson/getText/getToml/putJson/blobPath/blobUrl/metaPath/listPath/reportPath/list)"
  - "Blob metadata layer: getMeta/putMeta/addOwner/removeOwner/getIndex/addToIndex/removeFromIndex/getReports/addReport/isBlocked/_resetBlockedCacheForTesting"
  - "validateAuth function: kind 24242 validation with 120s symmetric window, nostr-tools verification, strict x tag enforcement"
  - "CORS middleware: handleOptions/withCors with BUD-compliant headers"

affects: [03-02-handlers, 03-03-router, 03-04-main]

# Tech tracking
tech-stack:
  added:
    - "@nostr/tools@^2.23.3/pure (getEventHash, verifyEvent for kind 24242 auth)"
    - "@std/toml@^1.0.0 (TOML parsing for blocked content config)"
  patterns:
    - "NostrEvent imported from @nsite/shared/types (not redefined locally)"
    - "StorageClient as dependency injection for all metadata functions"
    - "120s symmetric auth window: reject created_at >120s in future OR past"
    - "Strict x tag enforcement: require x tag presence when sha256 option is provided"
    - "In-memory blocked hash cache with configurable TTL (60s default)"

key-files:
  created:
    - "apps/blossom/src/types.ts"
    - "apps/blossom/src/util.ts"
    - "apps/blossom/src/middleware/cors.ts"
    - "apps/blossom/src/storage/client.ts"
    - "apps/blossom/src/storage/metadata.ts"
    - "apps/blossom/src/auth/nostr.ts"
  modified:
    - "apps/blossom/deno.json"

key-decisions:
  - "120s auth window is symmetric: reject events >120s in past (not just future). Stricter than blssm.us 60s future-only check."
  - "Strict x tag: when sha256 option is provided, x tag must be present (not optional). Deviation from blssm.us which only validates if present."
  - "NostrEvent is re-exported from @nsite/shared/types — no local redefinition."
  - "No payment/access types ported: AccessConfig, PaymentConfig, PricingConfig, LightningConfig, CacheConfig, ValidationResult, ServerInfo, PaymentInfo, MintEntry, PaymentAmounts all omitted."
  - "Schnorr verification: @nostr/tools/pure getEventHash+verifyEvent replaces blssm.us schnorr.ts entirely."

patterns-established:
  - "auth/nostr.ts: validateAuth(request, {verb, sha256?, serverUrl?}) -> Promise<AuthResult>"
  - "storage/client.ts: StorageClient constructed from Config, all methods return null/false on failure"
  - "storage/metadata.ts: all functions accept StorageClient as first argument (dependency injection)"

requirements-completed: [BLSM-02, BLSM-06, BLSM-07]

# Metrics
duration: 4min
completed: 2026-03-13
---

# Phase 3 Plan 01: Blossom Foundation Modules Summary

**Blossom foundation ported from blssm.us: types, util, storage client/metadata, kind-24242 auth with nostr-tools and 120s symmetric window, BUD CORS middleware**

## Performance

- **Duration:** 4 min
- **Started:** 2026-03-13T18:55:06Z
- **Completed:** 2026-03-13T18:58:40Z
- **Tasks:** 3
- **Files modified:** 7 (6 created, 1 updated)

## Accomplishments

- Ported all foundation modules from blssm.us into apps/blossom/src with targeted adaptations
- Implemented stricter auth validation: 120s symmetric window (±120s) and required x tag when sha256 option is provided
- All 17 tests pass (9 auth + 8 storage client)

## Task Commits

Each task was committed atomically:

1. **Task 1: Add dependencies and create types, util, cors modules** - `9a66d13` (feat)
2. **Task 2: Port storage client and metadata modules** - `181b09e` (feat)
3. **Task 3: Port auth module with nostr-tools and 120s window** - `443cd2d` (feat)

## Files Created/Modified

- `apps/blossom/deno.json` - Added @nostr/tools/pure and @std/toml imports
- `apps/blossom/src/types.ts` - BlobDescriptor, BlobMeta, BlobIndexEntry, Config, AuthResult, StoredReport, BlockedConfig; NostrEvent re-exported from @nsite/shared
- `apps/blossom/src/util.ts` - fromBase64, isValidSha256, isValidPubkey, prefix, jsonResponse, errorResponse (no @noble/hashes)
- `apps/blossom/src/middleware/cors.ts` - handleOptions, withCors with BUD-compliant CORS headers
- `apps/blossom/src/storage/client.ts` - StorageClient class, full Bunny Storage REST API wrapper
- `apps/blossom/src/storage/metadata.ts` - Blob metadata and index management functions
- `apps/blossom/src/auth/nostr.ts` - validateAuth using nostr-tools, 120s symmetric window

## Decisions Made

1. **120s symmetric window:** The plan specified 120s auth window but the context said "created_at within 120s of server time". The test stubs validated both directions (past AND future), confirming symmetric behavior. Implemented `created_at < now - 120` rejection in addition to future check. Stricter than blssm.us 60s future-only check.

2. **Strict x tag:** Test stubs defined that missing x tag with sha256 option = unauthorized. Implemented required x tag presence (fail if absent, not just if mismatched). Deviation from blssm.us which only validates IF present.

3. **nostr-tools cast pattern:** Used `event as Parameters<typeof getEventHash>[0]` for TypeScript compatibility with @nostr/tools/pure types vs @nsite/shared NostrEvent type.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Stricter x tag enforcement required by test stubs**
- **Found during:** Task 3 (auth module)
- **Issue:** blssm.us validates x tag only if present (`if (xTag && xTag[1] !== options.sha256)`). Test stub at line 128 expects `authorized: false` when x tag is absent but sha256 option is provided.
- **Fix:** Added explicit check: `if (!xTag) { return { authorized: false, error: "Missing 'x' (hash) tag" }; }` when sha256 option is provided.
- **Files modified:** apps/blossom/src/auth/nostr.ts
- **Verification:** All 9 auth tests pass
- **Committed in:** `443cd2d` (Task 3 commit)

**2. [Rule 1 - Bug] Symmetric 120s window required by test stubs**
- **Found during:** Task 3 (auth module)
- **Issue:** Test "expired created_at returns unauthorized" uses created_at 300s in the past with a future expiration tag, expecting unauthorized. blssm.us only rejects events in the future. The plan context says "within 120s of server time" — bidirectional.
- **Fix:** Added `if (event.created_at < now - 120)` check for past events.
- **Files modified:** apps/blossom/src/auth/nostr.ts
- **Verification:** All 9 auth tests pass
- **Committed in:** `443cd2d` (Task 3 commit)

---

**Total deviations:** 2 auto-fixed (both Rule 1 — bug fixes informed by test stubs)
**Impact on plan:** Both fixes implement the intended behavior as clarified by the test stubs. No scope creep.

## Issues Encountered

None — port went smoothly. Test stubs from the planning phase (commit d08d141) provided precise behavioral specification.

## Next Phase Readiness

- All foundation modules ready for handler code (03-02-handlers)
- StorageClient and validateAuth are the primary dependencies for all handlers
- No payment/access middleware exists in middleware/ (only cors.ts) — confirmed
- No schnorr.ts in auth/ (only nostr.ts) — confirmed

---
*Phase: 03-blossom*
*Completed: 2026-03-13*
