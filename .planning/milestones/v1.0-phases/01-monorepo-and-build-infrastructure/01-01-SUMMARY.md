---
phase: 01-monorepo-and-build-infrastructure
plan: 01
subsystem: infra
tags: [deno, workspace, monorepo, typescript, web-crypto, nostr]

# Dependency graph
requires: []
provides:
  - Deno workspace root with 4 members (relay, blossom, gateway, shared)
  - "@nsite/shared" package with NostrEvent, NostrFilter, NsiteKind, ValidationResult types
  - ALLOWED_KINDS constant [15128, 35128, 10002, 10063]
  - sha256Hex() utility using Web Crypto API
  - isAllowedKind() and validateEventKind() validation utilities
  - App stubs for relay, blossom, gateway that import from @nsite/shared
  - Test suite with 14 passing tests for sha256 and validation
affects:
  - 01-02 (esbuild build scripts use workspace structure and app stubs)
  - 01-03 (CI/CD pipeline builds on fmt/lint/check/test commands defined here)
  - All subsequent phases (shared types and utilities are the foundation)

# Tech tracking
tech-stack:
  added:
    - "Deno workspace (native, no extra tooling)"
    - "@std/assert@^1.0.19 (JSR, test assertions)"
    - "Web Crypto API (crypto.subtle.digest, built-in)"
  patterns:
    - "Workspace bare specifier imports (@nsite/shared/constants)"
    - "Per-member deno.json with name and exports fields"
    - "Root deno.json imports map for shared test dependencies"
    - "TDD: test files committed before implementation"
    - "Web Crypto over node:crypto for edge compatibility"

key-files:
  created:
    - "deno.json (workspace root with tasks, fmt, lint, imports)"
    - "deno.lock (workspace-wide lockfile)"
    - ".gitignore (dist/, node_modules/, .env, *.bundle.js)"
    - "packages/shared/deno.json (@nsite/shared with 5 export paths)"
    - "packages/shared/src/types.ts (NostrEvent, NostrFilter, NsiteKind, ValidationResult)"
    - "packages/shared/src/constants.ts (ALLOWED_KINDS, BUNDLE_SIZE_LIMIT, BUNDLE_SIZE_WARN)"
    - "packages/shared/src/sha256.ts (sha256Hex via Web Crypto)"
    - "packages/shared/src/validation.ts (isAllowedKind, validateEventKind)"
    - "packages/shared/src/mod.ts (barrel export)"
    - "packages/shared/src/sha256_test.ts (3 tests)"
    - "packages/shared/src/validation_test.ts (11 tests)"
    - "apps/relay/deno.json, apps/relay/src/main.ts"
    - "apps/blossom/deno.json, apps/blossom/src/main.ts"
    - "apps/gateway/deno.json, apps/gateway/src/main.ts"
  modified: []

key-decisions:
  - "Added .planning/ and .git/ excludes to fmt and lint config to prevent deno fmt from reformatting markdown planning files"
  - "Stub fetch handlers use synchronous return (fetch(): Response) not async — avoids require-await lint error since stubs have no await expressions"
  - "Used @std/assert bare specifier via root deno.json imports map (not jsr: inline) — satisfies no-unversioned-import lint rule while centralizing version"
  - "sha256Hex copies data via new Uint8Array(data).buffer to get plain ArrayBuffer — satisfies SubtleCrypto BufferSource constraint in TypeScript 5.9"

patterns-established:
  - "Pattern: Workspace imports — use @nsite/shared/constants not relative paths across members"
  - "Pattern: Lint-clean stubs — synchronous fetch handlers for stubs, async only when await is used"
  - "Pattern: Centralized deps — shared dev dependencies (test assertions) in root deno.json imports"
  - "Pattern: TDD red-green — write failing tests first, commit, then implement, commit"

requirements-completed: [INFRA-01, INFRA-03]

# Metrics
duration: 4min
completed: 2026-03-13
---

