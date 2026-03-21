---
phase: 10-gateway-named-site-encoding
plan: 01
subsystem: codec
tags: [base36, codec, shared, deno, bigint, pubkey, encoding]

requires: []
provides:
  - "base36Encode: 32-byte Uint8Array → 50-char lowercase base36 string (BigInt divmod)"
  - "base36Decode: 50-char base36 string → 32-byte Uint8Array or null on invalid input"
  - "Exported from @nsite/shared barrel and @nsite/shared/base36 direct import"
affects:
  - 10-02-PLAN (gateway hostname parser uses this codec)
  - 11-spa-named-sites (SPA will import @nsite/shared/base36)

tech-stack:
  added: []
  patterns:
    - "BigInt divmod loop for base36 encoding (no external library needed)"
    - "Left-zero-padding to fixed length using String.padStart"
    - "Regex validation before decode: /^[a-z0-9]{50}$/"
    - "TDD: test file written before implementation, all tests pass green"

key-files:
  created:
    - packages/shared/src/base36.ts
    - packages/shared/src/base36_test.ts
  modified:
    - packages/shared/src/mod.ts
    - packages/shared/deno.json

key-decisions:
  - "Hand-rolled BigInt implementation (~55 lines) — no external library needed for this math"
  - "Decode validates with regex /^[a-z0-9]{50}$/ before any math (fast fail for bad inputs)"
  - "MAX_VALUE guard (2^256 - 1) prevents accepting base36 strings that numerically overflow 32 bytes"

patterns-established:
  - "base36 codec pattern: BigInt divmod for encode, BigInt accumulation for decode"
  - "Test naming: describe behavior in the test name, cover encode/decode/roundtrip/null-returns"

requirements-completed: [GATE-13]

duration: 2min
completed: 2026-03-21
---

# Phase 10 Plan 01: Base36 Codec Summary

**Hand-rolled BigInt base36 codec converting 32-byte pubkeys to 50-char lowercase strings, with roundtrip guarantee and null-returning decode for all invalid inputs**

## Performance

- **Duration:** 2 min
- **Started:** 2026-03-21T08:57:17Z
- **Completed:** 2026-03-21T08:59:29Z
- **Tasks:** 2 (Task 1 TDD + Task 2 wiring)
- **Files modified:** 4

## Accomplishments

- `base36Encode` converts any 32-byte Uint8Array to exactly 50-char lowercase base36 string, zero-padded left
- `base36Decode` converts 50-char lowercase base36 string back to 32-byte Uint8Array; returns null for wrong length, uppercase, invalid chars, or numeric overflow
- Roundtrip lossless for all inputs including all-zeros, all-0xff, and arbitrary byte sequences
- 12 tests covering encode, decode, roundtrip, null-return edge cases — all passing
- Exported from both `@nsite/shared` barrel and `@nsite/shared/base36` direct import path

## Task Commits

Each task was committed atomically:

1. **Task 1 RED: Add failing tests** - `15eabf3` (test)
2. **Task 1 GREEN: Implement base36 codec** - `d6520d8` (feat)
3. **Task 2: Wire base36 into shared exports** - `3de69e1` (feat)

_Note: TDD tasks have multiple commits (test RED → feat GREEN)_

## Files Created/Modified

- `packages/shared/src/base36.ts` - base36Encode and base36Decode functions using BigInt
- `packages/shared/src/base36_test.ts` - 12 Deno tests covering all behaviors
- `packages/shared/src/mod.ts` - Added `export * from "./base36.ts"` to barrel
- `packages/shared/deno.json` - Added `"./base36": "./src/base36.ts"` to exports map

## Decisions Made

- BigInt divmod loop chosen for encode (standard approach, no dependencies, exact arithmetic)
- Regex `/^[a-z0-9]{50}$/` used as the first decode check — fast-fails before any math
- Overflow guard: if decoded BigInt exceeds `(1n << 256n) - 1n`, return null (theoretically unreachable for valid 50-char base36 strings, but safe by construction)

## Deviations from Plan

None — plan executed exactly as written.

## Issues Encountered

None — implementation followed the algorithm specified in the plan verbatim.

## User Setup Required

None — no external service configuration required.

## Next Phase Readiness

- `base36Encode` / `base36Decode` ready for immediate use in gateway hostname parser (Plan 02)
- Both import paths verified: `@nsite/shared` barrel and `@nsite/shared/base36` direct
- No blockers for Plan 02

---
*Phase: 10-gateway-named-site-encoding*
*Completed: 2026-03-21*
