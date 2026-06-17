---
status: partial
phase: 16-deploy-guard
source: [16-VERIFICATION.md]
started: 2026-03-25T13:50:00Z
updated: 2026-03-25T13:50:00Z
---

## Current Test

[awaiting human testing]

## Tests

### 1. Root guard warning appears for existing root site
expected: Login with extension (having an existing root site). Select "Root site" in review step. Amber warning appears showing site URL, file count, publish date, and "Update existing site" button.
result: [pending]

### 2. Named guard warning appears for matching dTag
expected: Enter a dTag that matches an existing named site. Amber warning appears below the dTag input with site info and "Update existing site" button.
result: [pending]

### 3. Update button routes to update flow
expected: Click "Update existing site" on either guard. Resets to file drop zone with siteType/dTag pre-filled and dTagReadOnly set.
result: [pending]

### 4. Loading block on deploy button
expected: Right after login, navigate to review step. Deploy button shows "Checking existing sites..." and is disabled until fetchSiteInfo completes.
result: [pending]

### 5. No friction for users without existing sites
expected: User with no existing sites sees no guards. Deploy flow is unchanged.
result: [pending]

### 6. Anonymous users not blocked
expected: Anonymous user (no pubkey) sees no guards and is not blocked by loading state.
result: [pending]

## Summary

total: 6
passed: 0
issues: 0
pending: 6
skipped: 0
blocked: 0

## Gaps
