# Phase 16: Deploy Guard — Research

**Researched:** 2026-03-25
**Status:** Complete

## Objective

Investigate how to implement deploy guards that warn users when they're about to overwrite an existing root or named site, offer an "Update" shortcut, and block deploys while site data is still loading.

## Existing Code Analysis

### Site Type Selection UI (App.svelte ~lines 844-898)

The site type selector is a pair of radio buttons (`root` / `named`) rendered during the `reviewing` step. Key state:

- `siteType = 'root'` (default) — bound via `bind:group={siteType}`
- `dTag = ''` — text input for named sites, sanitized on input (`toLowerCase().replace(/[^a-z0-9]/g, '')`)
- `dTagError` — reactive validation: format error if not matching `/^[a-z0-9]{1,13}$/`
- `dTagReadOnly = false` — set to `true` when entering update flow from manage view
- `canDeploy` — reactive: `siteType === 'root' || (dTag.length > 0 && dTagValid)`

### Site Data State (App.svelte ~lines 67-68)

```js
let allSites = { root: null, named: [] };
let sitesLoading = false;
```

- `allSites.root`: the most recent non-empty kind 15128 manifest event, or null
- `allSites.named`: array of most-recent-per-dTag non-empty kind 35128 manifest events
- `sitesLoading`: set to `true` during `fetchSiteInfo()`, set to `false` in finally block

### fetchSiteInfo (App.svelte ~lines 294-310)

Called:
1. On mount if session has pubkey (lines 147, 168)
2. On login (line 508)
3. After deploy success with 3s delay (line 484)
4. On site-removed event from ManageSite (line 595)

Sets `sitesLoading = true` at start, `false` in finally. Updates `allSites` and `existingManifest`.

### Update Flow Reference (App.svelte ~lines 566-581)

The manage view's `on:update` handler:
```js
on:update={(e) => {
  const site = e.detail;
  currentPage = 'deploy';
  if (site.kind === 35128) {
    siteType = 'named';
    dTag = getManifestDTag(site) || '';
    dTagReadOnly = true;
  } else {
    siteType = 'root';
    dTag = '';
    dTagReadOnly = false;
  }
  deployTitle = getManifestTitle(site);
  deployDescription = getManifestDescription(site);
  resetForUpdate();
}
```

This is the exact pattern to reuse for the deploy guard's "Update" button.

### Deploy Button (App.svelte ~lines 943-951)

```svelte
<button
  on:click={handleDeploy}
  disabled={!canDeploy}
  ...
>
  {$session.pubkey ? 'Deploy' : 'Deploy Anonymously'}
</button>
```

### Helper Functions (nostr.js)

- `getManifestDTag(event)` — extracts d-tag from event tags
- `getManifestTitle(event)` — extracts title from event tags
- `getManifestDescription(event)` — extracts description
- `fetchAllManifests(pubkey, relays)` — returns `{ root, named }` with dedup and empty-manifest filtering

## Implementation Approach

### 1. Root Site Guard

**Where:** Below the radio button group in the reviewing step (after line 868)

**Logic:** When `siteType === 'root'` AND `allSites.root !== null` AND user is logged in (`$session.pubkey`), show an inline warning banner.

**Warning content:**
- "You already have a root site deployed" message
- Show the site URL: `npub.NSITE_GATEWAY_HOST`
- Show file count and last published date (from `allSites.root.tags` and `allSites.root.created_at`)
- "Update existing site" button that triggers the same flow as manage's `on:update`

**"Update" button handler:**
```js
function handleGuardUpdate(site) {
  if (site.kind === 35128) {
    siteType = 'named';
    dTag = getManifestDTag(site) || '';
    dTagReadOnly = true;
  } else {
    siteType = 'root';
    dTag = '';
    dTagReadOnly = false;
  }
  deployTitle = getManifestTitle(site);
  deployDescription = getManifestDescription(site);
  resetForUpdate();
}
```

This reuses the same mechanism as the manage view update handler. The `resetForUpdate()` call preserves the signer while resetting deploy state back to idle/file-drop.

### 2. Named Site Guard

