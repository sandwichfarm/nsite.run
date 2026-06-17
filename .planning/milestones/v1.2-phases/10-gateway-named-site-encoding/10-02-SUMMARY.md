---
phase: 10-gateway-named-site-encoding
plan: 02
subsystem: gateway
tags: [base36, hostname, parsing, gateway, deno, pubkey, named-sites, typescript]

requires:
  - phase: 10-01
    provides: "base36Decode function in @nsite/shared/base36 — used to decode pubkey from named site label"

provides:
  - "extractNpubAndIdentifier parses base36 single-label named sites (51-63 char, [a-z0-9]) returning pubkeyHex + identifier"
  - "SitePointer interface extended with optional pubkeyHex field for named sites"
  - "Resolver skips bech32 decode for named sites by using pubkeyHex directly"
  - "Old double-wildcard format (blog.npub1xxx.nsite.run) silently returns null"

affects:
  - 11-spa-named-sites (SPA will see named site URLs routed through updated hostname parser)

tech-stack:
  added: []
  patterns:
    - "SitePointer carries pubkeyHex for named sites; resolver uses pointer.pubkeyHex || npubToHex(pointer.npub)"
    - "Named site label length bounds: NAMED_SITE_MIN_LENGTH=51, NAMED_SITE_MAX_LENGTH=63"
    - "parts.length === 3 check enforces single-label subdomain requirement"

key-files:
  created: []
  modified:
    - apps/gateway/src/hostname.ts
    - apps/gateway/src/hostname.test.ts
    - apps/gateway/src/resolver.ts

key-decisions:
  - "SitePointer.npub kept (not renamed) for backward compatibility — root sites still use npub field, named sites set npub to empty string and populate pubkeyHex"
  - "parts.length === 3 enforces single-label subdomain — 4+ parts (old double-wildcard format) fall through to null without special handling"
  - "base36Decode validation (regex + overflow guard) is fully handled in @nsite/shared — hostname parser only calls it and null-checks"

patterns-established:
  - "Named site detection: single-label check (parts.length === 3) + length bounds (51-63) + charset regex (/^[a-z0-9]+$/) + base36Decode"

requirements-completed: [GATE-13, GATE-14, GATE-15]

duration: 2min
completed: 2026-03-21
---

# Phase 10 Plan 02: Gateway Named Site Encoding Summary

**Gateway hostname parser rewritten to decode base36 single-label named sites, with resolver updated to use hex pubkey directly for named site requests**

## Performance

- **Duration:** 2 min
- **Started:** 2026-03-21T09:00:47Z
- **Completed:** 2026-03-21T09:02:37Z
- **Tasks:** 2
- **Files modified:** 3

## Accomplishments

- `extractNpubAndIdentifier` now parses `<pubkeyB36><dTag>.nsite.run` labels (51-63 chars, all `[a-z0-9]`) and returns `{ kind: "named", pubkeyHex: "...", identifier: "..." }`
- `SitePointer` interface extended with optional `pubkeyHex` field — named sites carry hex pubkey decoded from base36; root sites unchanged
- Old double-wildcard format (`blog.npub1xxx.nsite.run`) silently returns null (GATE-15)
- Resolver uses `pointer.pubkeyHex || npubToHex(pointer.npub)` — named site requests skip unnecessary bech32 decode
- 15 tests cover all cases: root sites, named sites, old format rejection, edge lengths, invalid chars

## Task Commits

Each task was committed atomically:

1. **Task 1: Update SitePointer and rewrite hostname parser** - `bbc626a` (feat)
2. **Task 2: Update resolver to use pubkeyHex from named site pointer** - `cf76c2d` (feat)

## Files Created/Modified

- `apps/gateway/src/hostname.ts` - Rewrote `extractNpubAndIdentifier` for base36 named sites; updated `SitePointer` interface
- `apps/gateway/src/hostname.test.ts` - Replaced all tests with 15 new tests covering new format
- `apps/gateway/src/resolver.ts` - One-line change: `pointer.pubkeyHex || npubToHex(pointer.npub)` fallback pattern

## Decisions Made

- `SitePointer.npub` kept as a field (not removed) — root sites still use it, named sites set it to `""` and populate `pubkeyHex`. This keeps the interface backward compatible without breaking root site handling.
- Single-label enforcement via `parts.length === 3` — simple and correct; 4-part hosts (old `blog.npub1.nsite.run` format) fall through to `null` naturally.
- Resolver change is purely additive — existing root-site code path unchanged, named site path now shorter (no bech32 decode).

## Deviations from Plan

None — plan executed exactly as written.

## Issues Encountered

None — implementation followed the algorithm specified in the plan verbatim. Tests passed on first run.

## User Setup Required

None — no external service configuration required.

## Next Phase Readiness

- Gateway hostname parser and resolver fully updated for base36 named site encoding
- Named site requests to `<pubkeyB36><dTag>.nsite.run` will now route correctly to kind 35128 manifests
- Ready for Phase 11 (SPA named sites): SPA will need to generate valid named site URLs using the same base36 codec

---
*Phase: 10-gateway-named-site-encoding*
*Completed: 2026-03-21*
