# Phase 13: Leave Confirmation - Context

**Gathered:** 2026-03-24
**Status:** Ready for planning

<domain>
## Phase Boundary

Prevent accidental loss of in-progress deploy or delete operations. Two mechanisms: browser-level `beforeunload` guard for page close/reload, and a persistent banner showing background operation status when switching SPA tabs. Tab switching is never blocked — operations continue in background.

</domain>

<decisions>
## Implementation Decisions

### Guard modal style
- **No in-page modal for tab switching** — tab switches are non-destructive; operations continue in background
- Browser `beforeunload` is the only modal-like guard — fires on tab close, page reload, or navigating away
- `beforeunload` uses `event.preventDefault()` (Chrome 119+) plus `event.returnValue = true` for legacy browsers
- The `beforeunload` listener must be attached reactively (not in onMount) to avoid Chrome treating the page as permanently dirty

### Background process banner
- **Persistent banner** visible across both Deploy and Manage tabs while an operation is in progress
- Shows operation type and progress — e.g., "Deploying... 45%" or "Deleting site..."
- Banner includes a link/button to return to the progress view on the original tab
- **Not dismissible** — stays visible until the operation completes or errors
- **On completion:** Banner updates to show result ("Deploy complete" or "Delete failed") with a "View details" link, then **auto-disappears after a few seconds** (exact duration: Claude's discretion, ~5s reasonable)
- Banner uses amber warning styling consistent with LogoutConfirmModal pattern

### Operation scope
- **Dangerous steps for deploy:** hashing, checking, uploading, publishing — these trigger both `beforeunload` and background banner
- **Dangerous steps for delete:** delete operations in ManageSite that are in progress — same treatment
- **NOT guarded:** idle, reviewing (file selection), success, error — these are terminal or pre-action states
- **Free navigation:** success and error screens allow free tab switching with no guard
- **Tabs only:** the guard scope is Deploy ↔ Manage tab switching and browser close/reload. Login/logout buttons are NOT guarded during operations.

### Claude's Discretion
- Exact banner placement (top vs bottom of content area)
- Auto-dismiss duration for completion banner
- Whether `beforeunload` also fires during delete operations (recommended: yes, for consistency)
- Animation for banner appear/disappear
- How to surface ManageSite delete state up to App.svelte for the banner (event dispatch or store)

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### SPA architecture
- `apps/spa/src/App.svelte` — Main component; tab switching logic (`currentPage`), deploy state management, `handleDeploy()`, `resetDeploy()`/`resetForUpdate()`
- `apps/spa/src/lib/store.js` — `deployState` store definition with step values: idle → reviewing → hashing → checking → uploading → publishing → success/error
- `apps/spa/src/components/ManageSite.svelte` — Delete flow with internal state machine

### Existing modal pattern
- `apps/spa/src/components/LogoutConfirmModal.svelte` — Reference for amber warning styling, dark slate card, button layout

### Research
- `.planning/research/STACK.md` — beforeunload behavior, Chrome 119+ requirements
- `.planning/research/PITFALLS.md` — Pitfalls 15-16 (beforeunload + dirty state)
- `.planning/research/ARCHITECTURE.md` — Integration points for leave confirmation

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `LogoutConfirmModal.svelte`: amber warning modal pattern — can inform banner styling (but banner is NOT a modal)
- `deployState` store: already tracks step with reactive `$deployState.step` — banner visibility can derive from this
- `ProgressIndicator.svelte`: existing progress display component

### Established Patterns
- Tab switching: bare `currentPage = 'deploy'/'manage'` assignment in onclick handlers — banner needs to be outside tab content
- Reactive statements: `$: step = $deployState.step` already exists in App.svelte — `beforeunload` listener can use similar reactive block
- Event dispatch: ManageSite uses `dispatch('update')` to communicate with App.svelte — same pattern for surfacing delete state

### Integration Points
- `App.svelte` line 539-555: tab button rendering — banner should render near/above this area, visible regardless of which tab is active
- `App.svelte` line 183: `$: step = $deployState.step` — reactive attachment point for `beforeunload`
- `ManageSite.svelte`: needs to expose delete-in-progress state to parent (new event dispatch or bindable prop)

</code_context>

<specifics>
## Specific Ideas

- User explicitly stated: "changing tabs is inherently non-destructive — they should not see a modal. We just need a GUI element to show that there is a process in the background."
- Banner should show result on completion ("Deploy complete" / "Delete failed") then auto-disappear after N seconds
- The persistent banner pattern was chosen over a tab badge — banner provides more context (operation type, progress percentage)

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 13-leave-confirmation*
*Context gathered: 2026-03-24*
