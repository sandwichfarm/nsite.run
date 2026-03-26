# Phase 20: Web Component and IIFE Bundle — Research

**Researched:** 2026-03-25
**Confidence:** HIGH (stealthis reference implementation inspected, Vite widget config verified, Svelte custom element behavior documented)

---

## Research Question

"What do I need to know to PLAN Phase 20 well — building a vanilla HTMLElement wrapper that mounts DeployerWidget into the DOM, produces a self-contained IIFE+ESM bundle, and provides button-to-modal UX?"

---

## 1. Shadow DOM vs No Shadow DOM Decision

### The Core Trade-off

The deployer components use Tailwind CSS classes. Shadow DOM provides CSS encapsulation but blocks global Tailwind styles from reaching elements inside the shadow root (Pitfall 22).

### Strategy: Shadow DOM with CSS String Injection

The CONTEXT.md requires prototyping both approaches (D-01, D-02). However, the stealthis reference implementation already demonstrates the winning pattern:

1. **`attachShadow({ mode: 'open' })`** — creates isolated CSS scope
2. **CSS as a string constant** — injected via `<style>${STYLES}</style>` inside the shadow root
3. **No Tailwind dependency** — all styles are hand-written CSS in a `styles.ts` equivalent

This eliminates the Tailwind problem entirely: the Web Component wrapper does NOT use Tailwind. It uses a self-contained CSS string for the trigger button, modal overlay, and modal container. The DeployerWidget Svelte component inside the modal uses Vite's `css: 'injected'` mode (from the Phase 17 widget config) which inlines Svelte-scoped styles into each component.

### What Needs Prototyping

The prototype should validate:
1. That Svelte component styles (compiled with `css: 'injected'`) render correctly inside a shadow root
2. That the modal overlay covers the full viewport (not just the shadow root container)
3. That focus trapping works across shadow DOM boundary
4. Bundle size comparison: shadow vs no-shadow

### Recommendation

Use `shadow: 'open'` with a CSS string constant for the wrapper's own styles (button, modal overlay). Svelte's `css: 'injected'` handles component-scoped styles. This matches the proven stealthis pattern.

---

## 2. HTMLElement Wrapper Architecture

### Key Design from stealthis

The stealthis `widget.ts` (629 lines) provides the exact architectural pattern:

```
NsiteDeployButton extends HTMLElement
├── constructor()
│   └── attachShadow({ mode: 'open' })
├── static observedAttributes = ['label']
├── attributeChangedCallback() → re-render
├── State machine: idle → auth → loading → form → deploying → success → error
├── render() → innerHTML replacement + bind() for event delegation
└── Modal: overlay div with centered modal container
```

### Differences for nsite-deployer

The nsite-deployer wrapper is SIMPLER than stealthis because:

1. **No internal auth/deploy logic** — DeployerWidget.svelte handles everything
2. **No state machine** — wrapper only tracks: `idle` (showing button) vs `open` (showing modal)
3. **No form rendering** — the Svelte component renders all forms inside the modal
4. **Mount point, not template** — wrapper creates a mount point, Svelte fills it

### Architecture

```
NsiteDeployerElement extends HTMLElement
├── constructor()
│   └── attachShadow({ mode: 'open' })
├── connectedCallback()
│   └── render trigger button
├── disconnectedCallback()
│   └── destroy Svelte component
├── static observedAttributes = ['trigger-label', 'trigger-color', 'trigger-bg', 'default-relay', 'default-blossom']
├── attributeChangedCallback() → update trigger / pass props
├── Properties: extraRelays, extraBlossoms, signer (JS-only)
├── openModal() → create overlay + mount DeployerWidget.svelte
├── closeModal() → unmount + remove overlay
└── Event forwarding: listen to Svelte dispatches → re-dispatch as composed CustomEvents
```

---

## 3. Svelte Component Mounting Inside Shadow DOM

### How to Mount

```javascript
import DeployerWidget from '../components/DeployerWidget.svelte';

// Inside openModal():
const mountPoint = document.createElement('div');
this.modalContainer.appendChild(mountPoint);

this.svelteInstance = new DeployerWidget({
  target: mountPoint,
  props: {
    signer: this.signer,
    extraRelays: this._extraRelays,
    extraBlossoms: this._extraBlossoms,
    defaultRelay: this.getAttribute('default-relay'),
    defaultBlossom: this.getAttribute('default-blossom'),
  }
});
```

### Event Forwarding

DeployerWidget dispatches Svelte events via `createEventDispatcher`. The HTMLElement wrapper listens and re-dispatches:

```javascript
this.svelteInstance.$on('deploy-success', (e) => {
  this.dispatchEvent(new CustomEvent('deploy-success', {
    detail: e.detail,
    bubbles: true,
    composed: true  // crosses shadow DOM boundary
  }));
});
```

Per Pitfall 26, `composed: true` is required for events to cross the shadow root boundary.

### Prop Synchronization

- **HTML attributes** → `observedAttributes` + `attributeChangedCallback` → pass to Svelte via `$set`
- **JS properties** → setter functions → pass to Svelte via `$set`
- **Signer property** → special handling: if set before DOM insertion, buffer and apply in `connectedCallback` (Pitfall 23)

---

## 4. Modal UX Design

### Pattern from stealthis

```html
<style>${STYLES}</style>
<button class="trigger">${label}</button>
<!-- When open: -->
<div class="overlay">
  <div class="modal">
    <!-- DeployerWidget mounts here -->
  </div>
</div>
```

