---
phase: 19-svelte-component
plan: 02
subsystem: ui
tags: [svelte, deployer-widget, event-dispatch, signer-prop, css-custom-properties]

requires:
  - phase: 19-svelte-component
    provides: 11 sub-components in packages/deployer/src/components/
provides:
  - DeployerWidget.svelte self-contained orchestrator
  - signer prop for external signer injection
  - 6 typed event dispatches (deploy-success, deploy-error, auth-change, operation-start, operation-end, site-deleted)
  - CSS custom properties API (--deployer-accent, --deployer-bg, --deployer-text, --deployer-radius)
affects: [19-svelte-component, 20-web-component]

tech-stack:
  added: []
  patterns: [svelte-setContext, event-dispatch, css-custom-properties]

key-files:
  created:
    - packages/deployer/src/components/DeployerWidget.svelte
  modified: []

key-decisions:
  - "Optional signer prop: null shows built-in auth, non-null skips LoginModal"
  - "CSS custom properties use double-layer vars (--deployer-X -> --_X) for scoping"
  - "Deploy button uses var(--_accent) to demonstrate theming API"
  - "NSITE_GATEWAY_PROTOCOL used for URL construction instead of hardcoded https"

patterns-established:
  - "Signer prop pattern: null = built-in auth, object = external signer"
  - "CSS theming: public --deployer-X vars with private --_X internal aliases"

requirements-completed: [COMP-01, COMP-02, COMP-03]

duration: 5min
completed: 2026-03-25
---

# Phase 19 Plan 02: Create DeployerWidget.svelte orchestrator with signer prop and event dispatch

**Self-contained DeployerWidget.svelte with complete deploy+manage+update flow, optional signer prop, 6 typed events, and CSS custom property theming**

## Performance

- **Duration:** 5 min
- **Tasks:** 1
- **Files modified:** 1 (1,157 lines)

## Accomplishments
- Created DeployerWidget.svelte (1,157 lines) with full deploy orchestration
- setContext('deployer-stores') provides stores to all child components
- Optional signer prop controls whether built-in auth is shown
- 6 typed event dispatches at correct points in deploy/manage flow
- beforeunload guard and onDestroy cleanup
- CSS custom properties defined on .deployer-widget root with fallback defaults
- Deploy button demonstrates theming with var(--_accent)

## Task Commits

1. **Task 19.2.1: Create DeployerWidget.svelte** - `1e85297` (feat)

## Files Created/Modified
- `packages/deployer/src/components/DeployerWidget.svelte` - Complete deploy orchestrator

## Decisions Made
- Used NSITE_GATEWAY_PROTOCOL from nostr.js for URL construction (handles http/https correctly for dev)
- Renamed `signer` variable to `extSigner`/`anonSigner` in handleDeploy to avoid shadowing the prop
- resetDeploy resets currentSigner to prop value (signer) rather than null

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
None

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- DeployerWidget ready for App.svelte integration (Plan 03)
- All 6 event types wired for consumer use

---
*Phase: 19-svelte-component*
*Completed: 2026-03-25*
