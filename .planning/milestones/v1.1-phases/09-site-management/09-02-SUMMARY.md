---
phase: 09-site-management
plan: 02
subsystem: ui
tags: [svelte, nostr, kind-15128, kind-5, nip-09, bud-02, blossom, site-deletion]

# Dependency graph
requires:
  - phase: 09-site-management (plan 01)
    provides: existingManifest state, SiteInfoCard with delete dispatch, publishToRelay function, userRelays/userBlossoms lists
provides:
  - publishEmptyManifest function (empty kind 15128 replaceable event to all relays)
  - publishDeletionEvent function (NIP-09 kind 5 referencing manifest event ID)
  - deleteBlobs function (BUD-02 DELETE requests with kind 24242 auth)
  - DeleteConfirmModal component with three states (confirm/progress/results)
  - handleDeleteSite function wiring full deletion flow in App.svelte
affects: []

# Tech tracking
tech-stack:
  added: []
  patterns: [three-state modal pattern (confirm/in-progress/results), best-effort multi-server deletion with per-server reporting, batched auth event signing for blob deletion]

key-files:
  created:
    - apps/spa/src/components/DeleteConfirmModal.svelte
  modified:
    - apps/spa/src/lib/publish.js
    - apps/spa/src/lib/upload.js
    - apps/spa/src/App.svelte

key-decisions:
  - "publishEmptyManifest uses replaceable event semantics (same pubkey + kind = supersedes) — no special gateway support needed to 'unpublish'"
  - "publishDeletionEvent (kind 5 NIP-09) is belt-and-suspenders alongside empty manifest — sent to all relays but failures don't block deletion flow"
  - "deleteBlobs batches auth signing at 50 hashes per batch per server to avoid oversized auth events"
  - "handleDeleteSite merges emptyManifest + deletionEvent relay results per relay with descriptive status messages"
  - "existingManifest cleared to null immediately after deletion completes — UI returns to idle deploy zone automatically"
  - "DeleteConfirmModal prevents close (backdrop/Escape) while deletion is in progress (deleting=true state)"

patterns-established:
  - "Three-state modal pattern: {#if !deleting && !results} confirmation {:else if deleting} progress {:else if results} results"
  - "Deletion scope as derived reactives: deleteRelayUrls, deleteBlossomUrls_list, deleteBlobCount — always current from userRelays/userBlossoms"

requirements-completed: [SITE-03]

# Metrics
duration: 2min
completed: 2026-03-20
---

# Phase 9 Plan 2: Site Management - Deletion Flow Summary

**Empty kind 15128 manifest + NIP-09 kind 5 deletion event to relays, BUD-02 DELETE to blossom servers, with a three-state confirmation modal showing scope, progress, and per-server results**

## Performance

- **Duration:** ~2 min
- **Started:** 2026-03-20T18:19:28Z
- **Completed:** 2026-03-20T18:21:32Z
- **Tasks:** 2
- **Files modified:** 4 (3 modified, 1 created)

## Accomplishments
- Added `publishEmptyManifest` and `publishDeletionEvent` to publish.js — empty kind 15128 + NIP-09 kind 5 events published to all relays with per-relay results
- Added `deleteBlobs` to upload.js — BUD-02 DELETE requests per-blob per-server with batched kind 24242 auth and per-server result tracking
- Created `DeleteConfirmModal` component with full three-state UX: confirmation with server scope lists, in-progress spinner (no dismiss), results summary with per-server outcomes
- Wired `handleDeleteSite` in App.svelte: publishes empty manifest + kind 5 to all relays, DELETEs blobs from all blossoms, merges results, clears `existingManifest = null` to return UI to idle state

## Task Commits

Each task was committed atomically:

1. **Task 1: Add deletion functions to publish.js and upload.js** - `50d605f` (feat)
2. **Task 2: Create DeleteConfirmModal and wire deletion flow in App.svelte** - `cd644bf` (feat)

**Plan metadata:** (docs commit follows)

## Files Created/Modified
- `apps/spa/src/lib/publish.js` - Added publishEmptyManifest (empty kind 15128) and publishDeletionEvent (NIP-09 kind 5 with 'e' tag referencing manifest ID)
- `apps/spa/src/lib/upload.js` - Added deleteBlobs for BUD-02 DELETE/{sha256} with batched kind 24242 auth, per-server result accumulation, and optional onProgress callback
- `apps/spa/src/components/DeleteConfirmModal.svelte` - Three-state modal (181 lines): confirm shows relay/blossom URL lists + blob count, in-progress shows spinner + locks backdrop, results shows per-relay checkmark/X and per-blossom deleted/failed counts
- `apps/spa/src/App.svelte` - Imports deleteBlobs/publishEmptyManifest/publishDeletionEvent/DeleteConfirmModal; deletion state variables; derived deleteRelayUrls/deleteBlossomUrls_list/deleteBlobCount; handleDeleteSite function; SiteInfoCard on:delete wired; DeleteConfirmModal rendered at bottom of min-h-screen div

## Decisions Made
- `publishEmptyManifest` uses replaceable event semantics (same kind + pubkey = supersedes previous) — no special relay support needed beyond standard NIP replaceable events
- `publishDeletionEvent` is sent regardless of empty manifest result — belt-and-suspenders for relays that honor NIP-09
- `deleteBlobs` signs auth in batches of 50 hashes per server to keep auth event size manageable
- Relay results in the modal merge empty manifest + deletion event outcomes per relay into a single descriptive string
- `existingManifest` is set to null after deletion so SiteInfoCard disappears without requiring page reload

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
None.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Site deletion fully functional: empty manifest published, kind 5 sent, blobs DELETEd from blossom servers
- Phase 09 site-management is now complete (both plans executed)
- Session/signer preserved after deletion — user can re-deploy immediately

## Self-Check: PASSED

- FOUND: apps/spa/src/lib/publish.js (publishEmptyManifest + publishDeletionEvent)
- FOUND: apps/spa/src/lib/upload.js (deleteBlobs)
- FOUND: apps/spa/src/components/DeleteConfirmModal.svelte
- FOUND: apps/spa/src/App.svelte (handleDeleteSite, showDeleteConfirm, DeleteConfirmModal)
- FOUND commit: 50d605f
- FOUND commit: cd644bf

---
*Phase: 09-site-management*
*Completed: 2026-03-20*