**Where:** Below the dTag input field, adjacent to the existing `dTagError` message (after line 895)

**Logic:** When `siteType === 'named'` AND `dTag.length > 0` AND `dTagValid` (format ok) AND there's a matching named site in `allSites.named`, show an inline warning.

**Matching logic:**
```js
$: matchingNamedSite = siteType === 'named' && dTag && dTagValid
  ? allSites.named.find(s => getManifestDTag(s) === dTag)
  : null;
```

This is reactive via Svelte's `$:` so it updates as the user types. The dTag input already has `on:input` sanitization, so matching runs after sanitization in the same reactive chain. No debounce needed — the match is a simple array find against a small in-memory list (typically <10 items).

**Warning content:**
- "You already have a named site with this identifier" message
- Show the site URL: `base36(dTag).NSITE_GATEWAY_HOST`
- Show file count and last published date
- "Update existing site" button (same handler as root guard)

### 3. Loading State Guard (GUARD-05)

**Where:** The `canDeploy` reactive statement and the deploy button

**Current:** `$: canDeploy = siteType === 'root' || (dTag.length > 0 && dTagValid);`

**Updated:** Add `sitesLoading` check:
```js
$: canDeploy = !sitesLoading && (siteType === 'root' || (dTag.length > 0 && dTagValid));
```

**Deploy button text:** When `sitesLoading` is true, show "Checking existing sites..." instead of "Deploy" / "Deploy Anonymously".

**Edge case — anonymous users:** Anonymous users who haven't logged in yet (`!$session.pubkey`) should NOT be blocked by loading state. They have no existing sites. The `sitesLoading` guard only applies when a session exists:
```js
$: canDeploy = ($session.pubkey ? !sitesLoading : true) && (siteType === 'root' || (dTag.length > 0 && dTagValid));
```

**Fetch failure handling:** Currently `fetchSiteInfo` catches errors and sets `allSites = { root: null, named: [] }`. This means on fetch failure, no guards show (user can deploy freely). This is acceptable — the warning-based pattern is additive safety, and blocking on unreliable connections would be hostile. No change needed here.

### 4. No-Existing-Sites Path (GUARD-05 success criteria 5)

When `allSites.root === null` AND `allSites.named.length === 0`, no guard warnings appear. The `matchingNamedSite` will be null, the root guard condition won't trigger, and the deploy flow is unchanged. This is automatic from the conditional rendering.

### 5. Site URL Construction

For the warning messages, need to construct site URLs:

**Root site URL:**
```js
`${NSITE_GATEWAY_PROTOCOL}://${npubEncode(hexToBytes($session.pubkey))}.${NSITE_GATEWAY_HOST}`
```
Already available via `$session.npub` and the `NSITE_GATEWAY_HOST` constant.

**Named site URL:**
```js
`${NSITE_GATEWAY_PROTOCOL}://${base36Encode(hexToBytes($session.pubkey))}.${NSITE_GATEWAY_HOST}/${dTag}`
```
Uses the existing `base36Encode` import.

## Key Decisions from CONTEXT.md

- **D-01:** Root option remains selectable (NOT disabled) — show warning on selection
- **D-05:** Warning + Update shortcut pattern (NOT soft block) — user CAN still deploy fresh
- **D-06:** Guard reads `allSites` (not `existingManifest`) and branches by `siteType`
- **D-07:** Deploy button blocked while `sitesLoading` is true

## Risk Assessment

**Low risk:** All changes are additive UI rendering in the reviewing step of App.svelte. No changes to data flow, deploy logic, or state management. The `canDeploy` change adds one boolean check. The guard handler reuses the proven manage-view update pattern.

**No component extraction needed:** The guards are small conditional blocks (warning + button) that don't warrant separate components. They live inline in the reviewing step markup.

## File Impact Summary

| File | Change Type | Scope |
|------|------------|-------|
| `apps/spa/src/App.svelte` | Modify | Add reactive `matchingNamedSite`, update `canDeploy` to check `sitesLoading`, add guard warning blocks in template, add `handleGuardUpdate()` helper |

All changes are in a single file. No new files, no new dependencies.

---

## RESEARCH COMPLETE
