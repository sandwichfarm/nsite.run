---
phase: 05-nsite-resolver-and-progressive-caching
plan: "02"
subsystem: database
tags: [libsql, nostr, websocket, nip-01, bech32, npub, turso, gateway]

requires:
  - phase: 04-gateway-routing-layer
    provides: Gateway app structure (deno.json, src/, hostname.ts) that this extends
  - phase: 01-monorepo-and-build-infrastructure
    provides: Workspace import maps and @nsite/shared/types for NostrEvent/NostrFilter

provides:
  - Direct libSQL DB access layer for gateway (createDb, initSchema, queryEvents, insertReplaceableEvent, insertParameterizedReplaceableEvent, buildFilterQuery)
  - NIP-01 raw WebSocket relay client (queryRelayOnce, queryMultipleRelays)
  - npub bech32 decoder (npubToHex)

affects:
  - 05-03 (resolver uses both db.ts and nostr-ws.ts as its two data access channels)

tech-stack:
  added:
    - "@nostr/tools/pure mapped to jsr:@nostr/tools@^2.23.3 (full package for nip19 access)"
    - "npm:@libsql/client/web (shared with relay, gateway deno.json)"
  patterns:
    - "Intentional code duplication over cross-package imports (db.ts copied from relay, not imported)"
    - "Never-reject WebSocket client: always resolves with collected events or empty array"
    - "buildFilterQuery exported for unit testing (departure from relay where it was private)"
    - "TDD flow: RED commit with failing tests, GREEN commit with implementation"

key-files:
  created:
    - apps/gateway/src/db.ts
    - apps/gateway/src/db.test.ts
    - apps/gateway/src/nostr-ws.ts
    - apps/gateway/src/nostr-ws.test.ts
  modified:
    - apps/gateway/deno.json

key-decisions:
  - "db.ts intentionally duplicates relay code — no cross-package imports (Pitfall 6: Edge Scripts have independent module graphs)"
  - "SCHEMA_DDL inlined in gateway db.ts (not imported from relay/schema.ts) — same rationale"
  - "buildFilterQuery exported (not private) in gateway version to enable direct unit testing of #d filter path"
  - "gateway deno.json maps @nostr/tools/pure to full package jsr:@nostr/tools@^2.23.3 (nip19 is not in /pure subset)"
  - "queryRelayOnce uses Promise (not async) to avoid implicit rejection — settle() helper prevents double-resolve"

patterns-established:
  - "Graceful WebSocket client: settle() helper with settled flag ensures single resolution on EOSE, timeout, error, or close"
  - "queryMultipleRelays uses Promise.allSettled so one failing relay doesn't block others"

requirements-completed: [GATE-01, GATE-02, GATE-03, GATE-04]

duration: 5min
completed: 2026-03-13
---

# Phase 5 Plan 02: Gateway DB Layer and NIP-01 WebSocket Client Summary

**Direct libSQL DB access layer (db.ts, copied from relay) and raw NIP-01 WebSocket client (nostr-ws.ts) with npub decoder — two data access channels consumed by Plan 03 resolver**

## Performance

- **Duration:** ~5 min
- **Started:** 2026-03-13T22:33:11Z
- **Completed:** 2026-03-13T22:37:35Z
- **Tasks:** 2
- **Files modified:** 5 (4 created, 1 modified)

## Accomplishments

- Gateway DB layer copied from relay with inline SCHEMA_DDL, full buildFilterQuery including generic #X tag filter support for named site resolution via `"#d": [identifier]`
- NIP-01 WebSocket client that collects events until EOSE or timeout, never rejects, handles connection errors gracefully
- npubToHex decodes valid npub bech32 to hex, returns null for wrong type (nsec, note1, nprofile) and invalid input
- 39 tests total: 21 for db.ts (including critical #d tag filter path for GATE-02) and 18 for nostr-ws.ts (full npubToHex coverage)
- Type checking passes on both modules

## Task Commits

Each task was committed atomically:

1. **Task 1: Gateway DB layer and dependency setup** - `91fb745` (feat)
2. **Task 2 RED: Failing tests for NIP-01 WebSocket client** - `1161541` (test)
3. **Task 2 GREEN: NIP-01 WebSocket client and npub decoder** - `970380b` (feat)

_Note: Task 2 used TDD — RED commit with failing tests first, GREEN commit with implementation_

## Files Created/Modified

- `apps/gateway/src/db.ts` - Direct libSQL client: createDb, initSchema, queryEvents, insertReplaceableEvent, insertParameterizedReplaceableEvent, buildFilterQuery (exported)
- `apps/gateway/src/db.test.ts` - 21 unit tests for pure logic and module shape; critical #d tag filter test for GATE-02
- `apps/gateway/src/nostr-ws.ts` - NIP-01 WebSocket client: npubToHex, queryRelayOnce, queryMultipleRelays
- `apps/gateway/src/nostr-ws.test.ts` - 18 tests: full npubToHex coverage, structural WebSocket tests
- `apps/gateway/deno.json` - Added @nostr/tools/pure (mapped to full package) and @libsql/client/web imports

## Decisions Made

- **Intentional duplication:** db.ts copies relay code instead of importing across packages. Relay and gateway are independent Edge Scripts — cross-package imports break the build (Pitfall 6 from RESEARCH.md).
- **SCHEMA_DDL inlined:** Same rationale — copied into db.ts instead of importing from apps/relay/src/schema.ts.
- **buildFilterQuery exported:** Made public (vs private in relay) to enable direct unit testing of the #d tag filter path critical for GATE-02 named site resolution.
- **@nostr/tools/pure mapped to full package:** The `/pure` subset only exports cryptographic functions (finalizeEvent, generateSecretKey, etc.) — nip19 is in the full package. Gateway deno.json maps the specifier to `jsr:@nostr/tools@^2.23.3` (no /pure suffix).
- **Never-reject pattern:** queryRelayOnce uses a settle() helper with a `settled` flag to guarantee single resolution regardless of which event (EOSE, timeout, error, close) fires first.

## Deviations from Plan

None — plan executed exactly as written. The only fix was correcting an invalid KNOWN_NPUB constant in tests (wrong checksum) — auto-fixed inline during GREEN phase before commit.

## Issues Encountered

- The `deno test` command without `--allow-env` could not run the `createDb` test that calls `Deno.env.set()`. Fixed by using the `permissions: { env: true }` test option — which works when tests are run with `--allow-all` (the root workspace test command).
- KNOWN_NPUB in tests had an invalid bech32 checksum (was illustrative, not real). Decoded the actual hex using `deno eval` and updated both the npub and hex constants.

## User Setup Required

None — no external service configuration required beyond existing BUNNY_DB_URL and BUNNY_DB_AUTH_TOKEN environment variables.

## Next Phase Readiness

- `apps/gateway/src/db.ts` ready for import by Plan 03 resolver (createDb, queryEvents, insertReplaceableEvent, insertParameterizedReplaceableEvent)
- `apps/gateway/src/nostr-ws.ts` ready for import by Plan 03 resolver (npubToHex, queryRelayOnce, queryMultipleRelays)
- Both modules type-checked and tested
- buildFilterQuery handles "#d" tag filter required for GATE-02 named site resolution

---
*Phase: 05-nsite-resolver-and-progressive-caching*
*Completed: 2026-03-13*
