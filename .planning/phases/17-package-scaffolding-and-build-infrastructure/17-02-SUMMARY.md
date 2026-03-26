---
phase: 17-package-scaffolding-and-build-infrastructure
plan: 02
subsystem: infra
tags: [vite, svelte, iife, esm, widget, publint, npm-workspaces]

# Dependency graph
requires:
  - phase: 17-01
    provides: packages/deployer scaffold with package.json exports map and placeholder src files
provides:
  - Vite lib mode config (vite.widget.config.js) producing IIFE+ESM widget bundles
  - dist/deployer.js (IIFE bundle with NsiteDeployer global)
  - dist/deployer.mjs (ESM bundle)
  - publint zero-error validation on exports map
  - SPA builds successfully with workspace-resolved @nsite/deployer
affects: [18-lib-extraction, 19-svelte-components, 20-web-component-wrapper]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Vite lib mode with IIFE+ESM dual format using formats: ['iife', 'es']"
    - "Svelte plugin with css: 'injected' for self-contained widget bundles"
    - "inlineDynamicImports: true prevents chunk splitting in IIFE bundles"
    - "cssCodeSplit: false ensures all CSS is bundled into JS (no separate .css file)"
    - "No external array in IIFE config — bundle must be fully self-contained"

key-files:
  created:
    - packages/deployer/vite.widget.config.js
  modified: []

key-decisions:
  - "dist/ files are gitignored (standard build artifact convention) — publint validates at runtime, not via git tracking"
  - "NsiteDeployer as IIFE global name — distinct from stealthis pattern"
  - "Widget config targets src/widget/index.js (placeholder) — Phase 20 adds HTMLElement wrapper"

patterns-established:
  - "Widget build: cd packages/deployer && npx vite build --config vite.widget.config.js"
  - "Validation: cd packages/deployer && npx publint . (run after build:widget)"
  - "SPA resolution check: node -e require('@nsite/deployer') resolves to packages/deployer via workspace symlink"

requirements-completed: [INFRA-03, INFRA-04]

# Metrics
duration: 5min
completed: 2026-03-25
---

# Phase 17 Plan 02: Vite widget build config with dual IIFE+ESM output and publint-validated exports map

**Vite lib mode config (vite.widget.config.js) builds deployer.js (IIFE/NsiteDeployer) and deployer.mjs (ESM) from placeholder widget entry; publint reports zero errors on the exports map; SPA builds cleanly through workspace resolution.**

## Performance

- **Duration:** ~5 min
- **Started:** 2026-03-25T20:53:26Z
- **Completed:** 2026-03-25T20:58:00Z
- **Tasks:** 2 (of 3 — Task 3 is human-verify checkpoint)
- **Files modified:** 1

## Accomplishments
- Created `packages/deployer/vite.widget.config.js` with Svelte plugin, IIFE+ESM formats, NsiteDeployer global name, cssCodeSplit:false, inlineDynamicImports:true
- Build produces non-empty `dist/deployer.js` (IIFE with NsiteDeployer) and `dist/deployer.mjs` (ESM export)
- `npx publint .` in packages/deployer reports zero errors — exports map is valid
- SPA builds successfully (517 modules, 2.1s) confirming workspace resolution works end-to-end

## Task Commits

Each task was committed atomically:

1. **Task 1: Create Vite widget config and build IIFE+ESM artifacts** - `0f6823b` (feat)
2. **Task 2: Validate exports with publint and verify SPA resolution** - validation only, no files changed

**Plan metadata:** (docs commit below)

## Files Created/Modified
- `packages/deployer/vite.widget.config.js` - Vite lib mode config for dual IIFE+ESM widget bundle with Svelte inlined

## Decisions Made
- dist/ build artifacts are gitignored per root .gitignore (standard convention); publint validates at runtime after build
- No changes needed to package.json or any other files — the Plan 01 scaffold was correct as-is

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None - build succeeded on first run, publint zero errors, SPA builds clean.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

Phase 17 infrastructure is fully proven:
- npm workspaces wiring: root package.json → apps/spa + packages/deployer symlinked
- Dual IIFE+ESM build: `npm run build:widget` in packages/deployer works
- Exports map validated by publint (zero errors)
- SPA workspace resolution confirmed
- Ready for Phase 18 lib extraction (moving nostr/upload/publish/crypto/files code to packages/deployer)

Awaiting human verification (Task 3 checkpoint) before Phase 18 can begin.

## Known Stubs

- `packages/deployer/src/widget/index.js` — placeholder (exports VERSION only); Phase 20 provides the HTMLElement wrapper
- `packages/deployer/src/index.js` — placeholder (empty export); Phase 18 moves lib files here, Phase 19 adds Svelte components
- `dist/deployer.js` and `dist/deployer.mjs` — built from placeholder entry; real content comes after Phase 18-20

These stubs are intentional per the plan — Phase 17 validates infrastructure with placeholders before real code moves in Phase 18+.

---
*Phase: 17-package-scaffolding-and-build-infrastructure*
*Completed: 2026-03-25*
