# Phase 11: SPA Named Site Support - Context

**Gathered:** 2026-03-21
**Status:** Ready for planning

<domain>
## Phase Boundary

Add named site deploy support (kind 35128 with dTag), manifest metadata (title, description), and multi-site management to the SPA. Covers the full flow: deploy selector, dTag input with validation, metadata fields, manifest publishing for both kinds, and a multi-site Manage tab with per-site update/delete.

</domain>

<decisions>
## Implementation Decisions

### Deploy flow selector
- Root/named site toggle appears in the **reviewing step** (after files selected, before deploy button)
- **Radio buttons**: "Root site" (default selected) and "Named site"
- Selecting "Named site" reveals a dTag input field below
- dTag validated **inline as user types**: `^[a-z0-9]{1,13}$` — red border + error text when invalid, deploy button disabled while invalid
- Title and description text inputs **always visible** below the root/named selector (both root and named)
- Title: single-line text input, optional
- Description: multi-line textarea, optional

### Manifest publishing
- `buildManifest()` in `publish.js` needs new params: `kind` (15128 or 35128), `dTag` (optional), `title` (optional), `description` (optional)
- For kind 35128: add `['d', dTag]` tag to manifest event
- For both kinds: add `['title', title]` and `['description', description]` tags when non-empty
- `publishManifest()` passes these through to `buildManifest()`
- `publishEmptyManifest()` needs a variant that can publish kind 35128 with a dTag (for deleting named sites)

### Multi-site management
- Manage tab shows a **vertical card list** — one card per site (root + all named)
- Each card shows: site type badge ("Root" / "Named: {dTag}"), URL, publish date, file count
- Named site URLs use the **encoded format**: `<pubkeyB36><dTag>.nsite.run` — use `base36Encode` from `@nsite/shared`
- Click a card to expand it with Update/Delete actions
- `fetchExistingManifest()` needs to also query kind 35128 (no `#d` filter → returns ALL named sites for this pubkey)
- On load: fetch both kind 15128 (root) and kind 35128 (all named) in parallel

### Update flow for named sites
- Clicking "Update" on a named site card navigates to deploy tab with everything **pre-filled**:
  - Root/named toggle set to "Named"
  - dTag pre-filled (read-only — can't change dTag on update, that would create a new site)
  - Title and description pre-filled from existing manifest tags
  - User just drops new files and clicks Deploy

### Delete flow for named sites
- Existing ManageSite deletion flow works for named sites too
- `publishEmptyManifest()` needs to accept optional `dTag` param → publishes kind 35128 with empty paths + `['d', dTag]` tag
- `publishDeletionEvent()` unchanged — references manifest event ID regardless of kind

### Claude's Discretion
- Exact radio button styling
- Card expand/collapse animation
- How to handle the case where user has no sites (empty Manage tab)
- Whether description uses `<textarea>` or single-line input
- Loading state while fetching multiple site manifests

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### nsite spec
- NIP PR #1538: https://github.com/nostr-protocol/nips/pull/1538 — kind 15128/35128, d tag, title/description tags
- Readable spec: https://github.com/hzrd149/nips/blob/nsite/nsite.md — full manifest event structure

### SPA code
- `apps/spa/src/lib/publish.js` — `buildManifest()`, `publishManifest()`, `publishEmptyManifest()` — all need kind/dTag/metadata params
- `apps/spa/src/lib/nostr.js` — `fetchExistingManifest()` — needs to query kind 35128 too
- `apps/spa/src/components/ManageSite.svelte` — current single-site management, needs multi-site card list
- `apps/spa/src/App.svelte` — deploy flow state machine, reviewing step UI

### Shared package
- `packages/shared/src/base36.ts` — `base36Encode` for generating named site URLs in Manage tab

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `base36Encode` from `@nsite/shared` — encode pubkey hex to base36 for named site URL display
- `ManageSite.svelte` — existing deletion flow (4-state machine) reusable for named sites with minor adaptation
- `fetchExistingManifest()` in `nostr.js` — multi-relay query with `Promise.allSettled`, can be extended to query multiple kinds
- `buildManifest()` in `publish.js` — core manifest builder, just needs params for kind/dTag/metadata
- `AdvancedConfig.svelte` — collapsible section pattern if needed

### Established Patterns
- Radio/checkbox inputs in reviewing step: `spaFallback` checkbox exists in the reviewing section
- `createEventDispatcher` for child-to-parent communication
- Deploy state machine: idle → reviewing → hashing → checking → uploading → publishing → success
- Tabbed UI: Deploy/Manage tabs with `currentPage` state

### Integration Points
- `App.svelte` reviewing step (around line 590+) — add root/named toggle, dTag input, title/description fields
- `App.svelte:handleDeploy()` — pass site type, dTag, title, description to `publishManifest()`
- `App.svelte:fetchSiteInfo()` — extend to fetch both kind 15128 and 35128 manifests
- `ManageSite.svelte` — refactor from single-site to multi-site card list
- `publish.js:buildManifest()` — add kind, dTag, title, description params
- `publish.js:publishEmptyManifest()` — add optional dTag for named site deletion

</code_context>

<specifics>
## Specific Ideas

- dTag should be read-only when updating an existing named site — changing it would create a new site, not update
- Named site URL in Manage cards uses the real encoded URL (`<pubkeyB36><dTag>.nsite.run`) so users can copy/share it
- Title and description apply to both root and named sites (spec supports it on both)

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 11-spa-named-site-support*
*Context gathered: 2026-03-21*
