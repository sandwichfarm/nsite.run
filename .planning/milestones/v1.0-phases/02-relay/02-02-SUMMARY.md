---
phase: 02-relay
plan: 02
subsystem: relay
tags: [nostr, websocket, nip-01, nip-09, nip-11, nip-33, rate-limiting, deno, libsql, bunny-db]

# Dependency graph
requires:
  - phase: 02-relay
    plan: 01
    provides: "ClientMessage/RelayMessage/ConnectionState/RateLimitBucket types, DB layer (insertEvent, insertReplaceableEvent, insertParameterizedReplaceableEvent, queryEvents, deleteEvents, checkDuplicate), NIP-11 buildNip11Response, @nostr/tools/pure and @libsql/client/web imports"
provides:
  - "Per-connection rate limiter: createRateLimitBucket and checkRateLimit (100 events/min, 20 reqs/min, 60s sliding window)"
  - "NIP-01 handleEvent: full verification chain (fields, kind, duplicate, id hash, signature, future timestamp), kind-specific storage, subscription broadcast"
  - "NIP-01 handleReq: filter validation, cap at 10 filters, queryEvents, per-event EVENT sends, EOSE, subscription storage"
  - "NIP-01 handleClose: silent subscription removal from connection state"
  - "WebSocket upgrade handler: Deno.upgradeWebSocket, per-connection ConnectionState, rate-limited message dispatch, error handling"
  - "main.ts entry point: NIP-11 Accept header dispatch, WebSocket Upgrade header dispatch, plain HTTP fallback, cold-start schema init"
  - "Relay bundle: 113.3KB (nostr-tools included), well under 1MB threshold"
affects: [03-blossom, 04-gateway, any phase needing relay WebSocket protocol details]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "handleEvent verification chain: fields → kind → duplicate → id hash → signature → future timestamp → kind-specific storage → broadcast"
    - "matchesFilter() in handler.ts for in-memory subscription matching after EVENT storage"
    - "send() helper checks socket.readyState === WebSocket.OPEN before sending to avoid errors on closed sockets"
    - "schemaReady Promise awaited on every request (resolves immediately after cold start)"
    - "Per-connection rate limit bucket mutated in place with sliding window reset"

key-files:
  created:
    - "apps/relay/src/ratelimit.ts — createRateLimitBucket and checkRateLimit with 100 events/min and 20 reqs/min"
    - "apps/relay/src/handler.ts — handleEvent, handleReq, handleClose with full NIP-01 semantics"
    - "apps/relay/src/relay.ts — handleWebSocketUpgrade with Deno.upgradeWebSocket and message dispatch"
  modified:
    - "apps/relay/src/main.ts — replaced stub with full NIP-11 + WebSocket + fallback fetch handler"

key-decisions:
  - "handleEvent accepts ConnectionState to enable post-storage broadcast to matching subscriptions"
  - "matchesFilter() implemented in handler.ts for in-memory filter matching (prefix match for ids/authors per NIP-01)"
  - "send() helper guards readyState to prevent send-after-close errors"
  - "handleClose sends no response (NIP-01 does not require server response for CLOSE)"
  - "Malformed JSON and non-array messages get NOTICE then socket close (per locked decision)"

patterns-established:
  - "NIP-01 verification order: missing fields → blocked kind → duplicate → bad id hash → bad signature → future timestamp"
  - "Subscription broadcast: after EVENT storage, iterate all connection subscriptions and send to matching ones"
  - "Rate limit before dispatch: checkRateLimit called before handler functions, returns OK false or NOTICE if limited"

requirements-completed: [RELAY-01, RELAY-02, RELAY-03, RELAY-04, RELAY-05, RELAY-06, RELAY-07, RELAY-08]

# Metrics
duration: 3min
completed: 2026-03-13
---

# Phase 2 Plan 02: WebSocket Relay Runtime Summary

**Full NIP-01 WebSocket relay with event verification, kind-specific storage, subscription broadcast, rate limiting, and main.ts entry point serving NIP-11 over HTTP — relay bundle 113.3KB**

## Performance

- **Duration:** 3 min
- **Started:** 2026-03-13T15:53:29Z
- **Completed:** 2026-03-13T15:55:44Z
- **Tasks:** 3
- **Files modified:** 4

## Accomplishments
- Built complete NIP-01 message handling: EVENT with 6-step verification chain and kind-specific storage, REQ with filter cap/query/EOSE/subscription storage, CLOSE with silent subscription removal
- Added per-connection rate limiting (100 events/min, 20 reqs/min) with 60-second sliding window reset
- Wired main.ts entry point dispatching NIP-11 (Accept header), WebSocket upgrade (Upgrade header), and plain HTTP fallback; relay bundle ships at 113.3KB

## Task Commits

Each task was committed atomically:

1. **Task 1: Create rate limiter and NIP-01 message handlers** - `d9d4b92` (feat)
2. **Task 2: Create WebSocket upgrade handler with message dispatch** - `ede13fd` (feat)
3. **Task 3: Wire main.ts entry point and verify full build** - `4e55de9` (feat)

**Plan metadata:** (docs commit below)

## Files Created/Modified
- `apps/relay/src/ratelimit.ts` - createRateLimitBucket and checkRateLimit; 60s sliding window, 100 events/min, 20 reqs/min
- `apps/relay/src/handler.ts` - handleEvent (fields → kind → duplicate → id hash → sig → future → storage → broadcast), handleReq (validate → query → EVENT* → EOSE → store sub), handleClose (silent remove)
- `apps/relay/src/relay.ts` - handleWebSocketUpgrade using Deno.upgradeWebSocket; per-connection ConnectionState; rate-limited EVENT/REQ/CLOSE dispatch; try/catch with NOTICE on error
- `apps/relay/src/main.ts` - replaced stub; NIP-11 on Accept header; WebSocket on Upgrade header; plain text fallback; cold-start schema init

## Decisions Made
- `handleEvent` and `handleReq` both accept `ConnectionState` so handlers can update and read subscription state without relay.ts re-parsing
- `matchesFilter()` implements NIP-01 prefix matching for ids/authors and exact match for kinds/tags — enables correct post-storage subscription broadcast without a second DB round-trip
- `send()` helper guards `socket.readyState === WebSocket.OPEN` to prevent errors when socket closes mid-processing
- `handleClose` sends no response message — NIP-01 does not define a mandatory server response for CLOSE (CLOSED is NIP-42 auth, not applicable here)

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
None — all tasks executed cleanly. All 8 relay source files pass deno check, lint, and fmt. All 16 shared tests pass.

## User Setup Required
None - no additional external service configuration required. The relay DB connection env vars (BUNNY_DB_URL, BUNNY_DB_AUTH_TOKEN) were already documented in plan 02-01.

## Next Phase Readiness
- Complete NIP-01 relay runtime is ready; a WebSocket client can connect, publish events, and query them back
- NIP-11 is served on HTTP GET with Accept: application/nostr+json
- Rate limiting is active per connection
- Plan 02-03 (relay integration tests or final relay plan) can proceed

---
*Phase: 02-relay*
*Completed: 2026-03-13*
