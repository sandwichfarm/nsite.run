# Phase 15: Post-Action Navigation - Context

**Gathered:** 2026-03-25
**Status:** Ready for planning

<domain>
## Phase Boundary

Surface navigation options after deploy and delete so users are never stuck at a dead end. Tab buttons disable during active operations and re-enable on completion/error. Deploy success screen gains contextual next-action buttons. Manage view gains an always-visible "Deploy new site" CTA.

</domain>

<decisions>
## Implementation Decisions

### Tab button visibility during operations
- **D-01:** Tab buttons (Deploy/Manage) are disabled and greyed out during active operations — NOT hidden/removed from DOM. User can still see where they are.
- **D-02:** Tab buttons re-enable as soon as the operation reaches success or error state — no waiting for user acknowledgment.
- **D-03:** No distinction between destructive and non-destructive operations for tab re-enabling — all operations (deploy, update, delete) follow the same pattern: disable during active, re-enable on completion/error.

### Post-deploy success screen
- **D-04:** Two navigation buttons on deploy success screen: "Manage sites" and "Deploy another site".
- **D-05:** These buttons replace the existing "Update" button — reduces clutter since "Deploy another" covers the same use case.
- **D-06:** Existing success content (site URL, nsec backup for anon users) remains untouched — navigation buttons are additive below that content, replacing only the "Update" button position.
- **D-07:** "Manage sites" navigates to manage view preserving current signer session. "Deploy another site" uses `resetForUpdate()` (not `resetDeploy()`) to preserve signer and return to file drop zone.

### Post-delete navigation in manage view
- **D-08:** Always-visible "Deploy new site" button in the manage view content area — not just on empty state. Disabled during active operations, enabled otherwise.
- **D-09:** This is in addition to the Deploy tab button — provides a more discoverable path to deploy from within the manage view.

### Claude's Discretion
- Exact button placement in manage view (top vs. bottom of site list)
- Button styling — primary (purple) vs. secondary treatment for "Deploy new site" in manage view
- Whether "Deploy another" on success screen resets to root deploy or preserves the last-used site type choice
- Animation for tab button disable/enable transition (if any)
- How to wire the disabled state — CSS `pointer-events: none` + opacity, or actual `disabled` attribute on button elements

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### SPA architecture
- `apps/spa/src/App.svelte` — Tab switching logic (`currentPage`), deploy state management, `handleDeploy()`, `resetDeploy()`/`resetForUpdate()`, success screen rendering, ManageSite integration
- `apps/spa/src/lib/store.js` — `deployState` store with step values: idle → reviewing → hashing → checking → uploading → publishing → success/error
- `apps/spa/src/components/ManageSite.svelte` — Manage view with site list, delete flow, `dispatch('deleted')` event

### Phase 13 context (leave confirmation)
- `.planning/phases/13-leave-confirmation/13-CONTEXT.md` — OperationBanner component, tab switching behavior during operations, DANGEROUS_DEPLOY_STEPS set

### Phase 14 context (delete animation)
- `.planning/phases/14-delete-animation/14-CONTEXT.md` — Card-level delete outcomes, per-card state overlay, concurrent deletes

### Research decisions
- `.planning/STATE.md` — "Post-action navigation to deploy must use resetForUpdate() not resetDeploy() to preserve signer"

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `resetForUpdate()` in App.svelte: resets deploy state back to file drop zone while preserving signer session — use for "Deploy another" button
- `resetDeploy()` in App.svelte: full reset including signer — NOT suitable for post-action navigation
- `OperationBanner.svelte` (Phase 13): already renders near tab area, provides operation context
- `currentPage` state variable: simple string assignment (`'deploy'` / `'manage'`) controls tab switching

### Established Patterns
- Tab buttons render in App.svelte around line 539-555 as styled buttons with `on:click={() => currentPage = 'deploy'/'manage'}`
- Deploy success screen renders conditionally on `$deployState.step === 'success'` with site URL, nsec backup, and "Update" button
- ManageSite dispatches events (`update`, `deleted`) to parent App.svelte

### Integration Points
- Tab button area in App.svelte: add disabled/enabled logic based on `isDangerousStep` (already computed for Phase 13 beforeunload)
- Deploy success screen in App.svelte: replace "Update" button with "Manage sites" + "Deploy another" buttons
- ManageSite.svelte: add "Deploy new site" button to manage view content area

</code_context>

<specifics>
## Specific Ideas

- User explicitly clarified: "Deploy new site" should always be visible in manage view, not just on empty state — "why isn't deploy new site always visible on this page already?"
- Tab buttons should be disabled (greyed out) not hidden — user wants to maintain spatial awareness of where they are in the app
- Replace the existing "Update" button on success screen rather than adding alongside — avoids clutter

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 15-post-action-navigation*
*Context gathered: 2026-03-25*
