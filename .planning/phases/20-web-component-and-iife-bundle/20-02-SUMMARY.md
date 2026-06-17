---
phase: 20-web-component-and-iife-bundle
plan: 02
subsystem: ui
tags: [web-component, iife, esm, vite, custom-element, test]

requires:
  - phase: 20-web-component-and-iife-bundle
    provides: NsiteDeployerElement HTMLElement class (plan 01)
  - phase: 17-package-scaffolding-and-build-infrastructure
    provides: Vite widget build config and package.json scripts
provides:
  - Custom element registration entry point (widget/index.js)
  - IIFE bundle at dist/deployer.js (418KB)
  - ESM bundle at dist/deployer.mjs (630KB)
  - Standalone test HTML page
affects: []

tech-stack:
  added: []
  patterns: [custom-element-registration-guard, iife-self-contained-bundle]

key-files:
  created:
    - packages/deployer/test/test-widget.html
  modified:
    - packages/deployer/src/widget/index.js

key-decisions:
  - "No auto-inject: consumer explicitly places <nsite-deployer> (unlike stealthis which auto-injects)"
  - "Double-registration guard via customElements.get() for safe multi-load"
  - "IIFE bundle is fully self-contained at 418KB including Svelte runtime"

patterns-established:
  - "Registration guard: always check customElements.get before define to avoid double-registration errors"

requirements-completed: [WIDGET-01, WIDGET-02, WIDGET-03, WIDGET-04, WIDGET-05, WIDGET-06]

duration: 8min
completed: 2026-03-25
---

# Phase 20, Plan 02: Entry Point, Build, and Test Page Summary

**Custom element registration with IIFE+ESM build (418KB/630KB) and standalone test page validating all 5 success criteria**

## Performance

- **Duration:** 8 min
- **Tasks:** 4
- **Files modified:** 2

## Accomplishments
- Widget entry point registers nsite-deployer custom element with double-registration guard
- IIFE bundle (deployer.js, 418KB) is self-contained — works with single script tag, no npm needed
- ESM bundle (deployer.mjs, 630KB) exports NsiteDeployerElement for module consumers
- Test HTML page validates: default button, custom label, custom styling, programmatic properties, event logging
- All 5 success criteria verified against built bundle contents

## Task Commits

1. **Task 1: Replace widget entry point** - `7e7bcdc` (feat)
2. **Task 2: Build and verify** - (build outputs are gitignored, verification passed)
3. **Task 3: Create test HTML page** - `62011eb` (test)
4. **Task 4: Verify success criteria** - (verification only, no code changes)

## Files Created/Modified
- `packages/deployer/src/widget/index.js` - Custom element registration with guard and ESM exports
- `packages/deployer/test/test-widget.html` - Standalone test page for all 5 success criteria

## Decisions Made
- No auto-inject pattern (consumer must place element explicitly)
- Build produces both IIFE and ESM formats as configured in Phase 17
- Test page uses relative path to dist/ for zero-setup validation

## Deviations from Plan
None - plan executed exactly as written.

## Issues Encountered
- Vite produces a separate style.css alongside IIFE/ESM bundles, but Svelte's css:'injected' ensures styles are also embedded in the JS bundles, so the separate CSS is unnecessary for single-script-tag usage

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Web component fully functional: single script tag loads, button renders, modal opens, events propagate
- Package ready for npm publish or CDN distribution
- All WIDGET requirements satisfied

---
*Phase: 20-web-component-and-iife-bundle*
*Completed: 2026-03-25*
