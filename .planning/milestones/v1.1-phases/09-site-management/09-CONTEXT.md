# Phase 9: Site Management - Context

**Gathered:** 2026-03-20
**Status:** Ready for planning

<domain>
## Phase Boundary

Post-deploy site management: "Update Site" button returns user to file drop zone with same key, returning logged-in users see existing site info (URL, date, file count), and users can delete their nsite across all their relays and blossom servers. This is a decentralized operation — nsite.run is a reference implementation, not a centralized service. Deletion targets the user's relay list (NIP-65 kind 10002) and blossom server list (kind 10063), plus nsite.run.

</domain>

<decisions>
## Implementation Decisions

### Update flow after deploy
- "Update Site" button in SuccessPanel — prominent purple button alongside share actions (Visit Site, Share)
- Clicking "Update Site" resets deploy state to idle but KEEPS the signer/key intact
- User sees the file drop zone again and can drop new files to deploy with the same identity
- Functionally: call a variant of `resetDeploy()` that preserves `currentSigner`, `deployNsec`, and session state

### Returning user site info
- Info card appears ABOVE the deploy zone when a logged-in user has an existing published site
- Shows: site URL (clickable), last publish date (from manifest `created_at`), file count (from path tag count)
- Data source: query all relays from user's NIP-65 (kind 10002) relay list PLUS nsite.run, deduplicated. Pick the most recent kind 15128 manifest across all relays.
- Uses existing `queryRelay` pattern from nostr.js for one-shot WebSocket queries
- Fetch happens on login/session restore (not on every page load if already cached)
- If no manifest found: no info card shown, just the deploy zone

### Site deletion mechanism
- Deletion is a DECENTRALIZED operation — not "deleting from nsite.run" but "deleting your nsite from relays and blossom servers"
- Two-pronged approach:
  1. **Relays:** Publish empty manifest (kind 15128, zero path tags) AND kind 5 deletion event referencing the manifest event ID — to ALL relays from user's 10002 list + nsite.run, deduplicated
  2. **Blossoms:** Best-effort DELETE /{sha256} with kind 24242 auth on ALL blossom servers from user's 10063 list + nsite.run, deduplicated. Extract sha256 hashes from the existing manifest's path tags.
- Partial failures are expected — some servers may not support delete or may be unreachable. Report per-server results but don't block.

### Deletion confirmation UX
- Modal with scope summary: "Delete your nsite from N relays and M blossom servers"
- Lists the specific relay and blossom server URLs that will be contacted
- Red "Delete my nsite" button
- No type-to-confirm — the scope summary makes the blast radius clear

### Post-deletion UX
- Results summary showing per-server outcomes (relay: empty manifest published ✓, blossom: deleted N blobs ✓/✗)
- After dismissing results: return to idle deploy zone with no site info card
- Session/key remains intact — user can re-deploy if they want

### Claude's Discretion
- Info card visual design (colors, layout, spacing)
- How to handle the query loading state (skeleton, spinner, etc.)
- Delete progress indicator during the multi-server operation
- Whether to show the "Delete" button in the info card or only in a menu/dropdown
- Error handling for relay query failures during site info fetch

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### GitHub Issues
- GitHub issue #8 — Add an 'Update' button after a successful deploy
- GitHub issue #9 — Show existing site info when a returning user loads nsite.run
- GitHub issue #10 — Add a button to delete/destroy a published site

### Protocol
- BUD-02 spec (DELETE /{sha256} with kind 24242 auth) — blossom blob deletion
- NIP-09 (kind 5 deletion events) — nostr event deletion
- NIP-65 (kind 10002) — relay list for discovering user's relays
- Kind 10063 — blossom server list for discovering user's blossoms

No project-local spec files — requirements captured in decisions above, protocol specs are external.

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `nostr.js:queryRelay(url, filter)`: One-shot WebSocket query — can query for kind 15128 by pubkey to find existing manifest
- `nostr.js:fetchUserRelays(pubkey)` / `fetchUserBlossoms(pubkey)`: Already fetch kind 10002 and 10063 events — returns relay/blossom URLs
- `publish.js:buildManifest(files, servers, spaFallback)`: Can build empty manifest with `files=[]`
- `publish.js:publishToRelay(signedEvent, relayUrl)`: Publishes signed event to a single relay — can publish empty manifest and kind 5 events
- `upload.js`: Has BUD-02 auth event builder for blob operations — can be extended for DELETE auth
- `SuccessPanel.svelte`: Already shows site URL, share buttons, nsec display — "Update Site" button goes here
- `App.svelte:resetDeploy()`: Resets deploy state — needs a variant that preserves signer/key

### Established Patterns
- `queryRelay` uses raw WebSocket for one-shot queries (not RelayPool)
- `publishManifest` iterates relays sequentially, collects per-relay results
- Deploy flow state machine: idle → reviewing → hashing → uploading → publishing → success
- Session store drives navbar state and identity display

### Integration Points
- `App.svelte`: Add site info fetch on login/session restore. Add info card above deploy zone. Wire "Update" and "Delete" actions.
- `SuccessPanel.svelte`: Add "Update Site" button
- `publish.js`: Add `deleteManifest(signer, relays)` function — publishes empty manifest + kind 5
- `upload.js` or new `delete.js`: Add `deleteBlobs(signer, sha256List, blossomUrls)` function
- New component: `SiteInfoCard.svelte` — shows existing site info with Update/Delete actions
- New component: `DeleteConfirmModal.svelte` — scope summary modal with server list

</code_context>

<specifics>
## Specific Ideas

- Deletion must query the EXISTING manifest first to get sha256 hashes for blob deletion — can't delete blobs without knowing which ones belong to the site
- The relay query for site info on login can be reused as the data source for deletion (same manifest event)
- Empty manifest approach is elegant because it uses the existing replaceable event mechanism — no special gateway support needed
- Kind 5 is belt-and-suspenders alongside the empty manifest — some relays honor deletion requests and actually remove events

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 09-site-management*
*Context gathered: 2026-03-20*