# Phase 01 Plan 01: Monorepo Scaffold and Shared Package Summary

**Deno workspace with 4 members, @nsite/shared types/sha256/validation package, and 3 app stubs — deno fmt, lint, check, test all passing from root**

## Performance

- **Duration:** 4 min
- **Started:** 2026-03-13T14:15:16Z
- **Completed:** 2026-03-13T14:19:38Z
- **Tasks:** 2 completed
- **Files modified:** 16 created, 0 modified

## Accomplishments

- Deno workspace root with 4 members, shared tasks, fmt/lint config with .planning/ exclusions
- @nsite/shared package exporting NostrEvent, NostrFilter, NsiteKind, ALLOWED_KINDS, sha256Hex, isAllowedKind, validateEventKind via barrel and individual sub-path exports
- 3 app stubs (relay, blossom, gateway) importing from @nsite/shared/constants and exporting fetch handlers
- 14 passing tests (3 sha256 + 11 validation) using TDD red-green cycle

## Task Commits

Each task was committed atomically:

1. **Task 1: Create monorepo workspace structure and app stubs** - `b7ee650` (feat)
2. **Task 2 (RED): Add failing tests for sha256 and validation** - `738ed64` (test)
3. **Task 2 (GREEN): Implement shared package types, utilities, and tests** - `716acb8` (feat)

_Note: TDD task 2 had two commits: test (RED) and feat (GREEN). No refactor needed._

## Files Created/Modified

- `deno.json` - Workspace root: 4 members, build/test/check tasks, fmt/lint with .planning/ exclude, @std/assert import
- `deno.lock` - Workspace-wide lockfile
- `.gitignore` - dist/, node_modules/, .env, .env.*, *.bundle.js
- `packages/shared/deno.json` - @nsite/shared with 5 export paths (., ./types, ./sha256, ./validation, ./constants)
- `packages/shared/src/types.ts` - NostrEvent, NostrFilter, NsiteKind const, ValidationResult type
- `packages/shared/src/constants.ts` - ALLOWED_KINDS readonly array, BUNDLE_SIZE_LIMIT, BUNDLE_SIZE_WARN
- `packages/shared/src/sha256.ts` - sha256Hex() using Web Crypto API, BufferSource-safe
- `packages/shared/src/validation.ts` - isAllowedKind(), validateEventKind()
- `packages/shared/src/mod.ts` - Barrel re-export of all 4 submodules
- `packages/shared/src/sha256_test.ts` - 3 tests: known hash for "hello", empty input, hex format
- `packages/shared/src/validation_test.ts` - 11 tests: 4 allowed kinds, 3 disallowed, validateEventKind valid/invalid
- `apps/relay/deno.json` - @nsite/relay, build task
- `apps/relay/src/main.ts` - Stub importing ALLOWED_KINDS, synchronous fetch handler
- `apps/blossom/deno.json` - @nsite/blossom, build task
- `apps/blossom/src/main.ts` - Stub importing ALLOWED_KINDS, synchronous fetch handler
- `apps/gateway/deno.json` - @nsite/gateway, build task
- `apps/gateway/src/main.ts` - Stub importing ALLOWED_KINDS, synchronous fetch handler

## Decisions Made

- Added `.planning/` and `.git/` to fmt/lint exclude lists — deno fmt's default scope includes all files in the workspace, including planning markdown, causing spurious failures on trailing spaces in long-line-wrapped markdown
- Stub fetch handlers are synchronous (`fetch(): Response`) — using `async` without any `await` triggers the `require-await` lint rule from the `recommended` tag set
- Used bare specifier `@std/assert` mapped in root `deno.json` imports rather than inline `jsr:@std/assert` — the `no-unversioned-import` lint rule rejects unversioned JSR specifiers; central mapping satisfies the rule and pins the version once
- `sha256Hex` copies input via `new Uint8Array(data).buffer` — TypeScript 5.9 tightened `SubtleCrypto.digest()` to require `ArrayBuffer` (not `ArrayBufferLike`); a copy ensures correctness on views over SharedArrayBuffer too

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Added .planning/ exclude to fmt/lint config**
- **Found during:** Task 1 verification (deno fmt --check)
- **Issue:** deno fmt reformatted planning markdown files — trailing space differences, line-wrap differences
- **Fix:** Added `"exclude": [".planning/", ".git/"]` to both fmt and lint sections in root deno.json
- **Files modified:** deno.json
- **Verification:** deno fmt --check passes without touching .planning/ files
- **Committed in:** b7ee650 (Task 1 commit)

