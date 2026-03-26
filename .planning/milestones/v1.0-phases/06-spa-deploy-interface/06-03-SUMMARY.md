---
phase: 06-spa-deploy-interface
plan: 03
subsystem: ui
tags: [svelte, nostr, blossom, bud-02, vitest, tdd, upload, manifest]

# Dependency graph
requires: ["06-01"]
provides:
  - "store.js: Svelte writable stores with localStorage persistence (session, deployState, serverConfig)"
  - "nostr.js: Signer creation (anonymous/NIP-07/NIP-46), relay pool, profile/relay/blossom fetch"
  - "upload.js: BUD-02 blob upload with kind 24242 auth event builder"
  - "publish.js: Kind 15128 manifest builder with path/server tags and SPA fallback"
affects: [06-04, 06-05]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "BUD-02 auth event pattern: kind 24242 with t/x/expiration tags, base64-encoded for Authorization header"
    - "Kind 15128 manifest: path tags [path, /file, sha256] + server tags + SPA fallback /404.html"
    - "TDD flow: failing tests committed (RED) before implementation (GREEN)"
    - "queryRelay() helper: one-shot WebSocket REQ/EOSE/CLOSE pattern for profile/relay/blossom fetch"

key-files:
  created:
    - "apps/spa/src/lib/store.js"
    - "apps/spa/src/lib/nostr.js"
    - "apps/spa/src/lib/upload.js"
    - "apps/spa/src/lib/publish.js"
    - "apps/spa/src/lib/__tests__/upload.test.js"
    - "apps/spa/src/lib/__tests__/publish.test.js"
  modified: []

key-decisions:
  - "DEFAULT_RELAYS excludes wss://nsite.run — nsite relay rejects kind 24133 NIP-46 messages"
  - "queryRelay uses raw WebSocket (not RelayPool) for one-shot queries — simpler, no subscription management needed"
  - "persistedStore wraps try/catch on both localStorage.getItem and JSON.parse — handles private browsing and malformed stored values"
  - "uploadBlob does HEAD check before PUT — avoids re-uploading already-present blobs (BUD-02 pattern)"
  - "publishToRelay uses WebSocket directly (not RelayPool) — needed for waiting on OK response with timeout"

requirements-completed: [SPA-02, SPA-03, SPA-09, SPA-10]

# Metrics
duration: 4min
completed: 2026-03-17
---

# Phase 6 Plan 03: Auth, Upload, and Manifest Library Modules Summary

**Four lib modules implementing identity (anonymous/NIP-07/NIP-46), BUD-02 blob upload, and kind 15128 manifest publishing — 24 unit tests passing via TDD**

## Performance

- **Duration:** 4 min
- **Started:** 2026-03-17T12:40:26Z
- **Completed:** 2026-03-17T12:44:45Z
- **Tasks:** 2
- **Files modified:** 6

## Accomplishments

- store.js: `persistedStore()` factory + `session`, `deployState`, `serverConfig` stores with localStorage sync
- nostr.js: `createAnonymousSigner`, `createExtensionSigner`, `createNostrConnectSigner`, `connectFromBunkerURI`, `fetchProfile`, `fetchRelayList`, `fetchBlossomList`
- upload.js: `buildAuthEvent`, `uploadBlob` (with HEAD skip), `uploadAllBlobs` with progress callback
- publish.js: `buildManifest`, `publishToRelay` (10s timeout), `publishManifest`
- 24 unit tests written via TDD: 10 in upload.test.js, 14 in publish.test.js — all pass
- Build verified: Vite produces dist/ without import errors

## Task Commits

Each task was committed atomically:

1. **Task 1: Create store.js and nostr.js** - `cc0c532` (feat)
2. **Task 2 RED: Failing tests for upload/publish** - `aa7b490` (test)
3. **Task 2 GREEN: Implement upload.js and publish.js** - `677bd3e` (feat)

**Plan metadata:** (docs commit follows)

## Files Created/Modified

- `apps/spa/src/lib/store.js` - persistedStore, session, deployState, serverConfig
- `apps/spa/src/lib/nostr.js` - signers, relay pool, profile/relay/blossom fetch
- `apps/spa/src/lib/upload.js` - buildAuthEvent, uploadBlob, uploadAllBlobs
- `apps/spa/src/lib/publish.js` - buildManifest, publishToRelay, publishManifest
- `apps/spa/src/lib/__tests__/upload.test.js` - 10 tests for buildAuthEvent + auth header
- `apps/spa/src/lib/__tests__/publish.test.js` - 14 tests for buildManifest (kind, tags, fallback)

## Decisions Made

- DEFAULT_RELAYS = ['wss://relay.damus.io', 'wss://relay.primal.net'] — excludes wss://nsite.run because the nsite relay is kind-restricted and rejects kind 24133 NIP-46 messages
- Raw WebSocket pattern used for `queryRelay()` (one-shot fetch) instead of RelayPool — avoids subscription management overhead for simple lookup queries
- `publishToRelay` uses raw WebSocket to wait for the specific OK response — RelayPool's publish method doesn't provide a clean way to await OK with custom timeout
- `persistedStore` catches both localStorage errors and JSON parse errors — handles private browsing mode, quota exceeded, and malformed data

## Deviations from Plan

None — plan executed exactly as written.

## Issues Encountered

Pre-existing failing test in `apps/spa/src/lib/__tests__/scanner.test.js` (untracked file from plan 06-02):
- 1 test fails: "detects GitHub Token (ghp_ prefix)"
- This is pre-existing and out of scope for this plan (different module, not caused by changes here)
- Logged as deferred item — to be addressed in plan 06-02 scope if needed

## User Setup Required

None — no external service configuration required.

## Next Phase Readiness

- All four lib modules ready for UI component integration (Plans 04/05)
- Exports match plan's artifact spec exactly
- Tests cover all pure-logic functions; network functions verified at build time

---
*Phase: 06-spa-deploy-interface*
*Completed: 2026-03-17*

## Self-Check: PASSED

All 6 source files found on disk. All 3 task commits (cc0c532, aa7b490, 677bd3e) confirmed in git log.
