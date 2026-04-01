---
phase: 11-spa-named-site-support
plan: 02
subsystem: ui
tags: [svelte, named-sites, kind-35128, base36, deploy-flow, manage-tab, card-list]

# Dependency graph
requires:
  - phase: 11-spa-named-site-support
    plan: 01
    provides: fetchAllManifests, publishManifest with options, publishEmptyManifest with dTag, base36Encode

provides:
  - Deploy flow root/named selector with dTag input and inline validation (App.svelte)
  - Title and description metadata fields in deploy reviewing step (App.svelte)
  - handleDeploy passes kind/dTag/title/description options to publishManifest (App.svelte)
  - fetchSiteInfo uses fetchAllManifests returning { root, named[] } (App.svelte)
  - Multi-site card list with expand/collapse and Update/Delete per site (ManageSite.svelte)
  - Named site URLs generated with base36Encode in ManageSite (ManageSite.svelte)
  - Update flow pre-fills siteType, dTag (read-only), title, description from manifest event

affects:
  - User-facing deploy and manage flows are now named-site-aware

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Radio button group for site type selection using Svelte bind:group"
    - "Multi-site card list with per-card expand/collapse state (expandedSiteId)"
    - "Scoped deletion state machine: deletingSite tracks which site is being deleted"
    - "Reactive blob count via $: deletingBlobCount instead of inline {@const}"

key-files:
  created: []
  modified:
    - apps/spa/src/App.svelte
    - apps/spa/src/components/ManageSite.svelte

key-decisions:
  - "Tab visibility uses allSites.root || allSites.named.length > 0 instead of existingManifest — shows Manage tab for named-only users"
  - "dTag input uses on:input with toLowerCase + replace to strip invalid chars in real-time rather than validation-only"
  - "ManageSite dispatch('update', site) passes full event — App.svelte extracts kind/dTag/title/description avoiding tight coupling"
  - "Svelte 3 {@const} cannot be direct child of div — used $: reactive variable deletingBlobCount instead"

patterns-established:
  - "onUpdate handler in App.svelte reads e.detail to determine siteType/dTag/title/description for pre-fill"
  - "deletingSite reactive pattern: single state variable tracks which card is in deletion flow"

requirements-completed: [SPA-14, SPA-15, SPA-19]

# Metrics
duration: ~4min
completed: 2026-03-21
---

# Phase 11 Plan 02: SPA Named Site UI Layer Summary

**Named site deploy selector with dTag validation, title/description metadata fields, and multi-site card management with per-site update/delete — wiring Plan 01 data layer into user-facing UI**

## Performance

- **Duration:** ~4 min
- **Started:** 2026-03-21T09:47:04Z
- **Completed:** 2026-03-21T09:51:24Z
- **Tasks:** 2 of 3 complete (Task 3 = human-verify checkpoint)
- **Files modified:** 2

## Accomplishments

### Task 1: App.svelte deploy flow (commit 8ce6827)
- Added `siteType`, `dTag`, `dTagReadOnly`, `deployTitle`, `deployDescription` state variables
- Added `allSites = { root, named[] }` and `sitesLoading` for multi-site tracking
- Added `dTagValid`, `dTagError`, `canDeploy` reactive statements for inline validation
- Updated `fetchSiteInfo` to use `fetchAllManifests` — `existingManifest` kept as backward compat alias
- Added root/named radio buttons in reviewing step
- Added dTag text input with real-time lowercase + non-alphanumeric stripping, red border + error message on invalid, readonly mode for updates
- Added title and description fields (always visible, optional)
- Deploy button disables when `!canDeploy` (named site with empty or invalid dTag)
- `handleDeploy` passes `{ kind: 35128/15128, dTag, title, description }` options to publishManifest
- `resetDeploy` clears all new named site state variables
- ManageSite component updated to pass `sites={allSites}`, `pubkey`, updated update/deleted event handlers
- Tab visibility condition updated to `allSites.root || allSites.named.length > 0`

### Task 2: ManageSite.svelte multi-site refactor (commit be9985f)
- Replaced individual site props with `sites`, `pubkey`, `relayUrls`, `blossomUrls`, `signer`
- Added `base36Encode`, `hexToBytes`, `npubEncode`, `getManifestDTag/Title/Description` imports
- Added `siteUrl(manifest)`, `siteLabel(manifest)`, `siteFileCount(manifest)`, `siteDate(manifest)` helpers
- Built `siteList` reactive array: root first, then named sites
- Added `expandedSiteId` with `toggleExpand` for accordion card behaviour
- Added `deletingSite` to scope the deletion state machine per card
- Rendered vertical card list with type badge (blue=named, purple=root), truncated URL, chevron expand
- Expanded card shows published date, file count, title (if any), Update and Delete buttons
- Empty state: "No sites published yet" when `siteList.length === 0`
- Delete flow: uses `publishEmptyManifest(signer, relays, { dTag })` for kind 35128, no dTag for root
- `dispatch('update', site)` passes full manifest event; `dispatch('deleted')` triggers re-fetch

## Task Commits

| # | Task | Commit | Files |
|---|------|--------|-------|
| 1 | Add root/named selector, dTag input, metadata fields to App.svelte | 8ce6827 | apps/spa/src/App.svelte |
| 2 | Refactor ManageSite.svelte to multi-site card list | be9985f | apps/spa/src/components/ManageSite.svelte |

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Svelte {@const} placement restriction**
- **Found during:** Task 2 (first build attempt)
- **Issue:** `{@const blobCount = computeDeleteBlobCount()}` placed as direct child of `<div>` — Svelte 3 disallows this
- **Fix:** Replaced with `$: deletingBlobCount = deletingSite ? [...].length : 0` reactive statement; removed `computeDeleteBlobCount()` function
- **Files modified:** apps/spa/src/components/ManageSite.svelte
- **Commit:** Included in be9985f

## Issues Encountered

None blocking. One build error on first attempt (Svelte const restriction) auto-fixed inline.

## User Setup Required

Dev server is running at http://localhost:5173/ for Task 3 checkpoint verification.

## Next Phase Readiness

- Task 3 is a human-verify checkpoint — user must confirm visual flows work
- On approval, plan 02 is complete and phase 11 is done
