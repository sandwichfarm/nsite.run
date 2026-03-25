---
phase: 05-nsite-resolver-and-progressive-caching
plan: "03"
subsystem: gateway
tags: [deno, libsql, nostr, blossom, cache, websocket, sha256, resolver]

# Dependency graph
requires:
  - phase: 05-nsite-resolver-and-progressive-caching
    plan: "01"
    provides: "detectContentType, resolveIndexPath, detectCompression, securityHeaders, renderLoadingPage, renderNotFoundPage, renderDefault404, BANNER_HTML, injectBanner, escapeHtml"
  - phase: 05-nsite-resolver-and-progressive-caching
    plan: "02"
    provides: "createDb, initSchema, queryEvents, insertReplaceableEvent, insertParameterizedReplaceableEvent, npubToHex, queryMultipleRelays"
  - phase: 04-gateway-routing-layer
    provides: "SitePointer type, router.ts dispatch structure"

provides:
  - "CacheEntry interface with loading/ready/not-found state machine"
  - "siteCache and backgroundChecks module-level Maps for edge worker state"
  - "cacheKey() for pubkey + identifier composite keys"
  - "getManifestFiles(), getManifestServers(), getRelayUrls() manifest and relay parsers"
  - "Minimal StorageClient class (Bunny Storage subset: put, get, head, blobPath)"
  - "createStorageClient() reads BUNNY_STORAGE_* env vars gracefully"
  - "handleResolver() live resolver: three-state cache machine, streaming pipeline, file serving"
  - "isHtmlLikePath() exported for loading page path guard logic"
  - "/_nsite/ready endpoint for loading page JS polling"
  - "route() now async, using live handleResolver instead of stub"

affects:
  - 05-04-integration-testing
  - 06-spa-and-deployment

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Lazy DB and storage initialization — avoids createDb() at import time (unit test friendliness)"
    - "Promise-as-mutex for background check deduplication: set Map BEFORE first await"
    - "Streaming/opportunistic resolution: Promise.any() on relay list sources triggers outbox queries"
    - "SHA-256 blob verification before serving: sha256Hex(new Uint8Array(arrayBuffer))"
    - "Minimal StorageClient copied inline (not imported from apps/blossom) per Pitfall 6"
    - "Loading page only for HTML-like paths; asset paths return 404 immediately (Pitfall 2)"
    - "Banner injection guarded by text/html Content-Type check (Pitfall 3)"
    - "Manifest freshness: different ID AND newer created_at required (Pitfall 4)"

key-files:
  created:
    - apps/gateway/src/cache.ts
    - apps/gateway/src/resolver.ts
    - apps/gateway/src/resolver.test.ts
  modified:
    - apps/gateway/src/router.ts
    - apps/gateway/src/router.test.ts
    - apps/gateway/src/main.ts

key-decisions:
  - "Lazy DB/storage init in resolver.ts: createDb() deferred to first request to avoid module-load-time failures in unit tests"
  - "ensureSchema() called after /_nsite/ready path check: ready endpoint needs no DB, avoids network call in tests"
  - "route() made async (Promise<Response>): required since handleResolver is async; main.ts updated to await"
  - "router.test.ts updated to await route() and check 400 (invalid npub) instead of stub 503 for resolver routes"
  - "Test npub uses KNOWN_NPUB from nostr-ws.test.ts for consistency (valid bech32 checksum)"

patterns-established:
  - "Lazy initialization pattern: module-level let _db = null with getter, avoids import-time side effects"
  - "Banner injection on background-check-running signal (conservative: inject when check in-flight)"

requirements-completed: [GATE-05, GATE-06, GATE-07, CACHE-01, CACHE-04, CACHE-05, CACHE-06, CACHE-07, CACHE-08, CACHE-09]

# Metrics
duration: 12min
completed: 2026-03-14
---

# Phase 05 Plan 03: Cache State Machine and Live Resolver Summary

**Three-state cache machine (cold/warm-outdated/warm-current) with streaming resolution pipeline, SHA-256 blob verification, banner injection, and persistence to own relay/blossom — replacing handleResolverStub**

## Performance

- **Duration:** 12 min
- **Started:** 2026-03-13T23:07:56Z
- **Completed:** 2026-03-14T23:20:33Z
- **Tasks:** 2
- **Files modified:** 6

## Accomplishments

- Full cache.ts module: CacheEntry type, siteCache/backgroundChecks Maps, cacheKey, manifest/relay parsers, minimal StorageClient (subset of blossom client)
- Live resolver (resolver.ts) replacing handleResolverStub: three-state cache machine, streaming resolution pipeline fanning out to own DB + seed relays + outbox relays in parallel
- /_nsite/ready endpoint for loading page JS polling (returns JSON, no DB needed)
- SHA-256 blob integrity verification before serving any content (GATE-07)
- Persistence to own relay (insertReplaceableEvent/insertParameterizedReplaceableEvent) and own blossom (StorageClient.put) — both fire-and-forget
- 37 tests in resolver.test.ts: /_nsite/ready states, banner injection guard, loading page path guard, cache key, manifest/server/relay parsers
- Updated router.ts and main.ts to use async route() with live handleResolver

