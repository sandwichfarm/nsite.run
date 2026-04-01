# Phase 14: Delete Animation — Research

**Researched:** 2026-03-25
**Status:** Complete

## Executive Summary

Phase 14 transforms the ManageSite delete flow from a full-view state machine swap to an inline per-card animation system. The current code uses `deleteState` as a single global variable that replaces the entire card list with confirm/deleting/done views. The target is per-card overlays where the card list stays visible, individual cards show inline progress, fade out on success, and revert on failure.

**Key findings:**
1. The current `deleteState` state machine has a success/failure conflation bug — "done" always shows "Deletion complete" regardless of outcome
2. Svelte 4's `animate:flip` + `out:fade` conflict (#4910) means reflow must use CSS transitions, not Svelte transitions
3. The `{#each siteList as site (site.id)}` keyed iteration is required for Svelte transitions to work per-card
4. Concurrent deletes are feasible since `publishDeletionEvent` and `deleteBlobs` are independent async calls per site

## Current Architecture

### ManageSite.svelte State Machine

The component uses a single `deleteState` variable with four states:

```
idle → confirm → deleting → done
```

**Critical problem:** The entire card list is hidden when `deleteState !== 'idle'`. The `{#if deleteState === 'idle'}` block controls whether the card list renders at all. When any delete is in progress, all cards disappear and a single-purpose view takes over.

**Variables involved:**
- `deleteState: 'idle' | 'confirm' | 'deleting' | 'done'` — global, single-site
- `deletingSite` — the manifest event being deleted
- `deleteStep: 'relays' | 'blobs' | 'done'` — sub-step within deleting
- `relayProgress`, `blobProgress` — progress tracking
- `deleteResults` — outcome data
- `deleteError` — error string

### The Success/Failure Conflation Bug (DELT-04 blocker)

In `handleConfirmDelete()`:
- **Success path** (line 199-202): Sets `deleteStep = 'done'`, `deleteState = 'done'`, stores results
- **Error path** (line 204-212): Sets `deleteStep = 'done'`, `deleteState = 'done'`, stores error results
- **Done view** (line 514-598): Always shows "Deletion complete" with green checkmark header regardless of whether relays accepted or rejected

The done view does show per-relay/per-blossom success/failure icons, but the header and step pills always render as all-green success. There is no distinction between "all relays accepted" and "all relays rejected."

### App.svelte Integration

- `on:deleted` handler (line 582-584): calls `fetchSiteInfo($session.pubkey)` to refresh the site list
- `allSites` reactive variable holds `{ root: event|null, named: event[] }`
- `siteList` in ManageSite is derived: `[...(sites.root ? [sites.root] : []), ...sites.named]`
- When `fetchSiteInfo` runs, it re-fetches from relays, and if the deletion event was accepted, the deleted site no longer appears in the list

### Phase 13 Integration Points

From Phase 13, ManageSite already dispatches thin events for the beforeunload guard:
- `dispatch('delete-start')` — when delete begins
- `dispatch('delete-end')` — when delete completes

These are used by App.svelte's OperationBanner component. The delete animation changes must continue dispatching these events.

## Technical Analysis

### Per-Card State Tracking

Replace the single `deleteState` global with a `Map<string, DeleteCardState>` keyed by `site.id`:

```javascript
// Per-card delete state
let deletingCards = new Map(); // site.id → { phase, step, progress, results, error }

// Phases: 'confirm' | 'deleting' | 'success' | 'failure'
// Steps (during 'deleting'): 'relays' | 'blobs'
```

This allows:
- Multiple cards in different delete phases simultaneously
- The card list to always render (no more `{#if deleteState === 'idle'}` gating)
- Each card to independently show its own overlay/styling

### Card Rendering Changes

Current structure per card:
```svelte
{#each siteList as site (site.id)}
  <div class="bg-slate-800 rounded-lg overflow-hidden">
    <button on:click={() => toggleExpand(site.id)}>...</button>
    {#if expandedSiteId === site.id}
      <div>...expanded content with Delete button...</div>
    {/if}
  </div>
{/each}
```

