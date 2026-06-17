---
phase: 14-delete-animation
plan: 02
subsystem: ui
tags: [svelte, css-animation, fade, collapse, optimistic-update]

requires:
  - phase: 14-delete-animation
    provides: Per-card deletingCards Map with success/failure phases
provides:
  - Two-phase CSS exit animation (fade opacity + collapse height)
  - Optimistic site removal via site-removed event in App.svelte
  - Green success indicator before fade begins
  - Concurrent delete support via activeDeleteCount
affects: [13-leave-confirmation, 15-post-action-navigation]

tech-stack:
  added: []
  patterns: [css-two-phase-animation, optimistic-removal, boundary-event-counting]

key-files:
  created: []
  modified:
    - apps/spa/src/components/ManageSite.svelte
    - apps/spa/src/App.svelte

key-decisions:
  - "CSS-only animation (card-exit-fade + card-exit-collapse) instead of Svelte transitions to avoid Svelte 4 bug #4910"
  - "600ms fade then 300ms collapse timing for smooth visual sequence"
  - "activeDeleteCount boundary pattern: delete-start fires on 0->1, delete-end fires on 1->0"
  - "site-removed event carries site object for optimistic allSites filtering in App.svelte"

patterns-established:
  - "Two-phase CSS exit: fade class applied immediately, _collapsing flag set after delay, removal after collapse"
  - "Boundary event counting: increment/decrement counter, dispatch at 0<->1 boundaries only"

requirements-completed: [DELT-02, DELT-04]

duration: 5min
completed: 2026-03-25
---

# Plan 14-02: Card exit animation, smooth reflow, and App.svelte integration

**Two-phase CSS exit animation (fade+collapse) with optimistic App.svelte removal and concurrent delete boundary events**

## Performance

- **Duration:** 5 min
- **Started:** 2026-03-25T13:12:00Z
- **Completed:** 2026-03-25T13:17:00Z
- **Tasks:** 4
- **Files modified:** 2

## Accomplishments
- Added card-exit-fade (opacity 0, 500ms) and card-exit-collapse (max-height 0, 300ms) CSS classes
- Implemented animateCardExit function with timed phase transitions: T+0 fade, T+600 collapse, T+900 remove
- Green checkmark + "Deleted" text shown on success before fade begins
- App.svelte on:site-removed handler optimistically removes site from allSites before relay re-fetch
- activeDeleteCount ensures delete-start/delete-end fire correctly at concurrent delete boundaries

## Task Commits

All tasks were committed atomically in a single commit:

1. **Tasks 1-4: Full animation + App.svelte integration** - `3c5ab9c` (feat)

## Files Created/Modified
- `apps/spa/src/components/ManageSite.svelte` - Added CSS animation classes, animateCardExit function, activeDeleteCount, updated success indicator template
- `apps/spa/src/App.svelte` - Added on:site-removed handler for optimistic card removal from allSites

## Decisions Made
- CSS-only animation avoids Svelte 4 transition bug #4910
- 600ms/300ms timing provides visible success flash before card collapses
- dispatch('site-removed', site) + dispatch('deleted') dual events: optimistic removal + eventual relay consistency

## Deviations from Plan
None - plan executed exactly as written.

## Issues Encountered
None.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Delete animation system is complete
- Phase 13 beforeunload guard can integrate with delete-start/delete-end events
- Phase 15 post-action navigation can leverage the dispatch('deleted') event for navigation flows

---
*Phase: 14-delete-animation*
*Completed: 2026-03-25*
