---
phase: 15-post-action-navigation
plan: "01"
subsystem: ui
tags: [svelte, navigation, buttons, events]

requires:
  - phase: 14-delete-animation
    provides: per-card delete state model with success/failure distinction
provides:
  - "Manage sites" and "Deploy another" navigation buttons on SuccessPanel
  - "Deploy new site" button in ManageSite manage view
  - Three new dispatched events: 'manage', 'deploy-another', 'deploy-new'
affects: [15-02-tab-disabling-event-wiring]

tech-stack:
  added: []
  patterns: [event dispatch for cross-component navigation]

key-files:
  created: []
  modified:
    - apps/spa/src/components/SuccessPanel.svelte
    - apps/spa/src/components/ManageSite.svelte

key-decisions:
  - "Replaced Update Site button entirely with Manage sites + Deploy another (per D-05)"
  - "Deploy new site button placed after site list, visible in all manage states (empty, populated, post-delete)"
  - "No separate done-state button needed — per-card delete model from Phase 14 auto-removes cards, always-visible button covers post-delete flow"

patterns-established:
  - "Navigation buttons dispatch named events to parent — component doesn't own page routing"

requirements-completed: [NAV-03, NAV-04]

duration: 3min
completed: 2026-03-25
---

# Plan 15-01: Post-action navigation buttons in SuccessPanel and ManageSite Summary

**"Manage sites" and "Deploy another" buttons replace Update Site on success screen; always-visible "Deploy new site" CTA added to manage view**

## Performance

- **Duration:** 3 min
- **Started:** 2026-03-25
- **Completed:** 2026-03-25
- **Tasks:** 2
- **Files modified:** 2

## Accomplishments
- Replaced the "Update Site" button on the deploy success screen with "Manage sites" (primary, purple) and "Deploy another" (secondary, slate) buttons
- Added an always-visible "Deploy new site" button at the bottom of the manage view, visible in both empty and populated site list states
- Three new events dispatched: `manage`, `deploy-another`, `deploy-new` — ready for App.svelte wiring in Plan 02

## Task Commits

Each task was committed atomically:

1. **Task 1: Replace Update Site button with Manage sites and Deploy another on SuccessPanel** - `0140be2` (feat)
2. **Task 2: Add always-visible Deploy new site button to ManageSite** - `f5c2d04` (feat)

## Files Created/Modified
- `apps/spa/src/components/SuccessPanel.svelte` - Replaced Update Site button with Manage sites + Deploy another buttons
- `apps/spa/src/components/ManageSite.svelte` - Added always-visible Deploy new site button after site list

## Decisions Made
- Placed "Deploy new site" button outside the siteList conditional so it renders in both empty and non-empty states
- No separate "done" state button needed — Phase 14's per-card delete model auto-removes successful cards, and the always-visible button at the bottom covers post-delete navigation
- "Manage sites" gets primary (purple) styling, "Deploy another" gets secondary (slate) styling per plan

## Deviations from Plan

### Auto-fixed Issues

**1. [Adaptation] No global "done" state exists in current ManageSite**
- **Found during:** Task 2 (Deploy new site button placement)
- **Issue:** Plan referenced a global `deleteState === 'done'` state with a "Back to sites" button. The actual code uses Phase 14's per-card `deletingCards` Map with auto-animating card removal — no global done screen exists.
- **Fix:** Single always-visible button at the bottom of the manage view covers all states (idle, post-delete, empty). The button is outside the per-card rendering blocks, so it remains visible throughout.
- **Verification:** Button is not inside any confirm/deleting template blocks, satisfying the acceptance criterion.

---

**Total deviations:** 1 adaptation (plan referenced outdated state model)
**Impact on plan:** Functionally equivalent — users always have a "Deploy new site" path from manage view.

## Issues Encountered
None

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- All three navigation events (manage, deploy-another, deploy-new) are dispatched and ready for App.svelte wiring in Plan 15-02
- Tab button disabling and event handler integration can proceed

---
*Phase: 15-post-action-navigation*
*Completed: 2026-03-25*
