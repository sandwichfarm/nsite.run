---
phase: 14-delete-animation
plan: 01
subsystem: ui
tags: [svelte, state-machine, map, per-card, delete]

requires:
  - phase: none
    provides: none
provides:
  - Per-card deletingCards Map replacing global deleteState
  - Success vs failure distinction based on relay acceptance
  - Inline confirm/progress/failure overlays on individual cards
  - Auto-recovery of failed cards after 4s timeout
affects: [14-02, 15-post-action-navigation]

tech-stack:
  added: []
  patterns: [per-card-state-map, svelte-map-reactivity-reassign]

key-files:
  created: []
  modified:
    - apps/spa/src/components/ManageSite.svelte

key-decisions:
  - "Svelte 4 Map reactivity via full reassign (deletingCards = new Map(deletingCards)) on every mutation"
  - "Success = any relay accepted; failure = all relays rejected"
  - "Failed cards auto-recover to normal state after 4000ms timeout"
  - "dispatch delete-start/delete-end events for Phase 13 beforeunload integration"

patterns-established:
  - "Per-card state Map pattern: updateCard(id, updates) + removeCard(id) with Map reassign for Svelte reactivity"
  - "Inline card overlays: card list always renders, each card checks deletingCards.get(site.id) for overlay state"

requirements-completed: [DELT-01, DELT-03, DELT-04]

duration: 5min
completed: 2026-03-25
---

# Plan 14-01: Per-card delete state machine and success/failure distinction

**Per-card deletingCards Map with inline confirm/progress/failure overlays and relay-based success/failure distinction**

## Performance

- **Duration:** 5 min
- **Started:** 2026-03-25T13:06:00Z
- **Completed:** 2026-03-25T13:11:00Z
- **Tasks:** 5
- **Files modified:** 1

## Accomplishments
- Replaced global deleteState/deletingSite with per-card deletingCards Map supporting concurrent deletes
- Fixed success/failure conflation: success requires at least one relay acceptance, failure means all rejected
- Card list always renders with inline overlays for confirm, progress, failure states
- Deleting cards are dimmed (opacity-60) and non-interactive (disabled button)
- Failed cards show inline error text and auto-recover after 4s timeout
- Removed handleBackToDeploy function (no longer needed with inline card model)

## Task Commits

All tasks were committed atomically in a single commit:

1. **Task 1-5: Full per-card state refactor** - `178fd8a` (feat)

**Plan metadata:** included in task commit

## Files Created/Modified
- `apps/spa/src/components/ManageSite.svelte` - Replaced global delete state machine with per-card Map, restructured template from full-view swaps to inline card overlays

## Decisions Made
- Svelte 4 Map reactivity via full reassign pattern (deletingCards = new Map(deletingCards))
- Success determined by relayResults.some(r => r.success) rather than generic "done"
- dispatch('delete-start') and dispatch('delete-end') events added for Phase 13 beforeunload guard integration
- Shake animation CSS uses :global() selector for Svelte 4 compatibility

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Fixed {@const} placement for Svelte 4 compatibility**
- **Found during:** Task 3 (Template restructure)
- **Issue:** {@const stepStates = getStepStates(cardState.step)} placed inside a <div> fails Svelte 4 validation -- must be immediate child of {#if} block
- **Fix:** Moved {@const} to be direct child of the {#if cardState?.phase === 'deleting'} block, before the <div>
- **Files modified:** apps/spa/src/components/ManageSite.svelte
- **Verification:** vite build compiles ManageSite.svelte without errors
- **Committed in:** 178fd8a

---

**Total deviations:** 1 auto-fixed (1 blocking)
**Impact on plan:** Necessary fix for Svelte 4 template validation. No scope creep.

## Issues Encountered
None beyond the auto-fixed Svelte {@const} placement issue.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Per-card state Map is ready for Plan 14-02 to add exit animation classes and timed phase transitions
- The success phase on cards is set but no visual exit animation yet -- Plan 02 adds fade + collapse

---
*Phase: 14-delete-animation*
*Completed: 2026-03-25*