**2. [Rule 1 - Bug] Changed stub fetch handlers from async to synchronous**
- **Found during:** Task 1 verification (deno lint)
- **Issue:** `async fetch()` without any `await` triggers `require-await` from recommended lint rules
- **Fix:** Removed `async` keyword and changed return type from `Promise<Response>` to `Response`
- **Files modified:** apps/relay/src/main.ts, apps/blossom/src/main.ts, apps/gateway/src/main.ts
- **Verification:** deno lint passes with 0 errors
- **Committed in:** b7ee650 (Task 1 commit)

**3. [Rule 1 - Bug] Fixed no-unversioned-import lint error for @std/assert**
- **Found during:** Task 2 GREEN verification (deno lint)
- **Issue:** `jsr:@std/assert` without version triggers `no-unversioned-import` lint rule
- **Fix:** Added `"@std/assert": "jsr:@std/assert@^1.0.19"` to root deno.json imports map; updated test files to use bare `@std/assert`
- **Files modified:** deno.json, packages/shared/src/sha256_test.ts, packages/shared/src/validation_test.ts
- **Verification:** deno lint passes, deno test still passes with 14/14 tests
- **Committed in:** 716acb8 (Task 2 GREEN commit)

**4. [Rule 1 - Bug] Fixed SubtleCrypto BufferSource type incompatibility**
- **Found during:** Task 2 GREEN phase (deno test type check)
- **Issue:** `crypto.subtle.digest("SHA-256", data)` where data is `Uint8Array<ArrayBufferLike>` fails TypeScript 5.9 — `ArrayBufferLike` includes `SharedArrayBuffer` which is not `BufferSource`
- **Fix:** Copy input via `new Uint8Array(data).buffer` to produce a plain `ArrayBuffer`
- **Files modified:** packages/shared/src/sha256.ts
- **Verification:** deno test type checks cleanly, all 3 sha256 tests pass with correct hashes
- **Committed in:** 716acb8 (Task 2 GREEN commit)

---

**Total deviations:** 4 auto-fixed (4 x Rule 1 - Bug)
**Impact on plan:** All fixes required for lint compliance and type correctness. No scope creep. Plan structure and intent unchanged.

## Issues Encountered

TypeScript 5.9 tightened SubtleCrypto's type signature for `digest()` — the `Uint8Array<ArrayBufferLike>` generic type no longer satisfies `BufferSource`. Required 3 attempts to find the right fix:
1. `as ArrayBuffer` cast — rejected (insufficient overlap)
2. `.buffer.slice(...)` — returned `ArrayBuffer | SharedArrayBuffer` (still fails)
3. `new Uint8Array(data).buffer` — correct (creates new ArrayBuffer, satisfies constraint)

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- Workspace structure ready for Plan 02 (esbuild build scripts per app)
- App stubs have build task defined pointing to `build.ts` (to be created in Plan 02)
- All shared utilities available for relay, blossom, gateway implementation in Phases 2-5
- deno fmt, lint, check, test all passing — CI workflow baseline established

---
*Phase: 01-monorepo-and-build-infrastructure*
*Completed: 2026-03-13*

## Self-Check: PASSED

All 17 created files verified present on disk. All 3 task commits (b7ee650, 738ed64, 716acb8) verified in git log.