Target structure:
```svelte
{#each siteList as site (site.id)}
  {@const cardState = deletingCards.get(site.id)}
  <div class="bg-slate-800 rounded-lg overflow-hidden {cardState ? 'opacity-60 pointer-events-none' : ''}"
       style="transition: opacity 500ms ease-out, max-height 500ms ease-out">
    <!-- Normal card content (always rendered) -->
    <button on:click={() => toggleExpand(site.id)}>...</button>

    <!-- Inline delete overlay when card is in delete state -->
    {#if cardState?.phase === 'confirm'}
      ...inline confirm...
    {:else if cardState?.phase === 'deleting'}
      ...inline progress...
    {:else if cardState?.phase === 'success'}
      ...green flash, then fade-out...
    {:else if cardState?.phase === 'failure'}
      ...red flash, error text, then revert...
    {/if}
  </div>
{/each}
```

### Animation Strategy (Svelte 4 constraints)

**Svelte `out:fade` on `{#each}` items:** Svelte 4 supports `out:fade` on keyed `{#each}` blocks. When an item is removed from the array, the transition plays before DOM removal. This is the correct mechanism for the card exit.

**However:** `animate:flip` (for reflow of remaining cards) conflicts with `out:fade` in Svelte 4 (issue #4910). The workaround from CONTEXT.md is correct: use `out:fade` alone for the exiting card, and rely on CSS `transition` for the reflow.

**Two-phase exit animation (from CONTEXT.md decisions D-07, D-08, D-09):**

1. **Phase 1 — Fade opacity** (~500ms): Card fades from full opacity to 0 via Svelte `out:fade={{ duration: 500 }}`
2. **Phase 2 — Collapse height** (~300ms): After fade completes, the card's wrapper collapses height via CSS `transition: max-height 300ms ease-out`

**Implementation approach:**

The tricky part is sequencing fade-then-collapse. Options:

**Option A: Svelte `out:fade` + delayed DOM removal**
- Remove the site from `siteList` to trigger `out:fade`
- After the fade transition ends, the DOM element is removed
- Remaining cards reflow naturally via CSS flow
- Problem: remaining cards jump immediately when the faded element is removed

**Option B: CSS-only two-phase animation (RECOMMENDED)**
- Keep the card in the DOM during the entire animation
- Phase 1: Set `opacity: 0` via CSS transition (500ms)
- Phase 2: After 500ms, set `max-height: 0; margin: 0; padding: 0; overflow: hidden` via CSS transition (300ms)
- Phase 3: After total 800ms, remove from `siteList` and dispatch `deleted`
- This avoids the Svelte transition system entirely, sidestepping #4910

**Option B is strongly recommended** because:
- Full control over sequencing
- No Svelte transition/animation conflicts
- CSS transitions are the established pattern in ManageSite (already uses `transition-colors`, `transition-all duration-300`)
- Height collapse before removal means no jump when item leaves the DOM

### Removing the Card from siteList

After the animation completes, the card needs to be removed from the `siteList`. Two approaches:

1. **Optimistic local removal:** Remove from `allSites` prop locally, then call `dispatch('deleted')` for App.svelte to re-fetch
2. **Re-fetch only:** Call `dispatch('deleted')`, wait for `fetchSiteInfo` to update `allSites`

**Recommended: Optimistic local removal** — removes the card immediately after animation, then re-fetch happens in background for consistency. This prevents the card from briefly reappearing if re-fetch is slow.

The card should be removed from `siteList` by filtering `allSites`:
```javascript
// After animation completes for site.id:
if (site.kind === 35128) {
  // Named site — filter by d-tag
  sites.named = sites.named.filter(s => s.id !== site.id);
} else {
  // Root site
  sites.root = null;
}
dispatch('deleted'); // App.svelte re-fetches for consistency
```

But `sites` is a prop — ManageSite can't mutate it directly. Instead, dispatch a new event like `dispatch('site-removed', site)` that App.svelte handles by updating `allSites`.

### Concurrent Delete Handling

CONTEXT.md decision D-03 requires concurrent deletes. With the Map approach:
- Each card tracks its own state independently
- `handleConfirmDelete(site)` creates an entry in `deletingCards` and runs the async delete
- Multiple entries can exist simultaneously
- The `delete-start`/`delete-end` events for Phase 13's beforeunload guard need adjustment: `delete-start` when the first card starts deleting, `delete-end` when the last card finishes

### Failure Recovery (DELT-03)

On failure:
1. Card shows red flash/shake (CSS animation, ~500ms)
2. Inline error text appears ("Delete failed — relays rejected")
3. After ~3-5s, error text fades, card returns to normal interactive state
4. Card is removed from `deletingCards` Map

CSS approach:
```css
@keyframes shake {
  0%, 100% { transform: translateX(0); }
  20%, 60% { transform: translateX(-4px); }
  40%, 80% { transform: translateX(4px); }
}
.card-failure { animation: shake 0.5s ease-in-out; }
```

### Success/Failure Distinction (DELT-04)

The fix requires checking whether any relay actually accepted the deletion:

```javascript
const anyRelaySuccess = relayResults.some(r => r.success);
if (anyRelaySuccess) {
  // At least one relay accepted — treat as success
  cardState.phase = 'success';
} else {
  // All relays rejected — treat as failure
  cardState.phase = 'failure';
  cardState.error = 'All relays rejected deletion';
}
```

This replaces the current behavior where both paths set `deleteState = 'done'`.

## Validation Architecture

### Testable Acceptance Conditions

1. **DELT-01 (Unexpandable + deleting styling):**
   - Card with active delete has `pointer-events-none` or equivalent
   - Card shows "Deleting..." label text
   - Card has reduced opacity (e.g., `opacity: 0.6`)
   - `toggleExpand()` is a no-op for cards in `deletingCards`

2. **DELT-02 (Fade-out + reflow):**
   - After success, card opacity transitions to 0 over ~500ms
   - After fade, card height collapses over ~300ms
   - Remaining cards have `transition` CSS property for smooth repositioning

3. **DELT-03 (Failure recovery):**
   - On failure, card shows shake animation class
   - Error text renders inline on the card
   - After timeout, card returns to normal state (removed from `deletingCards`)
   - Card is fully interactive after recovery

4. **DELT-04 (Success vs failure distinction):**
   - `handleConfirmDelete` checks `relayResults.some(r => r.success)`
   - Success path sets card phase to `'success'`
   - Failure path sets card phase to `'failure'` with error message
   - No code path sets phase to generic "done" without distinguishing outcome

## Risk Assessment

| Risk | Impact | Mitigation |
|------|--------|------------|
| Svelte 4 `out:fade` + list reflow jump | Cards jump when DOM element removed | Use CSS-only animation (Option B) — no Svelte transitions |
| Race condition: re-fetch completes before animation | Card reappears briefly before fade | Optimistic local removal before re-fetch |
| Phase 13 beforeunload integration | Delete guard stops working | Maintain `delete-start`/`delete-end` events; track any-card-deleting boolean |
| Concurrent delete Map reactivity | Svelte 4 Map changes don't trigger reactivity | Reassign Map on every change: `deletingCards = new Map(deletingCards)` |
| `sites` prop mutation from child | Svelte warns on prop mutation | Use event dispatch for card removal, not direct prop mutation |

## Dependencies

- **Phase 13 (completed):** `delete-start`/`delete-end` events, OperationBanner integration
- **No external dependencies:** All changes are within ManageSite.svelte and its parent integration in App.svelte

## Recommendations

1. **Fix DELT-04 first** — separate success/failure paths before adding animation
2. **Refactor to per-card state Map** — replace global `deleteState` with `deletingCards` Map
3. **CSS-only animation** — avoid Svelte transition system for the exit animation
4. **Optimistic removal** — remove card from list locally after animation, dispatch event for re-fetch
5. **Keep confirmation dialog inline on card** — simpler than a full-view swap, consistent with per-card model
6. **Maintain backward compatibility** — `dispatch('deleted')` must still fire for App.svelte's `fetchSiteInfo`

---

## RESEARCH COMPLETE

*Phase: 14-delete-animation*
*Researched: 2026-03-25*
