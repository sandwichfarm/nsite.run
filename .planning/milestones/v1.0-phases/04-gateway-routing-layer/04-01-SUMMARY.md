---
phase: 04-gateway-routing-layer
plan: "01"
subsystem: infra
tags: [deno, routing, hostname-parsing, websocket, blossom, edge-script]

# Dependency graph
requires:
  - phase: 03-blossom
    provides: blossom path regex pattern (BLOB_PATH_RE) and router structure

provides:
  - SitePointer type and extractNpubAndIdentifier() hostname parser
  - route() dispatcher with priority-ordered routing logic
  - Stub handlers for relay, blossom, resolver, and SPA routing
  - export default { fetch } entry point wired to router
  - 29 unit tests covering all 5 ROUTE requirements

affects: [05-nsite-resolver, 06-spa-serving]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Synchronous route() function (no async without await — lint compliance)"
    - "Host header priority over URL hostname for subdomain detection on Bunny Edge Scripts"
    - "TDD RED-GREEN for each file pair (test first, implementation second)"

key-files:
  created:
    - apps/gateway/src/hostname.ts
    - apps/gateway/src/hostname.test.ts
    - apps/gateway/src/router.ts
    - apps/gateway/src/router.test.ts
    - apps/gateway/src/stubs/relay.ts
    - apps/gateway/src/stubs/blossom.ts
    - apps/gateway/src/stubs/resolver.ts
    - apps/gateway/src/stubs/spa.ts
  modified:
    - apps/gateway/src/main.ts
    - apps/gateway/deno.json

key-decisions:
  - "route() returns Response synchronously (not Promise<Response>) — all stubs are synchronous, no async/await needed"
  - "Host header read via request.headers.get('host') with fallback to url.hostname — Bunny Edge Scripts send real hostname in Host header"
  - "Blossom path check happens before subdomain check to avoid routing npub1xxx.nsite.run/upload to resolver"
  - "handleBlossomStub returns 200 CORS for OPTIONS to support browser preflight requests"

patterns-established:
  - "Stub handlers return distinct JSON { routed: 'target' } for test assertion clarity"
  - "Router priority: WebSocket > blossom paths > npub subdomain > SPA fallback"
  - "extractNpubAndIdentifier uses parts[0].startsWith('npub1') for root, parts[1].startsWith('npub1') for named"

requirements-completed: [ROUTE-01, ROUTE-02, ROUTE-03, ROUTE-04, ROUTE-05]

# Metrics
duration: 2min
completed: "2026-03-13"
---

# Phase 04 Plan 01: Gateway Routing Layer Summary

**Host-header router dispatching WebSocket/blossom/npub-subdomain/SPA requests via priority-ordered route() function with TDD-verified stub handlers**

## Performance

- **Duration:** 2 min
- **Started:** 2026-03-13T21:22:03Z
- **Completed:** 2026-03-13T21:24:09Z
- **Tasks:** 3
- **Files modified:** 10

## Accomplishments
- Implemented hostname parser (extractNpubAndIdentifier) handling root/named-site subdomains with port stripping and identifier validation
- Implemented synchronous router with correct priority order: WebSocket upgrade > blossom paths > npub subdomain > SPA fallback
- Created 4 stub handlers returning distinct JSON for routing verification, with CORS support on blossom OPTIONS
- Wired main.ts entry point to router, updated deno.json with @nsite/shared import
- 29 unit tests passing across hostname and router modules, build produces 1.9KB bundle

## Task Commits

1. **Task 1: Hostname parser with SitePointer type and tests** - `c1792b6` (feat)
2. **Task 2: Stub handlers, router dispatch, and routing tests** - `47be375` (feat)
3. **Task 3: Wire main.ts entry point, update deno.json, verify build** - `c644032` (feat)

## Files Created/Modified
- `apps/gateway/src/hostname.ts` - SitePointer interface and extractNpubAndIdentifier() parser
- `apps/gateway/src/hostname.test.ts` - 10 unit tests for subdomain parsing edge cases
- `apps/gateway/src/router.ts` - Priority-ordered route() dispatcher
- `apps/gateway/src/router.test.ts` - 19 unit tests covering all 5 ROUTE requirements
- `apps/gateway/src/stubs/relay.ts` - handleRelayStub (503 JSON, WebSocket confirmation)
- `apps/gateway/src/stubs/blossom.ts` - handleBlossomStub (503 JSON + 200 CORS for OPTIONS)
- `apps/gateway/src/stubs/resolver.ts` - handleResolverStub (503 JSON with SitePointer details)
- `apps/gateway/src/stubs/spa.ts` - handleSpaStub (200 JSON)
- `apps/gateway/src/main.ts` - export default { fetch } wired to router (replaced ALLOWED_KINDS stub)
- `apps/gateway/deno.json` - Added @nsite/shared import for bundling compatibility

## Decisions Made
- route() is synchronous (not async) since all stubs are synchronous — prevents async-without-await lint error
- Host header preferred over url.hostname for subdomain detection (Bunny Edge Scripts pitfall documented in RESEARCH.md)
- Blossom path check before subdomain check prevents routing `/upload` on npub host to resolver
- OPTIONS requests handled in blossom stub for CORS preflight support

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
None.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness
- All 5 ROUTE requirements verified by unit tests
- Router is stateless and synchronous — ready to replace stubs with real implementations in Phase 5
- Phase 5 must implement: relay WebSocket proxy, blossom proxy, npub resolver logic
- Phase 6 must implement: SPA serving replacing handleSpaStub

## Self-Check: PASSED

- FOUND: apps/gateway/src/hostname.ts
- FOUND: apps/gateway/src/hostname.test.ts
- FOUND: apps/gateway/src/router.ts
- FOUND: apps/gateway/src/router.test.ts
- FOUND: apps/gateway/src/stubs/relay.ts
- FOUND: apps/gateway/src/stubs/blossom.ts
- FOUND: apps/gateway/src/stubs/resolver.ts
- FOUND: apps/gateway/src/stubs/spa.ts
- FOUND: apps/gateway/dist/gateway.bundle.js
- FOUND: .planning/phases/04-gateway-routing-layer/04-01-SUMMARY.md
- FOUND: c1792b6 (Task 1 commit)
- FOUND: 47be375 (Task 2 commit)
- FOUND: c644032 (Task 3 commit)

---
*Phase: 04-gateway-routing-layer*
*Completed: 2026-03-13*
