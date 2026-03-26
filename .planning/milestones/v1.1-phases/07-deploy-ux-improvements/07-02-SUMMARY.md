---
phase: 07-deploy-ux-improvements
plan: 02
subsystem: ui
tags: [svelte, filetree, exclude-toggle, directory-exclude, badge, ignored-summary]

# Dependency graph
requires:
  - "07-01 (fileDataMap prop, file preview, excludedPaths foundation)"
provides:
  - Hover-reveal exclude toggle on all file rows in FileTree
  - Directory recursive exclude/re-include via collectFilePaths helper
  - Excluded count badge above file tree in App.svelte
  - Ignored summary section below file tree with per-file re-include toggles and bulk re-include
affects: []

# Tech tracking
tech-stack:
  added: []
  patterns:
    - Externally-managed Set prop pattern: parent owns excluded state, child reads via prop
    - Recursive collectFilePaths helper for directory subtree operations
    - opacity-0 group-hover:opacity-100 for hover-reveal UI elements
    - TRUNCATE_THRESHOLD inline const for list truncation with expand/collapse

key-files:
  created: []
  modified:
    - apps/spa/src/components/FileTree.svelte
    - apps/spa/src/App.svelte

key-decisions:
  - "Excluded state moved from FileTree internal (excludedPaths) to externally-managed prop (excludedFiles) from App.svelte — single source of truth"
  - "Directory toggleExclude calls onToggleExclude per child file path — App.svelte toggle function handles each path individually"
  - "Hover toggle only renders when nodeWarnings.length === 0 — warned files retain their always-visible amber checkbox unchanged"
  - "Ignored summary expanded by default with TRUNCATE_THRESHOLD=10 items before + N more"

patterns-established:
  - "Hover-reveal toggle: opacity-0 group-hover:opacity-100 on flex-shrink-0 button with stopPropagation"
  - "Recursive directory exclude: collectFilePaths + allExcluded check + per-path onToggleExclude calls"

requirements-completed: [DPLX-03]

# Metrics
duration: 3min
completed: 2026-03-20
---

# Phase 07 Plan 02: Deploy UX Improvements Summary

**Hover-reveal exclude toggle on all file rows with directory recursive exclude, excluded count badge, and ignored summary section with re-include controls**

## Performance

- **Duration:** 3 min
- **Started:** 2026-03-20T16:00:20Z
- **Completed:** 2026-03-20T16:03:33Z
- **Tasks:** 2
- **Files modified:** 2

## Accomplishments
- FileTree now shows a hover-reveal X toggle on every non-warned file row (opacity-0 group-hover:opacity-100) — clicking excludes or re-includes the file
- Directory rows have a hover-reveal X toggle that recursively excludes all child files via collectFilePaths helper
- Excluded state moved from internal `excludedPaths` Set to externally-managed `excludedFiles` prop from App.svelte — single source of truth
- Warned files retain their existing always-visible amber checkbox + "Exclude" label unchanged (toggle only renders when nodeWarnings.length === 0)
- Fully-excluded directories show opacity-40 visual treatment
- App.svelte shows an eye-slash badge above the file tree with excluded count when any files are excluded
- An "Excluded files (N)" summary section appears below the file tree listing all excluded paths
- Each excluded file has an individual "Re-include" button; a bulk "Re-include all" button appears in the section header
- Lists longer than 10 items are truncated with a "+ N more" expander; "Show less" collapses back
- `excludedSummaryExpanded` state resets to false on `resetDeploy()`
- Vite build succeeds with no new errors

## Task Commits

Each task was committed atomically:

1. **Task 1: Add hover-reveal exclude toggle and directory recursive exclude in FileTree** - `3738832` (feat)
2. **Task 2: Add excluded files badge and ignored summary section in App.svelte** - `cc04a6d` (feat)

**Plan metadata:** (docs commit — see final commit)

## Files Created/Modified
- `apps/spa/src/components/FileTree.svelte` - Added excludedFiles prop, collectFilePaths helper, updated toggleExclude for directories, added hover-reveal toggles on file/dir rows, removed internal excludedPaths
- `apps/spa/src/App.svelte` - Added excludedSummaryExpanded state, userExcludedCount/userExcludedPaths reactive declarations, excluded badge, ignored summary section, passed excludedFiles to FileTree

## Decisions Made
- Excluded state is now externally managed: App.svelte owns `excludedFiles`, FileTree reads it via prop. This eliminates the duplicate state that existed before (both `excludedPaths` internal and `excludedFiles` in App.svelte)
- Directory recursive exclude calls `onToggleExclude(path)` once per child file — the toggle function in App.svelte handles each path individually, keeping logic simple
- Hover toggle uses `on:click|stopPropagation` to prevent preview toggle from firing when clicking the exclude button
- Truncation threshold set at 10 items (TRUNCATE_THRESHOLD inline const in template)

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
None — the Vite build warning about `publishResult` in SuccessPanel.svelte is pre-existing and unrelated to this plan.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Phase 07 is now complete (both plans executed)
- No blockers for future phases

---
*Phase: 07-deploy-ux-improvements*
*Completed: 2026-03-20*