### Key Behaviors

1. **Trigger button** renders inline where `<nsite-deployer>` is placed (D-05)
2. **Click** opens full-screen modal overlay (D-06)
3. **Escape key** closes modal (D-07)
4. **Backdrop click** closes modal (D-07)
5. **Button text** customizable via `trigger-label` attribute (D-08)
6. **Button styling** customizable via `trigger-color` and `trigger-bg` attributes (D-09)

### Modal Positioning

The overlay must be `position: fixed; inset: 0;` to cover the full viewport. This works correctly even inside a shadow root because `position: fixed` is relative to the viewport, not the shadow host.

### Z-index Strategy

Use a high z-index (e.g., 100000) matching stealthis. Since the overlay is inside shadow DOM, it won't conflict with the host page's z-index stacking context unless the host page has a stacking context on an ancestor of the custom element.

---

## 5. Build Pipeline

### Existing Infrastructure

`vite.widget.config.js` (Phase 17) already configures:
- Entry: `src/widget/index.js`
- IIFE global name: `NsiteDeployer`
- Formats: `['iife', 'es']`
- Output: `dist/deployer.js` and `dist/deployer.mjs`
- Svelte plugin with `css: 'injected'`
- `inlineDynamicImports: true`
- `cssCodeSplit: false`

### What Phase 20 Changes

1. Replace `src/widget/index.js` placeholder with real entry point
2. Entry point imports NsiteDeployerElement, registers it, exports it
3. No changes to vite.widget.config.js needed (it's already correctly configured)

### Bundle Contents

The IIFE bundle will contain:
- NsiteDeployerElement (vanilla HTMLElement wrapper)
- DeployerWidget.svelte (compiled, with CSS injected)
- All sub-components (compiled, with CSS injected)
- All lib code (nostr, upload, publish, crypto, files, store, scanner, base36)
- Svelte runtime (bundled in, not externalized — this is the IIFE standalone bundle)
- All npm dependencies (nostr-tools, applesauce-signers, fflate, nanotar, etc.)

Expected bundle size: 300-500KB (noted in STATE.md as acceptable).

---

## 6. Event Contract

Events from CONTEXT.md D-15, D-16:

| Event | Detail | Source |
|-------|--------|--------|
| `deploy-success` | `{pubkey, siteType, dTag, url}` | DeployerWidget |
| `deploy-error` | `{error, step}` | DeployerWidget |
| `auth-change` | `{pubkey, signerType, authenticated}` | DeployerWidget |
| `operation-start` | `{type, siteId}` | DeployerWidget |
| `operation-end` | `{type, siteId, success}` | DeployerWidget |
| `site-deleted` | `{siteId}` | DeployerWidget |

All re-dispatched from the HTMLElement with `composed: true, bubbles: true`.

---

## 7. Test Strategy

### Manual Test Page

Create `packages/deployer/test/test-widget.html`:
```html
<!DOCTYPE html>
<html>
<head><title>nsite-deployer test</title></head>
<body>
  <h1>Widget Test</h1>
  <nsite-deployer trigger-label="Publish site"></nsite-deployer>
  <script src="../dist/deployer.js"></script>
  <script>
    document.querySelector('nsite-deployer')
      .addEventListener('deploy-success', e => console.log('deployed!', e.detail));
  </script>
</body>
</html>
```

### Acceptance Verification

1. Open test page → trigger button visible with custom label
2. Click trigger → modal opens with deploy flow
3. Press Escape → modal closes
4. Set `extraRelays` programmatically → verify relay used during upload
5. Listen for `deploy-success` event → verify it fires with composed: true

---

## 8. Risk Assessment

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|------------|
| Svelte CSS not rendering in shadow root | LOW | HIGH | css: 'injected' mode proven; prototype validates |
| Fixed-position overlay clipped by shadow host stacking context | LOW | MEDIUM | Test in various DOM nesting scenarios |
| window.nostr unavailable at custom element init time | MEDIUM | LOW | Pitfall 26 documents this; use polling/retry |
| Bundle size exceeds 500KB | MEDIUM | LOW | Acceptable; optimize later with tree-shaking |
| Phase 19 (DeployerWidget.svelte) not complete | HIGH | BLOCKER | Phase 20 depends on Phase 19; plans must account for this |

---

## 9. File Inventory

### Files to Create
- `packages/deployer/src/widget/NsiteDeployerElement.js` — HTMLElement wrapper class
- `packages/deployer/src/widget/styles.js` — CSS string constant for wrapper (button, overlay, modal)
- `packages/deployer/src/widget/index.js` — Entry point (replace placeholder)
- `packages/deployer/test/test-widget.html` — Manual test page

### Files to Modify
- None — vite.widget.config.js and package.json already correct from Phase 17

### Files to Read (Dependencies)
- `packages/deployer/src/components/DeployerWidget.svelte` — Phase 19 output (not yet created)
- `packages/deployer/src/lib/*.js` — All lib modules (already extracted)
- `packages/deployer/vite.widget.config.js` — Build config (already correct)

---

## RESEARCH COMPLETE

Research covers all technical decisions needed for planning Phase 20. The stealthis reference implementation provides a proven pattern for every major decision: shadow DOM, CSS injection, modal UX, event handling. The main complexity is in the HTMLElement-to-Svelte bridge and event forwarding, both well-understood patterns.
