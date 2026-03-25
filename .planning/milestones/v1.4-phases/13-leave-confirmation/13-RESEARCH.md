# Phase 13: Leave Confirmation - Research

**Researched:** 2026-03-24
**Domain:** Svelte 4 browser lifecycle — `beforeunload` guard, reactive store-driven state, persistent in-app banner
**Confidence:** HIGH

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- **No in-page modal for tab switching** — tab switches are non-destructive; operations continue in background
- Browser `beforeunload` is the only modal-like guard — fires on tab close, page reload, or navigating away
- `beforeunload` uses `event.preventDefault()` (Chrome 119+) plus `event.returnValue = true` for legacy browsers
- The `beforeunload` listener must be attached reactively (not in onMount) to avoid Chrome treating the page as permanently dirty
- **Persistent banner** visible across both Deploy and Manage tabs while an operation is in progress
- Shows operation type and progress — e.g., "Deploying... 45%" or "Deleting site..."
- Banner includes a link/button to return to the progress view on the original tab
- **Not dismissible** — stays visible until the operation completes or errors
- **On completion:** Banner updates to show result ("Deploy complete" or "Delete failed") with a "View details" link, then **auto-disappears after a few seconds** (exact duration: Claude's discretion)
- Banner uses amber warning styling consistent with LogoutConfirmModal pattern
- **Dangerous steps for deploy:** hashing, checking, uploading, publishing — trigger both `beforeunload` and background banner
- **Dangerous steps for delete:** delete operations in ManageSite that are in progress (`deleteState === 'deleting'`) — same treatment
- **NOT guarded:** idle, reviewing (file selection), success, error — terminal or pre-action states
- **Free navigation:** success and error screens allow free tab switching with no guard
- **Tabs only:** guard scope is Deploy ↔ Manage tab switching and browser close/reload. Login/logout buttons NOT guarded

### Claude's Discretion
- Exact banner placement (top vs bottom of content area)
- Auto-dismiss duration for completion banner
- Whether `beforeunload` also fires during delete operations (recommended: yes, for consistency)
- Animation for banner appear/disappear
- How to surface ManageSite delete state up to App.svelte for the banner (event dispatch or store)

### Deferred Ideas (OUT OF SCOPE)
None — discussion stayed within phase scope
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| LEAVE-01 | Browser shows leave confirmation when closing/reloading tab during in-progress operation | `beforeunload` with `event.preventDefault()` + `event.returnValue = true`, attached reactively when `isDangerousStep` is true |
| LEAVE-02 | In-page confirmation modal when switching Deploy/Manage tabs during in-progress operation | Reinterpreted per discuss-phase: persistent banner showing background operation status when on another tab — not a modal |
| LEAVE-03 | Leave confirmation is not shown when no operation is in progress | `isDangerousStep` derived from `['hashing', 'checking', 'uploading', 'publishing']` only — excludes reviewing/success/error |
</phase_requirements>

---

## Summary

Phase 13 implements two complementary mechanisms. First, a `beforeunload` listener on `window` that fires the browser's native leave-confirmation dialog when the user tries to close the tab or reload during a dangerous deploy or delete step. Second, a persistent in-app banner that replaces the original "block tab switching" approach — when the user switches tabs while an operation runs in the background, the banner remains visible showing operation type and progress across both tabs.

The implementation is pure Svelte 4 reactive state — no new npm packages. The `deployState` store already carries `step`, which drives a derived `isDangerousStep` boolean. The delete-in-progress state from `ManageSite.svelte` must be bubbled to `App.svelte` via event dispatch (using the existing pattern from `dispatch('update')` and `dispatch('deleted')`). All guard logic lives in `App.svelte` so a single `beforeunload` listener and a single banner component serve both Deploy and Manage flows.

The banner is a new `OperationBanner.svelte` component. It renders above the tab buttons, is always present in the DOM when a dangerous operation (deploy or delete) is active, and auto-dismisses after ~5 seconds when the operation transitions to success or error.

**Primary recommendation:** Derive `isDangerousStep` from a strict allowlist (`hashing | checking | uploading | publishing` for deploy, `deleting` state from ManageSite), attach `beforeunload` reactively in `App.svelte`, and render a new `OperationBanner` component positioned above the tab switcher.

---

## Standard Stack

### Core

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| Svelte 4 | `^4.2.20` (installed) | Reactive `$:` statements, `onDestroy`, event dispatch | Already in use; all needed primitives are built-in |
| Browser `beforeunload` | Web API (no library) | Native page-leave dialog | Zero code overhead; handles tab close, reload, back-nav |
| `svelte/transition` `fade` | Built into svelte | Banner appear/disappear animation | Already imported in other components |

### Supporting

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| `createEventDispatcher` | Built into svelte | Bubble delete-in-progress state from ManageSite to App | Existing dispatch pattern already used in ManageSite |
| `onDestroy` | Built into svelte | Safety-net cleanup of `beforeunload` listener | Required to prevent listener leak if component unmounts |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Event dispatch to bubble delete state | Dedicated Svelte store for `deleteInProgress` | Store approach avoids prop threading but adds global state for a transient condition; dispatch keeps ManageSite self-contained and follows existing pattern |
| Banner in `App.svelte` template | Banner as portal/overlay | Portal adds complexity with no benefit; banner positioned above tabs via normal flow achieves the same visual result |

**Installation:**

```bash
# Nothing to install — all capabilities are in svelte@^4.2.20 (already installed)
```

---

## Architecture Patterns

### Recommended Project Structure

```
apps/spa/src/
├── App.svelte              # beforeunload listener + banner integration
├── components/
│   ├── OperationBanner.svelte   # NEW: persistent background-op banner
│   ├── ManageSite.svelte        # MODIFIED: dispatch 'delete-start' / 'delete-end'
│   └── LogoutConfirmModal.svelte  # Existing amber styling reference
└── lib/
    └── store.js               # deployState store (no changes needed)
```

### Pattern 1: Reactive `beforeunload` Attachment

**What:** Add/remove the `beforeunload` listener based on `isDangerousStep`. Never attach in `onMount` unconditionally.

**When to use:** Exactly when `isDangerousStep` transitions from false to true (operation begins) and detach when it transitions back to false (operation ends, errors, or component is destroyed).

**Example:**
```svelte
<!-- App.svelte -->
<script>
  import { onDestroy } from 'svelte';

  // Dangerous deploy steps — excludes idle, reviewing, success, error
  const DANGEROUS_DEPLOY_STEPS = new Set(['hashing', 'checking', 'uploading', 'publishing']);

  // deleteInProgress is set true by 'delete-start' event from ManageSite,
  // false by 'delete-end' event
  let deleteInProgress = false;

  $: step = $deployState.step;
  $: isDangerousStep = DANGEROUS_DEPLOY_STEPS.has(step) || deleteInProgress;

  function handleBeforeUnload(event) {
    event.preventDefault();
    event.returnValue = true; // Legacy Chrome/Edge < 119
  }

  $: if (isDangerousStep) {
    window.addEventListener('beforeunload', handleBeforeUnload);
  } else {
    window.removeEventListener('beforeunload', handleBeforeUnload);
  }

  // Safety-net: ensure listener is removed when component unmounts
  onDestroy(() => {
    window.removeEventListener('beforeunload', handleBeforeUnload);
  });
</script>
```

### Pattern 2: OperationBanner Component

**What:** A non-dismissible amber banner rendered above the tab switcher in `App.svelte`. Shows when `isDangerousStep` is true OR when the operation just completed (brief completion state). Auto-dismisses after ~5 seconds on completion.

**When to use:** Render whenever an operation runs in the background (user has switched away from the tab where the operation originated, or the stepper is visible — it doesn't matter; the banner is always visible when an op is in progress).

**Example:**
```svelte
<!-- OperationBanner.svelte -->
<script>
  import { fade } from 'svelte/transition';

  export let operationType = 'deploy'; // 'deploy' | 'delete'
  export let progress = 0;            // 0-100
  export let step = '';               // current step label
  export let completionState = null;  // null | 'success' | 'error'
  export let onViewDetails = null;    // callback to navigate back to the operation tab

  // Auto-dismiss on completion after 5s
  let visible = true;
  $: if (completionState !== null) {
    setTimeout(() => { visible = false; }, 5000);
  }
</script>

{#if visible}
  <div
    transition:fade={{ duration: 200 }}
    class="w-full bg-amber-900/40 border border-amber-600/50 rounded-lg px-4 py-2 flex items-center justify-between text-sm"
  >
    <div class="flex items-center gap-2 text-amber-200">
      {#if completionState === null}
        <!-- In-progress -->
        <span class="w-2 h-2 rounded-full bg-amber-400 animate-pulse" />
        <span>
          {operationType === 'deploy' ? 'Deploying' : 'Deleting'} — {step}
          {#if progress > 0 && progress < 100} ({progress}%){/if}
        </span>
      {:else if completionState === 'success'}
        <span>{operationType === 'deploy' ? 'Deploy complete' : 'Delete complete'}</span>
      {:else}
        <span class="text-red-300">{operationType === 'deploy' ? 'Deploy failed' : 'Delete failed'}</span>
      {/if}
    </div>
    {#if onViewDetails}
      <button
        on:click={onViewDetails}
        class="text-amber-400 hover:text-amber-200 underline text-xs"
      >
        View details
      </button>
    {/if}
  </div>
{/if}
```

### Pattern 3: Surfacing Delete State from ManageSite

**What:** ManageSite dispatches two events to parent: `'delete-start'` when `deleteState` transitions to `'deleting'`, and `'delete-end'` when it transitions to `'done'` or is cancelled.

**When to use:** Existing dispatch pattern is already used (`dispatch('update')`, `dispatch('deleted')`). Follow the same approach.

```svelte
<!-- ManageSite.svelte additions -->
<script>
  // In handleConfirmDelete():
  deleteState = 'deleting';
  dispatch('delete-start', { operationType: 'delete' });

  // At end of handleConfirmDelete(), after results:
  deleteState = 'done';
  dispatch('delete-end', { success: overallSuccess });

  // In cancelDelete():
  deleteState = 'idle';
  dispatch('delete-end', { success: null }); // cancelled — not a completion
</script>
```

```svelte
<!-- App.svelte -->
<ManageSite
  ...
  on:delete-start={() => { deleteInProgress = true; }}
  on:delete-end={(e) => {
    deleteInProgress = false;
    // Optionally: show completion banner state before auto-dismiss
  }}
/>
```

### Banner Placement in App.svelte

The banner renders above the tab buttons (line 539-555 of current App.svelte). It must be visible regardless of which tab is active. Position it just before the tab buttons div, inside the `max-w-2xl` container:

```svelte
<!-- App.svelte template, around line 537 -->
<div class="w-full max-w-2xl">
  <!-- Background operation banner (shows across both tabs) -->
  {#if isDangerousStep || bannerCompletionState !== null}
    <div class="mb-3">
      <OperationBanner
        operationType={deleteInProgress ? 'delete' : 'deploy'}
        progress={$deployState.progress}
        step={step}
        completionState={bannerCompletionState}
        onViewDetails={deleteInProgress
          ? () => (currentPage = 'manage')
          : () => (currentPage = 'deploy')}
      />
    </div>
  {/if}

  <!-- Tabs -->
  {#if (allSites.root || allSites.named.length > 0) && $session.pubkey}
    <div class="flex gap-1 mb-4 ...">
      ...
    </div>
  {/if}
  ...
</div>
```

### Anti-Patterns to Avoid

- **Attaching `beforeunload` in `onMount` unconditionally**: Chrome marks the page as permanently dirty, showing the dialog even when idle.
- **Checking `step !== 'idle'` for "dangerous"**: This includes `reviewing`, `success`, and `error` — only the in-flight steps are actually dangerous.
- **Setting `event.returnValue` to a string**: Custom messages are silently ignored in all modern browsers since ~2016. Use `true`.
- **Dispatching `delete-end` too early**: Must dispatch AFTER `deleteState` transitions to `'done'`, not before. Otherwise the banner dismisses before the operation completes.
- **Using `$:` to set banner completion state from store alone**: The banner auto-dismiss timer (`setTimeout`) must not restart on every re-render. Track `bannerCompletionState` as a local variable updated exactly once per completion transition.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Page-leave dialog | Custom modal/overlay for reload/close | Browser `beforeunload` | Browser handles the hard cases — tab close, keyboard shortcuts (Ctrl+W), process kill via task manager |
| Animation for banner | CSS keyframes + JS timing | `svelte/transition` `fade` | Svelte coordinates DOM removal with transition; CSS on `display:none` does not animate correctly |
| Progress in banner | Re-implement progress tracking | Read `$deployState.progress` directly | Store already carries `0-100` progress; no duplication needed |

**Key insight:** The browser's `beforeunload` is the right tool for actual page-leave. The banner is the right tool for in-SPA navigation. These are two separate mechanisms with separate purposes — don't conflate them.

---

## Common Pitfalls

### Pitfall 1: `beforeunload` Dialog Doesn't Show (Sticky Activation)
**What goes wrong:** Chrome 119+ requires prior user interaction (sticky activation) before showing the dialog. A user who drags files without clicking anything first may not see the dialog.

**Why it happens:** Drag-and-drop events are not guaranteed to count as sticky activation gestures. The file drop itself may or may not count depending on browser version.

**How to avoid:** Accept this as a known browser limitation. File selection requires user interaction (clicking DeployZone, dragging files), which typically satisfies sticky activation. Do not attempt to simulate clicks to manufacture activation.

**Warning signs:** Manual test in Chrome: start a deploy, immediately try to close the tab — if no dialog appears, the sticky activation condition was not met.

### Pitfall 2: Listener Outlives Operation (Memory/Behavioral Leak)
**What goes wrong:** The reactive `$:` block that attaches the listener also detaches it — but if the component is destroyed (user navigates away before the operation ends), the `$:` block never fires with `false` and the listener persists on `window`.

**Why it happens:** Svelte reactive statements only fire when the component is alive. On component destruction, pending reactive effects do not run.

**How to avoid:** Always include an `onDestroy` cleanup:
```javascript
onDestroy(() => {
  window.removeEventListener('beforeunload', handleBeforeUnload);
});
```

### Pitfall 3: Banner Timer Resets on Re-render
**What goes wrong:** If `bannerCompletionState` is derived reactively and the `setTimeout` fires inside a reactive block, every re-render (e.g., progress updates) restarts the 5-second timer, so the banner never disappears during a busy upload.

**Why it happens:** Svelte re-runs `$:` blocks on any dependency change. A `setTimeout` inside a reactive block gets called multiple times.

**How to avoid:** Track the auto-dismiss timer in a plain variable set exactly once. Use a separate `$:` block that watches only for the `completionState !== null` transition and sets the timer once using a guard:

```javascript
let dismissTimerSet = false;
$: if (bannerCompletionState !== null && !dismissTimerSet) {
  dismissTimerSet = true;
  setTimeout(() => {
    bannerCompletionState = null;
    dismissTimerSet = false;
  }, 5000);
}
```

### Pitfall 4: Tab Switching During Operation Navigates Away from Stepper
**What goes wrong:** The banner shows "View details" pointing the user back to the deploy/manage tab. If clicking "View details" switches tabs but the stepper component is not rendered when `step` is in a dangerous state, the user switches to a blank screen.

**Why it happens:** Current App.svelte renders the stepper (`ProgressIndicator`) only inside the `{#else}` branch of the `{#if step === 'idle' || step === 'selecting'}` block. That branch is always rendered regardless of `currentPage` — but if the tab-rendering code gates on `currentPage`, the stepper may not show on the deploy tab while the user is on the manage tab.

**How to avoid:** Verify the stepper rendering path in App.svelte is not gated by `currentPage`. The stepper shows when `step` is an in-progress value — confirm this is independent of the `currentPage` variable. (Based on current code reading, the stepper block appears to be at the same level as the idle/selecting block, not inside a `currentPage` conditional.)

### Pitfall 5: `delete-end` Not Dispatched on Cancel
**What goes wrong:** User clicks "Cancel" on the delete confirm dialog. `deleteInProgress` stays `true` in App.svelte. `beforeunload` continues to fire. Banner stays visible.

**Why it happens:** `cancelDelete()` only resets ManageSite internal state. It does not dispatch any event to the parent.

**How to avoid:** Dispatch `'delete-end'` from `cancelDelete()` in ManageSite (with a `{ cancelled: true }` payload or just `{ success: null }`). App.svelte handler should set `deleteInProgress = false` on any `delete-end` event regardless of success value.

---

## Code Examples

Verified patterns from official sources:

### `beforeunload` — MDN-Recommended Pattern (Chrome 119+)
```javascript
// Source: https://developer.mozilla.org/en-US/docs/Web/API/Window/beforeunload_event
function handleBeforeUnload(event) {
  event.preventDefault();
  event.returnValue = true; // Required for Chrome/Edge < 119
  // Return value has no effect on message text in any modern browser
}
```

### Reactive Listener Attach/Detach in Svelte 4
```svelte
<!-- Source: derived from Svelte 4 reactive statement docs + STACK.md verified pattern -->
<script>
  import { onDestroy } from 'svelte';

  const DANGEROUS_STEPS = new Set(['hashing', 'checking', 'uploading', 'publishing']);
  let deleteInProgress = false;

  $: step = $deployState.step;
  $: isDangerousStep = DANGEROUS_STEPS.has(step) || deleteInProgress;

  function handleBeforeUnload(event) {
    event.preventDefault();
    event.returnValue = true;
  }

  $: if (isDangerousStep) {
    window.addEventListener('beforeunload', handleBeforeUnload);
  } else {
    window.removeEventListener('beforeunload', handleBeforeUnload);
  }

  onDestroy(() => window.removeEventListener('beforeunload', handleBeforeUnload));
</script>
```

### ManageSite Event Dispatch for Delete State
```svelte
<!-- ManageSite.svelte — follows existing dispatch('update') / dispatch('deleted') pattern -->
<script>
  const dispatch = createEventDispatcher();

  async function handleConfirmDelete() {
    // ...existing guard checks...
    deleteState = 'deleting';
    dispatch('delete-start');
    try {
      // ...deletion logic...
      deleteState = 'done';
      dispatch('delete-end', { success: true });
    } catch (err) {
      deleteState = 'done';
      dispatch('delete-end', { success: false });
    }
  }

  function cancelDelete() {
    deletingSite = null;
    deleteState = 'idle';
    deleteError = '';
    dispatch('delete-end', { cancelled: true });
  }
</script>
```

### App.svelte Integration
```svelte
<!-- App.svelte — handler wiring -->
<ManageSite
  ...existing props...
  on:delete-start={() => { deleteInProgress = true; }}
  on:delete-end={() => { deleteInProgress = false; }}
  on:update={...existing handler...}
  on:deleted={...existing handler...}
/>
```

### Banner Auto-Dismiss (One-Shot Timer)
```javascript
// In OperationBanner.svelte
let dismissTimerSet = false;
$: if (completionState !== null && !dismissTimerSet) {
  dismissTimerSet = true;
  setTimeout(() => {
    visible = false;
  }, 5000);
}
```

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| `event.returnValue = "custom message"` | `event.returnValue = true` (any truthy non-string) | Chrome 51 (~2016) | Custom messages never shown — do not write copy that depends on dialog text |
| `beforeunload` always fires on mobile | Mobile mostly suppresses dialog | iOS Safari ~2017, Android Chrome ~2018 | Do not rely on `beforeunload` as the sole safety net on mobile |
| In-page modal blocking tab switches | Persistent banner (non-blocking) | Phase 13 design decision | Tab switches are non-destructive; banner provides awareness without friction |

---

## Open Questions

1. **Banner visibility when stepper is active and user is on the deploy tab**
   - What we know: the banner is designed for "you switched away" awareness
   - What's unclear: should the banner also appear when the user is ON the deploy tab watching the stepper? It seems redundant — the stepper itself shows progress.
   - Recommendation: Hide the banner when the user is on the "originating" tab (deploy tab during a deploy, manage tab during a delete). Show it only when the user is on the OTHER tab. This requires tracking which tab the operation originated on. Simpler alternative: always show the banner when isDangerousStep is true, and let the user see it as a "status bar" even on the originating tab — consistent behavior, no tab-origin tracking needed.

2. **`deleteState` in ManageSite currently has no `'error'` terminal state**
   - What we know: `handleConfirmDelete` sets `deleteState = 'done'` regardless of relay results. The DELT-03 requirement (Phase 14) adds a proper rollback.
   - What's unclear: for Phase 13, should `delete-end` dispatch happen from both the success and error branches, or is `'done'` always the terminal state?
   - Recommendation: Dispatch `delete-end` whenever `deleteState` becomes `'done'` (the current terminal state). Phase 14 will add an error terminal state — at that point, `delete-end` should also dispatch from there.

---

## Sources

### Primary (HIGH confidence)
- `apps/spa/src/App.svelte` — Live code: `deployState` subscription (`$: step = $deployState.step` line 183), tab switching logic (`currentPage`, lines 539-555), existing `ManageSite` event handlers (`on:update`, `on:deleted`)
- `apps/spa/src/lib/store.js` — Live code: `deployState` writable store, step values (`idle | hashing | uploading | publishing | done | error`)
- `apps/spa/src/components/ManageSite.svelte` — Live code: internal state machine (`idle | confirm | deleting | done`), `createEventDispatcher`, existing `dispatch('update')` and `dispatch('deleted')` events
- `apps/spa/src/components/LogoutConfirmModal.svelte` — Live code: amber warning styling (`bg-amber-900/30 border-amber-600/50 text-amber-300`) — reference for banner style
- `.planning/research/STACK.md` — Verified `beforeunload` pattern, Chrome 119+ requirements, no new packages needed
- `.planning/research/PITFALLS.md` (Pitfalls 15-16) — `beforeunload` failure modes, dirty-state trap from `onMount` attachment, dangerous step definition
- `https://developer.mozilla.org/en-US/docs/Web/API/Window/beforeunload_event` — `event.preventDefault()` + `event.returnValue = true` pattern, sticky activation, mobile unreliability

### Secondary (MEDIUM confidence)
- `.planning/phases/13-leave-confirmation/13-CONTEXT.md` — User decisions from discuss-phase, canonical refs, established patterns

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — all primitives in already-installed svelte@^4.2.20; no new packages
- Architecture: HIGH — derived from direct code reading of App.svelte, ManageSite.svelte, store.js, and LogoutConfirmModal.svelte
- `beforeunload` behavior: HIGH — MDN official docs + prior research in STACK.md/PITFALLS.md
- Banner design: HIGH — follows existing LogoutConfirmModal amber styling; placement derived from reading App.svelte template structure

**Research date:** 2026-03-24
**Valid until:** 2026-04-24 (stable Svelte 4 APIs; `beforeunload` behavior stable)
