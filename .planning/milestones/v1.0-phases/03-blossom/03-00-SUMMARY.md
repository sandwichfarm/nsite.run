---
phase: 03-blossom
plan: "00"
subsystem: blossom/tests
tags: [tdd, wave-0, test-stubs, blossom, nostr, storage]
dependency_graph:
  requires: []
  provides:
    - "Test behavioral contracts for all BLSM requirements"
    - "apps/blossom/src/auth/nostr.test.ts"
    - "apps/blossom/src/storage/client.test.ts"
    - "apps/blossom/src/handlers/blob-get.test.ts"
    - "apps/blossom/src/handlers/blob-upload.test.ts"
    - "apps/blossom/src/handlers/blob-list.test.ts"
    - "apps/blossom/src/handlers/blob-delete.test.ts"
    - "apps/blossom/src/handlers/server-info.test.ts"
  affects:
    - "Plans 03-01 and 03-02 use these test stubs to verify implementation via deno test"
tech_stack:
  added:
    - "@nostr/tools/pure: added to apps/blossom/deno.json imports (jsr:@nostr/tools@^2.23.3/pure)"
    - "@std/toml: added to apps/blossom/deno.json imports (jsr:@std/toml@^1.0.0)"
  patterns:
    - "Deno.test() with duck-typed StorageClient mock (makeStorage() factory)"
    - "Real schnorr signing via generateSecretKey+finalizeEvent for auth tests"
    - "globalThis.fetch stub pattern for StorageClient integration tests"
    - "testConfig fixture shared across all handler test files"
key_files:
  created:
    - apps/blossom/src/auth/nostr.test.ts
    - apps/blossom/src/storage/client.test.ts
    - apps/blossom/src/handlers/blob-get.test.ts
    - apps/blossom/src/handlers/blob-upload.test.ts
    - apps/blossom/src/handlers/blob-list.test.ts
    - apps/blossom/src/handlers/blob-delete.test.ts
    - apps/blossom/src/handlers/server-info.test.ts
  modified:
    - apps/blossom/deno.json
decisions:
  - "@nostr/tools/pure and @std/toml added to apps/blossom/deno.json as required by RESEARCH.md pitfall analysis"
  - "Auth tests use real generateSecretKey+finalizeEvent from @nostr/tools/pure for full signature coverage on happy-path tests"
  - "Dummy tampered events used for negative-path auth tests (avoids hardcoded private keys)"
  - "blob-upload and blob-delete tests accept either 400/413 or 400/403 response codes where handler implementation details are still TBD"
metrics:
  duration_minutes: 4
  completed_date: "2026-03-13"
  tasks_completed: 2
  files_created: 7
  files_modified: 1
---

# Phase 3 Plan 0: Wave 0 Test Stubs Summary

**One-liner:** 7 Deno.test stub files covering all BLSM requirements using real nostr-tools signing and duck-typed StorageClient mocks.

## What Was Built

Wave 0 test stubs for the blossom server port. All 7 test files define behavioral contracts that production modules (Plans 03-01 and 03-02) must satisfy. Tests import from production module paths that don't exist yet — expected to fail at import resolution until production code is written.

### Test Coverage by BLSM Requirement

| Requirement | Test File | Tests |
|-------------|-----------|-------|
| BLSM-01 (GET /{sha256}) | blob-get.test.ts | 404 missing, 200 existing blob |
| BLSM-02 (PUT /upload auth) | blob-upload.test.ts | 401 no auth, 400 empty body, 400 hash mismatch, 200 valid upload |
| BLSM-03 (GET /list/{pubkey}) | blob-list.test.ts | empty array, array of descriptors, since/until filtering |
| BLSM-04 (DELETE with auth) | blob-delete.test.ts | 401 no auth, 403 not owner, 200 removes ownership, storage.delete on last owner |
| BLSM-05 (no manifest check) | blob-upload.test.ts | upload succeeds without manifest query |
| BLSM-06 (StorageClient) | client.test.ts | PUT 201/500, GET 200/404, HEAD 200/404, blobPath/blobUrl |
| BLSM-07 (SHA-256 integrity) | blob-upload.test.ts | 400 hash mismatch |
| BLSM-08 (HEAD /{sha256}) | blob-get.test.ts | HEAD 200 existing, HEAD 404 missing |

### Auth Test Coverage (nostr.test.ts — 9 tests)

- Missing Authorization header → unauthorized
- Wrong kind (not 24242) → unauthorized
- Expired created_at (5 min ago, outside 120s window) → unauthorized
- Within 120s window with valid signature → authorized + pubkey returned
- Missing t tag → unauthorized
- t tag verb mismatch → unauthorized
- Missing x tag on upload verb → unauthorized (LOCKED decision: x tag required)
- x tag hash mismatch → unauthorized
- Valid event with matching x tag → authorized + pubkey returned

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Added @nostr/tools/pure to apps/blossom/deno.json**
- **Found during:** Task 1 verification
- **Issue:** `deno check` reported `Import "@nostr/tools/pure" not a dependency and not in import map` — the nostr.test.ts import would have been unresolvable even for other tooling
- **Fix:** Added `@nostr/tools/pure` and `@std/toml` to `apps/blossom/deno.json` imports per RESEARCH.md recommendation (both were specified as required in the Standard Stack and Pitfall 3 sections)
- **Files modified:** apps/blossom/deno.json
- **Commit:** d08d141

## Self-Check: PASSED

All 7 test stub files exist on disk. Both task commits (d08d141, 97a1f73) confirmed in git history.
