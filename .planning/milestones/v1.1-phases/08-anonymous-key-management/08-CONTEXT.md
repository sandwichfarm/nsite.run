# Phase 8: Anonymous Key Management - Context

**Gathered:** 2026-03-20
**Status:** Ready for planning

<domain>
## Phase Boundary

Protect anonymous users from losing their generated private key across navigation, page reload, and logout. Persist the anonymous key in sessionStorage, add a logout confirmation modal with backup actions, and offer nsec file download as the primary backup method. Does NOT include site info display for returning users (that's Phase 9).

</domain>

<decisions>
## Implementation Decisions

### Session persistence
- Store anonymous private key as hex string in sessionStorage (not localStorage) — clears when tab closes, lower risk
- Use a dedicated sessionStorage key (e.g., `nsite_anon_key`), separate from the `session` store which has nsec sanitization
- On page load, detect hex key in sessionStorage → auto-reconstruct signer → restore session state (pubkey, npub, signerType='anonymous')
- User can deploy again immediately on return without any prompt

### Logout confirmation
- Anonymous users only — extension and NIP-46 users manage keys externally, no confirmation needed
- Modal dialog (matching existing LoginModal/NIP46Dialog pattern): "You'll lose access to your site. Back up your nsec first."
- Download button + clipboard copy button inside the modal
- "I've backed up my key" checkbox enables the Logout button
- On confirmed logout: clear sessionStorage key, clear session store, return to unauthenticated state

### nsec backup method
- File download as primary action, clipboard copy as secondary
- File contains plain text nsec only (nsec1... string, nothing else)
- Filename: `nsite-nsec-{npub-prefix}.txt` (e.g., `nsite-nsec-npub1abc.txt`)
- Download button appears in TWO places:
  1. SuccessPanel (after deploy) — alongside existing clipboard copy
  2. Logout confirmation modal — for last-chance backup
- Implementation: create Blob with nsec text, create object URL, trigger download via anchor click

### Returning anonymous UX
- Same deploy zone as usual — no special returning user view (Phase 9 scope)
- Session auto-restored: navbar shows their anonymous identity
- Navbar shows subtle "Anonymous" badge/label next to truncated npub to distinguish from permanent identities

### Claude's Discretion
- Exact "Anonymous" badge styling (color, position, font size)
- Whether to show a small nsec backup reminder icon in the navbar for anonymous sessions
- sessionStorage key name
- Order of download vs copy buttons in SuccessPanel

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### GitHub Issues
- GitHub issue #12 — Improve anonymous mode / avoid losing the account
- GitHub issue #13 — Improve the nsec backup

No external specs — requirements fully captured in decisions above and the GitHub issues.

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `store.js:persistedStore()`: localStorage-backed writable store. Not used directly for sessionStorage, but pattern can inform a `sessionStore()` helper.
- `store.js:session`: Writable store with nsec sanitization. Anonymous session still uses this for pubkey/npub/signerType — just not for the private key itself.
- `LoginModal.svelte` / `NIP46Dialog.svelte`: Existing modal patterns with backdrop, close buttons, dark theme. Logout confirmation modal should match.
- `SuccessPanel.svelte:copyNsec()`: Existing clipboard copy function. Download function goes alongside it.
- `App.svelte:createAnonymousSigner()`: Returns `{signer, pubkey, nsec}`. Currently stores `deployNsec` in component state only.

### Established Patterns
- Svelte writable stores with `subscribe`/`set`/`update`
- `persistedStore(key, default)` for localStorage persistence
- Modal components use `export let onClose` prop and backdrop click to dismiss
- `navigator.clipboard.writeText()` for copy with visual feedback (copied state → timeout reset)

### Integration Points
- `App.svelte`: After `createAnonymousSigner()`, save hex key to sessionStorage. On mount, check sessionStorage and reconstruct if found.
- `Navbar.svelte:logout()`: Check `$session.signerType === 'anonymous'` → show confirmation modal instead of immediate clear
- `SuccessPanel.svelte`: Add download button next to existing copy button
- New component: `LogoutConfirmModal.svelte` (or inline in Navbar)

</code_context>

<specifics>
## Specific Ideas

- sessionStorage chosen over localStorage specifically because the user's mental model is "my session" not "my permanent account" — closing the tab should end it
- Hex format in sessionStorage avoids triggering the existing nsec sanitizer if the key accidentally leaks to the session store
- The checkbox confirmation ("I've backed up my key") is important — it's a deliberate friction point to prevent accidental key loss

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 08-anonymous-key-management*
*Context gathered: 2026-03-20*
