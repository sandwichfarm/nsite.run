---
status: human_needed
phase: 16-deploy-guard
verifier: inline
verified_at: 2026-03-25T13:50:00Z
score: 5/5
---

# Phase 16: Deploy Guard -- Verification

## Must-Have Checks

| # | Requirement | Status | Evidence |
|---|-------------|--------|----------|
| 1 | Root site option shows inline amber warning when user has existing root site (GUARD-01, GUARD-02) | PASS | `{#if siteType === 'root' && allSites.root && $session.pubkey && !dTagReadOnly}` renders amber warning box with site URL, file count, publish date, and "Update existing site" button calling `handleGuardUpdate(allSites.root)` |
| 2 | Named site dTag input shows inline amber warning when entered slug matches existing named site (GUARD-03, GUARD-04) | PASS | `{#if matchingNamedSite}` renders amber warning with site URL, file count, publish date, and "Update existing site" button calling `handleGuardUpdate(matchingNamedSite)`. Reactive `matchingNamedSite` matches via `allSites.named.find(s => getManifestDTag(s) === dTag)` |
| 3 | Both guards include "Update existing site" button routing to update flow (GUARD-02, GUARD-04) | PASS | `handleGuardUpdate(site)` sets siteType/dTag/dTagReadOnly/title/description and calls `resetForUpdate()` -- identical pattern to manage view's `on:update` handler |
| 4 | Deploy button disabled with "Checking existing sites..." text while sitesLoading (GUARD-05) | PASS | `canDeploy = ($session.pubkey ? !sitesLoading : true) && ...` blocks deploy during loading. Button text: `{#if sitesLoading}Checking existing sites...{:else if ...}` |
| 5 | Users with no existing sites see zero guards and deploy freely (GUARD-05) | PASS | Root guard requires `allSites.root` to be truthy. Named guard requires `matchingNamedSite` to be truthy. Both are null/falsy when no existing sites. Anonymous users bypass sitesLoading via `$session.pubkey` ternary. |

## Automated Verification

```
grep -c 'matchingNamedSite' apps/spa/src/App.svelte → 5 (>= 3 required)
grep -c 'handleGuardUpdate' apps/spa/src/App.svelte → 3 (>= 3 required)
grep -c 'NSITE_GATEWAY_HOST' apps/spa/src/App.svelte → 3 (>= 3 required)
grep -c 'Checking existing sites' apps/spa/src/App.svelte → 1 (== 1 required)
grep -c 'You already have a root site deployed' apps/spa/src/App.svelte → 1 (== 1 required)
grep -c 'You already have a named site with this identifier' apps/spa/src/App.svelte → 1 (== 1 required)
```

All automated checks PASS.

## Build Verification

SPA builds successfully with `npx vite build` -- no errors, no new warnings.

## Requirement Traceability

| Requirement | Plan Task | Implementation | Status |
|-------------|-----------|----------------|--------|
| GUARD-01 | Task 3 | Root guard conditional block in reviewing step | Implemented |
| GUARD-02 | Task 3 | "Update existing site" button in root guard | Implemented |
| GUARD-03 | Task 1, 4 | matchingNamedSite reactive + named guard block | Implemented |
| GUARD-04 | Task 4 | "Update existing site" button in named guard | Implemented |
| GUARD-05 | Task 2, 5 | canDeploy sitesLoading gate + button loading text | Implemented |

## Design Note

GUARD-01 requirement text says "Root site option is disabled." The plan's research decided on an amber inline warning rather than disabling the option, because:
- The phase goal says "clear warning showing what exists and an explicit confirmation to proceed" -- a warning with an update shortcut achieves this
- Disabling the option would prevent intentional overwrites entirely (too restrictive)
- The amber warning pattern is consistent with existing file warnings in the app

The implementation shows a warning and offers an update shortcut, but does not prevent the user from proceeding with a fresh deploy if they choose to.

## Human Verification Items

The following items require manual testing in a browser:

1. **Root guard**: Login with extension (having an existing root site). Select "Root site" in review step. Verify amber warning appears with site URL, file count, publish date, and "Update existing site" button.
2. **Named guard**: Enter a dTag that matches an existing named site. Verify amber warning appears below the dTag input with site info and "Update existing site" button.
3. **Update button routing**: Click "Update existing site" on either guard. Verify it resets to file drop zone with siteType/dTag pre-filled and dTagReadOnly set.
4. **Loading block**: Right after login, navigate to review step. Verify deploy button shows "Checking existing sites..." and is disabled until fetchSiteInfo completes.
5. **No friction path**: User with no existing sites sees no guards. Deploy flow is unchanged.
6. **Anonymous path**: Anonymous user (no pubkey) sees no guards and is not blocked by loading state.

---
*Phase: 16-deploy-guard*
*Verified: 2026-03-25*
