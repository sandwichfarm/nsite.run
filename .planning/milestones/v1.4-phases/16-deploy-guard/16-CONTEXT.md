# Phase 16: Deploy Guard - Context

**Gathered:** 2026-03-25
**Status:** Ready for planning

<domain>
## Phase Boundary

Prevent accidental overwrite of existing root and named sites during the deploy flow. When a user selects a site type or enters a dTag that matches an existing site, show an inline warning with site info and an "Update" button. Block deploy while site data is still loading after login. Users with no existing sites see no guards and deploy freely.

</domain>

<decisions>
## Implementation Decisions

### Root site guard
- **D-01:** Root site option remains selectable (NOT disabled) when user has an existing root site. Selecting it shows an inline warning: "You already have a root site at npub1xxx.nsite.run. This will update it."
- **D-02:** Existing site info visibility timing — Claude's discretion (always visible next to option vs. on selection only).

### Named site guard
- **D-03:** dTag input check trigger — Claude's discretion (debounced on-input vs. on-blur, balancing responsiveness with avoiding flicker).
- **D-04:** When dTag matches existing named site, show inline warning below the input field identifying the existing site, with an "Update" button. Same "selectable with warning" pattern as root guard — no blocking.

### Guard approach
- **D-05:** Warning + Update shortcut pattern (NOT soft block). Requirements explicitly exclude "blocking deploy button when site exists." User sees the warning, has the "Update instead" shortcut, but can still proceed with a fresh deploy if they choose.
- **D-06:** Guard reads `allSites` (not `existingManifest`) and branches by `siteType` to avoid false positives — locked from research.

### Loading state guard
- **D-07:** Deploy button blocked with "checking existing sites..." while site data is loading after login. No deploy can proceed on stale data.
- **D-08:** Fetch failure handling — Claude's discretion (allow with warning vs. block with retry, balancing safety with usability on unreliable connections).

### Update flow routing
- **D-09:** "Update" button in deploy guard reuses same mechanism as manage view's "Update Site" — Claude's discretion on exact implementation (in-place mode switch via resetForUpdate + pre-fill vs. navigate to manage).

### Claude's Discretion
- Root site info visibility timing (always vs. on selection)
- dTag check trigger timing (debounced on-input vs. on-blur)
- Fetch failure handling (allow with warning vs. block with retry)
- Update routing mechanism (in-place vs. navigate to manage)
- Warning styling (amber, red, or other color scheme)
- "Update" button placement relative to warning text
- Whether to show file count / last published date in the warning

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### SPA deploy flow
- `apps/spa/src/App.svelte` — Site type selection (siteType, dTag, dTagError, dTagReadOnly), `allSites` state, `fetchSiteInfo()`, `resetForUpdate()`, deploy button enable logic (`canDeploy`), site type radio buttons (lines ~850-895)
- `apps/spa/src/lib/store.js` — `deployState` store, `session` store with pubkey

### Manage view update flow (reference implementation)
- `apps/spa/src/App.svelte` lines 566-581 — `on:update` handler that sets siteType, dTag (read-only), calls resetForUpdate(). This is the existing update routing pattern to reuse.

### Requirements
- `.planning/REQUIREMENTS.md` — GUARD-01 through GUARD-05 requirements, explicitly out of scope items (typed confirmation, blocking deploy button)

### Prior phase context
- `.planning/phases/15-post-action-navigation/15-CONTEXT.md` — Tab button disable/enable during operations, "Deploy another" uses resetForUpdate()
- `.planning/phases/14-delete-animation/14-CONTEXT.md` — Per-card delete state, allSites update after deletion

### Research decisions
- `.planning/STATE.md` — "Deploy guard must read allSites (not existingManifest) and branch by siteType to avoid false positives"

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `allSites` state in App.svelte: `{ root: event|null, named: event[] }` — already fetched after login via `fetchSiteInfo()`. Guards can check this directly.
- `resetForUpdate()`: resets deploy state to file drop zone while preserving signer — exact mechanism needed for "Update" routing.
- `dTagError` / `dTagValid` reactive statements: already validate dTag format — guard warning can hook into similar reactive pattern.
- `getManifestDTag()`, `getManifestTitle()`: extract metadata from manifest events — useful for displaying existing site info in warnings.

### Established Patterns
- Site type selection: radio buttons with `bind:group={siteType}` — guard warning can be a conditional block below the radio group.
- dTag input: `on:input` handler with regex sanitization — guard check can run after sanitization in same reactive chain.
- `dTagReadOnly` flag: already used for update flow to prevent dTag editing — reusable when routing to update.

### Integration Points
- Site type selection UI (App.svelte ~lines 850-895): guard warnings render here, conditionally based on allSites data.
- `canDeploy` reactive statement: needs to also check `sitesLoading` state to block during fetch.
- `fetchSiteInfo()`: may need a loading state flag (`sitesLoading`) that doesn't currently exist — guards check this to show "checking existing sites..."

</code_context>

<specifics>
## Specific Ideas

- User clarified the update flow already exists via manage view — guards are specifically about the deploy flow's site type selection step, where users currently get no warning about existing sites.
- "Selectable with warning" pattern chosen over "disabled" — user explicitly preferred it for root site guard. Consistent pattern for named sites too.
- Requirements explicitly exclude blocking deploy button — guards are informational + offer shortcut, not gatekeeping.

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 16-deploy-guard*
*Context gathered: 2026-03-25*
