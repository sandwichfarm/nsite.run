---
phase: 01-monorepo-and-build-infrastructure
plan: 02
subsystem: infra
tags: [deno, esbuild, bundling, bunny-edge-scripting, esbuild-deno-loader, bundle-size]

# Dependency graph
requires:
  - phase: 01-01
    provides: "Deno workspace structure with app stubs and @nsite/shared package"
provides:
  - esbuild build script for apps/relay producing relay.bundle.js
  - esbuild build script for apps/blossom producing blossom.bundle.js
  - esbuild build script for apps/gateway producing gateway.bundle.js
  - scripts/check-bundle-sizes.ts enforcing 1MB hard limit and 750KB warning
  - Full build pipeline: deno task build produces 3 ESM bundles under 1KB
affects:
  - 01-03 (CI/CD workflow runs deno task build and scripts/check-bundle-sizes.ts)
  - All phases 2-5 (build pipeline established for feature development)

# Tech tracking
tech-stack:
  added:
    - "npm:esbuild@^0.27.3 (bundler, used in build scripts not deno.json deps)"
    - "jsr:@luca/esbuild-deno-loader@^0.11.1 (Deno specifier resolver for esbuild)"
  patterns:
    - "Per-app build.ts with absolute configPath via import.meta.url for workspace resolution"
    - "esbuild.stop() called after build to prevent Deno hang"
    - "Bunny runtime polyfill banner inlined in all bundles"
    - "Root deno.json build task uses --filter per app (not --recursive to avoid infinite loop)"

key-files:
  created:
    - "apps/relay/build.ts (esbuild script producing relay.bundle.js)"
    - "apps/blossom/build.ts (esbuild script producing blossom.bundle.js)"
    - "apps/gateway/build.ts (esbuild script producing gateway.bundle.js)"
    - "scripts/check-bundle-sizes.ts (CI bundle size enforcement: 1MB fail, 750KB warn)"
  modified:
    - "deno.json (root build task changed from --recursive to --filter per app)"

key-decisions:
  - "Root build task uses --filter '@nsite/relay' etc. instead of --recursive — deno task --recursive includes the root workspace itself, causing infinite recursion"
  - "denoPlugins configPath points to member-level deno.json (apps/relay/deno.json) — this resolves @nsite/shared workspace imports correctly via workspace scope lookup"
  - "Bunny runtime polyfill banner matches research recommendation: process, Buffer, global polyfills"

patterns-established:
  - "Pattern: Per-app build.ts — each app owns its esbuild config, root task orchestrates via --filter"
  - "Pattern: Absolute configPath — always new URL('./deno.json', import.meta.url).pathname in build scripts"
  - "Pattern: esbuild.stop() — mandatory at end of all build scripts to prevent Deno process hang"

requirements-completed: [INFRA-01, INFRA-02]

# Metrics
duration: 2min
completed: 2026-03-13
---

# Phase 01 Plan 02: esbuild Build Scripts and Bundle Size Enforcement Summary

**esbuild build scripts per app (relay, blossom, gateway) with denoPlugins workspace resolution, plus CI bundle size check script importing limits from @nsite/shared/constants**

## Performance

- **Duration:** 2 min
- **Started:** 2026-03-13T14:23:00Z
- **Completed:** 2026-03-13T14:25:30Z
- **Tasks:** 2 completed
- **Files modified:** 5 created, 1 modified

## Accomplishments

- Three esbuild build scripts (apps/relay/build.ts, apps/blossom/build.ts, apps/gateway/build.ts) producing minified ESM bundles with Bunny runtime polyfill banner
- @nsite/shared workspace imports correctly resolved via denoPlugins with absolute configPath pointing to member deno.json
- Bundle size enforcement script (scripts/check-bundle-sizes.ts) importing limits from @nsite/shared/constants, outputting JSON summary for CI
- deno fmt, lint, check, test all still passing after changes

## Task Commits

Each task was committed atomically:

1. **Task 1: Create esbuild build scripts for all three edge scripts** - `d986562` (feat)
2. **Task 2: Create bundle size enforcement script** - `42c0f70` (feat)

## Files Created/Modified

- `apps/relay/build.ts` - esbuild config: denoPlugins, ESM format, Bunny banner, node builtins external
- `apps/blossom/build.ts` - esbuild config: same pattern for blossom.bundle.js
- `apps/gateway/build.ts` - esbuild config: same pattern for gateway.bundle.js
- `scripts/check-bundle-sizes.ts` - OK/WARN/FAIL per bundle, JSON summary, exit 1 on FAIL
- `deno.json` - Root build task: --filter per app instead of --recursive

## Decisions Made

- Root `deno.json` build task changed from `deno task --recursive build` to `--filter` per app — `--recursive` includes the root workspace in the recursion, causing the root `build` task to call itself infinitely. Using `--filter '@nsite/relay' build && ...` targets only app members.
- `denoPlugins({ configPath: new URL("./deno.json", import.meta.url).pathname })` points at the member-level `deno.json` — this worked correctly; the esbuild-deno-loader plugin finds the workspace root via parent directory traversal and resolves `@nsite/shared` bare specifiers. Open Question 1 from research is resolved: member-level configPath is sufficient.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Fixed infinite recursion in root build task**
- **Found during:** Task 1 verification (`deno task build`)
- **Issue:** `deno task --recursive build` from workspace root includes the root itself, causing the root `build` task to invoke itself infinitely
- **Fix:** Changed root `deno.json` build task to `deno task --filter '@nsite/relay' build && deno task --filter '@nsite/blossom' build && deno task --filter '@nsite/gateway' build`
- **Files modified:** deno.json
- **Verification:** Build completes successfully producing all 3 bundles; no recursion
- **Committed in:** d986562 (Task 1 commit)

**2. [Rule 1 - Bug] Fixed deno fmt formatting of banner string**
- **Found during:** Post-Task-1 fmt check (`deno fmt --check`)
- **Issue:** `js: 'long-string...'` on one line exceeds lineWidth, deno fmt reformats as multi-line with key on its own line
- **Fix:** Applied deno fmt's preferred format: `js:\n      'string...',` (key on its own line, value indented)
- **Files modified:** apps/relay/build.ts, apps/blossom/build.ts, apps/gateway/build.ts
- **Verification:** `deno fmt --check` passes 19 files
- **Committed in:** d986562 (Task 1 commit, fix applied before commit)

---

**Total deviations:** 2 auto-fixed (2 x Rule 1 - Bug)
**Impact on plan:** Both fixes required for correct operation and lint compliance. No scope creep.

## Issues Encountered

- `deno task --recursive build` infinite recursion: root workspace includes itself when running recursive tasks. This is a known behavior — the `--recursive` flag targets all workspace members including the config file where it's invoked. Fix was straightforward: use `--filter` with explicit member names.
- Open Question 1 from research (member-level vs root-level configPath for workspace resolution) resolved in practice: member-level configPath works correctly. esbuild-deno-loader walks up to find the workspace root and merges import scopes automatically.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- Build pipeline complete: `deno task build` produces relay.bundle.js, blossom.bundle.js, gateway.bundle.js
- Bundle size enforcement ready for CI integration in Plan 03
- All three bundles are valid ESM with @nsite/shared constants inlined (not imported as modules)
- deno fmt, lint, check, test all passing — CI workflow baseline maintained

---
*Phase: 01-monorepo-and-build-infrastructure*
*Completed: 2026-03-13*
