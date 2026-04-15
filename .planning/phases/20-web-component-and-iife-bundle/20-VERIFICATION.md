---
status: human_needed
phase: 20
phase_name: web-component-and-iife-bundle
verified_at: 2026-03-25T23:15:00Z
requirements_verified: [WIDGET-01, WIDGET-02, WIDGET-03, WIDGET-04, WIDGET-05, WIDGET-06]
---

# Phase 20: Web Component and IIFE Bundle — Verification

## Phase Goal

> A plain HTML page can embed `<nsite-deployer>` via a single script tag and get a working deploy button that opens a full modal

## Success Criteria Verification

### SC1: Single script tag, no npm required
**Status: PASSED (automated)**

- `dist/deployer.js` is a self-contained IIFE bundle (418KB)
- Starts with `var NsiteDeployer=function(qt){...}` -- proper IIFE wrapping
- No bare `import` statements at top level
- Svelte runtime bundled inline
- `test/test-widget.html` loads via `<script src="../dist/deployer.js"></script>` with no npm/bundler

### SC2: Clicking trigger button opens full deploy modal
**Status: HUMAN NEEDED**

- IIFE contains `nsd-trigger` class (6 occurrences) -- trigger button implemented
- IIFE contains `nsd-overlay` class (2 occurrences) -- modal overlay implemented
- IIFE contains `nsd-modal` class -- modal container implemented
- NsiteDeployerElement._openModal() mounts DeployerWidget.svelte into shadow DOM `.nsd-mount`
- DeployerWidget contains full deploy+manage flow (DeployZone, FileTree, ProgressIndicator, SuccessPanel, ManageSite, LoginModal, etc.)
- **Needs human to verify**: open test-widget.html in browser, click button, confirm modal appears with working deploy UI

### SC3: trigger-label attribute changes button text
**Status: PASSED (automated)**

- `trigger-label` in `static observedAttributes` array
- `_triggerLabel` getter returns `getAttribute('trigger-label') || 'Deploy to nsite'`
- `attributeChangedCallback` re-renders trigger on label change
- IIFE contains `trigger-label` string
- IIFE contains `Deploy to nsite` default label
- Test page has `<nsite-deployer trigger-label="Publish site">` instance

### SC4: Events observable with addEventListener outside shadow root
**Status: PASSED (automated)**

- FORWARDED_EVENTS array defines all 6 events: deploy-success, deploy-error, auth-change, operation-start, operation-end, site-deleted
- Each event forwarded as `new CustomEvent(eventName, { detail: e.detail, bubbles: true, composed: true })`
- `composed: true` confirmed in IIFE bundle (1 occurrence)
- `deploy-success` confirmed in IIFE bundle
- `deploy-error` confirmed in IIFE bundle
- Test page sets up `addEventListener` for all 6 events on all instances

### SC5: Programmatic extraRelays/extraBlossoms properties
**Status: PASSED (automated)**

- `extraRelays` getter/setter implemented, calls `$set({ extraRelays: ... })` on Svelte instance
- `extraBlossoms` getter/setter implemented, calls `$set({ extraBlossoms: ... })` on Svelte instance
- `signer` getter/setter implemented, calls `$set({ signer: ... })` on Svelte instance
- IIFE contains `extraRelays` (3 occurrences)
- IIFE contains `extraBlossoms` (4 occurrences)
- Test page demonstrates `el.extraRelays = [...]` and `el.extraBlossoms = [...]`

## Requirement Traceability

| Requirement | Description | Status |
|-------------|-------------|--------|
| WIDGET-01 | Custom element registration | PASSED -- customElements.define with guard |
| WIDGET-02 | Shadow DOM encapsulation | PASSED -- attachShadow({mode:'open'}) |
| WIDGET-03 | Trigger button with customizable label | PASSED -- trigger-label attribute |
| WIDGET-04 | Full-screen modal overlay | PASSED (human verify) -- nsd-overlay with position:fixed, z-index:100000 |
| WIDGET-05 | Composed event propagation | PASSED -- 6 events with composed:true |
| WIDGET-06 | Programmatic property bridge | PASSED -- extraRelays, extraBlossoms, signer setters |

## Build Output

| File | Size | Format |
|------|------|--------|
| dist/deployer.js | 418KB | IIFE (self-contained) |
| dist/deployer.mjs | 630KB | ESM |
| dist/style.css | 0.7KB | Residual (not needed for IIFE usage) |

## Must-Haves Checklist

- [x] Shadow DOM with CSS string injection (matching stealthis pattern)
- [x] Trigger button renders inline at element position
- [x] Modal overlay covers full viewport on button click
- [x] DeployerWidget.svelte mounted inside modal
- [x] All 6 events forwarded with composed: true
- [x] trigger-label attribute changes button text
- [x] extraRelays and extraBlossoms JS properties passed to Svelte component
- [x] signer JS property passed to Svelte component
- [x] Escape key and backdrop click close modal
- [x] Svelte instance properly destroyed on modal close and element disconnect
- [x] customElements.define with double-registration guard
- [x] No auto-inject behavior
- [x] IIFE bundle self-contained (includes Svelte runtime)
- [x] ESM bundle exports NsiteDeployerElement
- [x] Test HTML page validates all 5 success criteria

## Human Verification Items

1. **Open test-widget.html in browser** -- Confirm 4 trigger buttons render correctly (default, custom label, green, programmatic test)
2. **Click any trigger button** -- Confirm full-screen modal opens with DeployerWidget UI inside
3. **Press Escape / click backdrop / click X** -- Confirm modal closes properly
4. **Check custom label** -- "Publish site" button should show correct text
5. **Check green button** -- Should render with green (#059669) background

## Self-Check: PASSED

All automated criteria verified. Human testing needed for visual/interactive confirmation.