## Task Commits

Each task was committed atomically:

1. **Task 1: Cache types and state module** - `d5d7a67` (feat)
2. **Task 2: Live resolver with behavioral tests** - `fede280` (feat)

## Files Created/Modified

- `apps/gateway/src/cache.ts` — CacheEntry type, siteCache/backgroundChecks Maps, cacheKey, getManifestFiles, getManifestServers, getRelayUrls, StorageClient, createStorageClient
- `apps/gateway/src/resolver.ts` — handleResolver, isHtmlLikePath, three-state cache machine, streaming pipeline, file serving, blob fetch+verify, banner injection, persistence
- `apps/gateway/src/resolver.test.ts` — 37 behavioral tests for resolver critical paths
- `apps/gateway/src/router.ts` — replaced handleResolverStub import with live handleResolver; route() is now async
- `apps/gateway/src/router.test.ts` — updated to await route(), updated resolver routing tests for live resolver behavior
- `apps/gateway/src/main.ts` — fetch() now async, awaits route()

## Decisions Made

- **Lazy DB initialization:** `createDb()` deferred to first request (not module-load time) to avoid LibsqlError at import time in unit tests. Uses a `let _db: Client | null` getter pattern.
- **ensureSchema() placement:** Moved after `/_nsite/ready` path check — the ready endpoint is pure cache state, needs no DB. This allows tests to call handleResolver for /_nsite/ready without triggering DB connection.
- **async route():** Changing route() from sync to async was necessary since handleResolver is async. main.ts updated to await route(). All router tests updated to await route().
- **Test npub:** Used `KNOWN_NPUB` from nostr-ws.test.ts (`npub16zu6akdcyz3...`) — a valid bech32 npub with correct checksum. The original `npub1qqq...34pqua` had wrong checksum and npubToHex returned null, causing 400.
- **Banner injection strategy:** Banner shown when a background check is currently in-flight. This is conservative (may show banner when no update available) but ensures users aren't served stale content silently.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Lazy DB initialization to prevent module-load failure**
- **Found during:** Task 2 (resolver tests)
- **Issue:** The plan said "Module-level initialization" with `const db = createDb()` at module load. But when unit tests import resolver.ts, the libSQL client constructor threw `LibsqlError: URL_INVALID` when BUNNY_DB_URL was empty. The DB was being created before env vars could be set.
- **Fix:** Changed to lazy getter pattern (`let _db: Client | null = null`, `function getDb(): Client`). Also moved `ensureSchema()` after the `/_nsite/ready` path check.
- **Files modified:** apps/gateway/src/resolver.ts
- **Verification:** All 37 resolver tests pass; /_nsite/ready test no longer triggers DB connection
- **Committed in:** fede280 (Task 2 commit)

**2. [Rule 1 - Bug] router.ts test updates for async route()**
- **Found during:** Task 2 (router.ts update)
- **Issue:** router.test.ts called `route(req)` synchronously and compared stub response JSON. After making route() async and using live handleResolver, tests would get Promise instead of Response.
- **Fix:** Added `await` to all `route()` calls; updated resolver routing tests to check for 400 (invalid npub) instead of stub 503 JSON.
- **Files modified:** apps/gateway/src/router.ts, apps/gateway/src/router.test.ts, apps/gateway/src/main.ts
- **Verification:** All 19 router tests pass
- **Committed in:** fede280 (Task 2 commit)

---

**Total deviations:** 2 auto-fixed (both Rule 1 — bugs discovered during implementation)
**Impact on plan:** Both fixes necessary for correct test behavior. The lazy initialization is an improvement over the plan's module-level approach — same runtime behavior, better testability.

## Issues Encountered

- TypeScript strict typing: `Uint8Array` is not assignable to `BodyInit` in this Deno/TypeScript version. Fixed by using `ArrayBuffer` for blob data type and decoding to string for HTML responses only.
- `BUNNY_DB_URL = "file::memory:"` is not a valid libSQL URL format (throws at construction). Fixed by using `"libsql://test.turso.io"` as the test dummy URL (valid format, never queried).

## User Setup Required

None — no new external service configuration required. BUNNY_STORAGE_* and BUNNY_DB_* env vars were already documented in prior phases.

## Next Phase Readiness

- resolver.ts ready for Plan 05-04 integration testing (handleResolver fully functional)
- cache.ts state machine operational — siteCache persists across requests on same edge worker
- router.ts now dispatches all npub subdomain requests to live resolver
- Remaining stubs (relay, blossom, SPA) unchanged — Phase 5 scope only covers resolver

---
*Phase: 05-nsite-resolver-and-progressive-caching*
*Completed: 2026-03-14*

## Self-Check: PASSED

- FOUND: apps/gateway/src/cache.ts
- FOUND: apps/gateway/src/resolver.ts
- FOUND: apps/gateway/src/resolver.test.ts
- FOUND: .planning/phases/05-nsite-resolver-and-progressive-caching/05-03-SUMMARY.md
- FOUND commit: d5d7a67 (Task 1: cache.ts)
- FOUND commit: fede280 (Task 2: resolver.ts + tests)
