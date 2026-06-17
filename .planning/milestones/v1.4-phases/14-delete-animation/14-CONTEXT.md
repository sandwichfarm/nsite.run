# Phase 14: Delete Animation - Context

**Gathered:** 2026-03-25
**Status:** Ready for planning

<domain>
## Phase Boundary

Visual feedback for site deletion in the manage view. Cards show in-progress styling, animate out on success, revert on failure, and remaining cards reflow smoothly. The delete logic itself (relay publishing, blob deletion) is unchanged — only the UI presentation layer changes.

</domain>

<decisions>
## Implementation Decisions

### Card state machine refactor
- **D-01:** Per-card state overlay — card list stays always visible. Track which card(s) are deleting via a Map/Set. No full-view swaps for deleting/done states.
- **D-02:** Confirmation dialog placement — Claude's discretion (full-view swap or inline card expand, whichever fits component structure best).
- **D-03:** Concurrent deletes supported — multiple cards can be in delete state simultaneously, each tracking independently.
- **D-04:** Fix deleteState success/failure conflation BEFORE adding animation — current "done" state always shows "Deletion complete" regardless of outcome. Must distinguish success from failure.

### Deletion progress UX
- **D-05:** Inline progress on card — card dims AND shows a small progress bar or step indicator (Relays... Blobs... Done) directly on the card surface.
- **D-06:** Card becomes unexpandable and non-interactive while in deleting state — pointer events disabled, visual "deleting" label/styling.

### Animation & reflow
- **D-07:** Card exit uses `out:fade` only — no `animate:flip` due to Svelte 4 bug (#4910).
- **D-08:** Fade-out duration: moderate ~500ms for deliberate, visible feedback.
- **D-09:** Reflow via CSS transition — two-phase animation: fade opacity first, then collapse height with `transition-all` so remaining cards slide up smoothly. Total animation ~800ms.

### Outcome display
- **D-10:** Card-level indicator — green flash/check for success, red flash/shake for failure. No separate results view. Card fades out after success indicator; card reverts after failure indicator.

### Failure recovery UX
- **D-11:** Animated recovery on failure — card opacity transitions back to full, brief red flash or shake indicates failure, then returns to normal interactive state.
- **D-12:** Error message inline on card — brief red text (e.g., "Delete failed — relays rejected") visible for a few seconds, then fades away. Card returns to fully normal state.

### Claude's Discretion
- Confirmation dialog placement (full-view or inline card expand)
- Exact dimming opacity and "Deleting..." label styling
- Progress indicator format (step pills vs. progress bar vs. text)
- Green success flash duration before fade-out begins
- Red failure flash/shake animation specifics
- Error message auto-dismiss timing (~3-5s reasonable)
- How to structure the per-card state Map (Map<siteId, deletePhase> or similar)

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### SPA delete flow
- `apps/spa/src/components/ManageSite.svelte` — Current delete state machine (deleteState, deletingSite, deleteStep, deleteError), card rendering, confirmation UI, progress UI, results UI
- `apps/spa/src/lib/publish.js` — `publishDeletionEvent()` for NIP-09 deletion to relays
- `apps/spa/src/lib/upload.js` — `deleteBlobs()` for BUD-02 blob deletion from blossom servers

### SPA architecture
- `apps/spa/src/App.svelte` — Parent component; `on:deleted` handler calls `fetchSiteInfo()` to refresh site list; OperationBanner integration from Phase 13
- `apps/spa/src/lib/store.js` — `deployState` store; ManageSite does not use this store (local state only)

### Phase 13 context (prior phase)
- `.planning/phases/13-leave-confirmation/13-CONTEXT.md` — delete-start/delete-end events, OperationBanner component, beforeunload guard during delete

### Svelte 4 animation constraints
- Svelte issue #4910 — `animate:flip` + `out:fade` conflict; use `out:fade` alone with CSS height transition for reflow

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `ManageSite.svelte` DELETE_STEPS array: `[{id: 'relays', label: 'Relays'}, {id: 'blobs', label: 'Blobs'}, {id: 'done', label: 'Done'}]` — can inform inline progress step indicator
- `LogoutConfirmModal.svelte`: amber warning styling pattern — informs visual treatment
- `OperationBanner.svelte` (Phase 13): background operation banner — already integrated in App.svelte
- `transition-colors`, `transition-all duration-300` patterns already used throughout ManageSite

### Established Patterns
- Card rendering: `{#each siteList as site (site.id)}` with keyed iteration — required for Svelte transitions
- Event dispatch: `createEventDispatcher()` with `dispatch('deleted')` — parent refreshes site list
- Card styling: `bg-slate-800 rounded-lg`, `hover:bg-slate-700/50 transition-colors`
- Tailwind-only animations (no Svelte `transition:` directives currently used in ManageSite)

### Integration Points
- `App.svelte on:deleted` handler: currently calls `fetchSiteInfo()` — may need coordination with card animation timing (don't re-fetch until fade-out completes, or handle stale data gracefully)
- `delete-start`/`delete-end` events from Phase 13: ManageSite already dispatches these for beforeunload guard
- `siteList` reactive derivation: `[...(sites.root ? [sites.root] : []), ...sites.named]` — removing a deleted site from this list triggers the `{#each}` block transition

</code_context>

<specifics>
## Specific Ideas

- Two-phase exit animation: fade opacity (~500ms), then collapse height via CSS transition — total ~800ms for smooth, deliberate feel
- Card-level indicators rather than separate results view — green flash on success before fade-out, red flash/shake on failure before revert
- Inline error text on card for failures — visible briefly, then auto-fades, card returns to normal
- Concurrent deletes allowed — each card independently tracks its own delete lifecycle

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 14-delete-animation*
*Context gathered: 2026-03-25*
