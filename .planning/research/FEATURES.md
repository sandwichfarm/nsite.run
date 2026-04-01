# Feature Research

**Domain:** Reusable Svelte deployer component + Web Component bundle for nsite.run
**Researched:** 2026-03-25
**Confidence:** HIGH (codebase directly inspected; Svelte/Web Component docs verified)

---

## Context: What Already Exists

The v1.4 SPA has a complete, working deploy flow hardwired into `apps/spa/src/App.svelte`. The business logic (hash, check, upload, publish, delete) lives in `apps/spa/src/lib/`. This milestone extracts that logic into `packages/deployer` and exposes it as:

1. A Svelte component importable into other Svelte projects (`@nsite/deployer`)
2. A Web Component bundle (IIFE + ESM) for embedding in plain HTML pages or nsites

The SPA then becomes a thin consumer of the component — it does not duplicate logic.

---

## Feature Landscape

### Table Stakes (Users Expect These)

These are non-negotiable for the component to be useful as a library.

| Feature | Why Expected | Complexity | Notes |
|---------|--------------|------------|-------|
| Full deploy flow as single component | A "deployer component" that doesn't deploy is useless | HIGH | Orchestrates: files-selected → hash → check → upload → publish → success |
| Optional external signer prop | Consumers may already have an authenticated signer (their own auth flow) | MEDIUM | `signer` prop: if null, built-in auth modal activates; if provided, skips auth entirely |
| Built-in auth fallback when no signer | Most embeds will not supply a signer; component must be self-sufficient | MEDIUM | NIP-07 extension, NIP-46 bunker, anonymous ephemeral key — existing LoginModal logic |
| Manage (view/update/delete) capability | Deploy without manage is half the surface area consumers need | MEDIUM | Wraps existing ManageSite component; needs signer for delete operations |
| Deploy completion event | Consumers need to know when deploy succeeds to update their own UI | LOW | on:deploy-success with typed detail payload |
| Deploy error event | Consumers must be able to surface errors in their own error handling | LOW | on:deploy-error with error string in detail |
| Configurable relay + blossom endpoints | Consumers may target different infrastructure (not just nsite.run) | LOW | Props: relay, blossom, gatewayHost — defaulting to nsite.run values |
| Named site support | Already implemented in SPA; component must not regress this | MEDIUM | Props or internal UI for siteType and dTag selection |
| beforeunload protection | Prevents data loss during in-progress operations | LOW | Already implemented reactively in App.svelte; must work inside component boundary |

### Differentiators (Competitive Advantage)

Features that make this component genuinely embeddable and useful beyond nsite.run.

| Feature | Value Proposition | Complexity | Notes |
|---------|-------------------|------------|-------|
| Web Component IIFE bundle (single script tag) | Enables embedding in any static site, nsite, or CMS without a build pipeline | HIGH | Vite lib mode with format: 'iife'; must inline Svelte runtime + Tailwind; shadow DOM for CSS isolation |
| Shadow DOM with CSS custom properties for theming | Web Component consumers can theme without fighting shadow DOM encapsulation | MEDIUM | Expose --deployer-accent, --deployer-bg, --deployer-text, --deployer-radius on :host; all internal vars reference these |
| Button-to-modal UX mode for Web Component | Mimics @nsite/stealthis — a single "Deploy to nsite" button that opens a full-featured modal | MEDIUM | nsite-deployer renders a trigger button; click opens modal overlay; trigger-label attribute controls button text |
| Signer duck-typing (not class-bound) | Accept any object with getPublicKey() + signEvent() — not locked to applesauce-signers | LOW | Enables consumers using nostr-tools NDK, other signer implementations, or custom signers |
| Server config props (not localStorage-only) | Library consumers may want programmatic relay/blossom injection without touching localStorage | LOW | Props extraRelays, extraBlossoms supplement or replace the persisted serverConfig store |
| ESM export for Svelte project import | Consumers in Svelte projects import the uncompiled .svelte file; Svelte optimizes at their build step | LOW | Standard svelte-package or Vite lib mode with format: 'es' + .svelte source export in package.json exports map |

### Anti-Features (Commonly Requested, Often Problematic)

| Feature | Why Requested | Why Problematic | Alternative |
|---------|---------------|-----------------|-------------|
| Headless / renderless mode (logic only, no UI) | Developers want full control over markup | The deploy flow has intrinsic state complexity (7 steps, per-server progress, give-up UX); headless forces every consumer to reimplement it; doubles maintenance surface | Expose good CSS custom property hooks and a class prop so consumers restyle without reimplementing |
| iFrame embed approach | Simplest possible "one URL embed" | iFrames cannot share the parent page's window.nostr extension; NIP-07 auth breaks; cross-origin postMessage required to bridge signer — enormous complexity for no gain | Web Component with explicit signer prop; parent passes signer object through |
| Global Svelte store export | Consumers want to read deploy state reactively | Leaks internal state shape as public API; any refactor breaks consumers; store keys collide with consumer's own stores | Emit typed events / callback props; keep internal stores internal |
| Theming via CSS class injection into shadow DOM | Consumers want to use their existing Tailwind classes | Shadow DOM blocks external class selectors by design; injecting classes circumvents encapsulation and breaks on Tailwind purge | CSS custom properties on :host; alternatively shadow="none" variant for Svelte-to-Svelte consumption |
| Automatic relay/blossom discovery without user opt-in | "Smart defaults" that just work | Querying user's NIP-65/10063 lists without their knowledge is a privacy concern in an embeddable context; silent network activity surprises consumers | Explicit autoDiscover boolean prop (default: true in SPA, false in Web Component); always document what network calls are made |
| Anonymous key auto-persist across hosts | Convenient for testing | An anonymous key persisted in one host's sessionStorage cannot be read by a component embedded on a different origin; causes silent identity loss in embed context | In Web Component mode, skip anonymous key persistence by default; warn consumer to handle identity persistence themselves |

---

## Feature Dependencies

```
Web Component bundle
    requires  Shadow DOM + CSS custom properties theming
    requires  Button-to-modal UX mode
    requires  IIFE build output (Vite lib mode)

External signer prop
    requires  Signer duck-typing interface (not class-locked)
    enables   Built-in auth flow to be skipped entirely

Built-in auth fallback
    requires  NIP-07 support (existing ExtensionSigner)
    requires  NIP-46 support (existing NostrConnectSigner)
    requires  Anonymous key generation (existing PrivateKeySigner)

Manage capability
    requires  External signer prop (delete needs signing)
    requires  Relay + blossom endpoint props

Named site support
    requires  dTag prop / internal UI (existing base36 + kind 35128 logic)

Server config props
    enhances  Relay + blossom endpoint props

Deploy completion event  enhances  External signer prop
Deploy error event       enhances  External signer prop

beforeunload protection  conflicts  Web Component button-to-modal UX
    (modal close should cancel guard; component must manage its own guard scope)
```

### Dependency Notes

- **Web Component requires shadow DOM**: Tailwind classes embedded in the bundle will clash with the consumer page's CSS without shadow DOM. The `shadow: "open"` Svelte option (or `css="injected"`) is mandatory for the IIFE bundle to work safely. Svelte-to-Svelte import can use `shadow: "none"` because scoped styles suffice.

- **External signer prop requires duck-typing**: The existing lib code accepts any object with `{ signEvent }`. The component prop interface must document this contract explicitly (not typed to `PrivateKeySigner` or applesauce class). This is LOW complexity — it is already how `ManageSite` works (`export let signer = null`).

- **beforeunload conflicts with modal UX**: The existing App.svelte reactive `beforeunload` guard works well for a full-page SPA. Inside a modal Web Component, the guard must activate when the modal is open and a deploy is in progress, and deactivate when the modal is closed (even if a deploy is running). This needs explicit handling: closing the modal mid-deploy should trigger a "are you sure?" confirm, not the browser default dialog.

- **Anonymous key persistence conflicts with cross-origin embeds**: The existing `ANON_KEY_STORAGE_KEY` uses `sessionStorage` keyed to the SPA origin. When the Web Component is embedded on `my-nsite.npub1xxx.nsite.run`, sessionStorage is isolated by origin. Returning users will not have their anonymous key. This is a documented limitation, not a bug to fix in this milestone.

---

## MVP Definition

### Launch With (v1 — packages/deployer)

These features are required to call the milestone complete.

- [ ] Core lib layer extracted (`packages/deployer/src/lib/`) — nostr.js, upload.js, publish.js, crypto.js, files.js, scanner.js, base36.js moved out of SPA
- [ ] `NsiteDeployer` Svelte component — full deploy + manage flow, accepts signer, relay, blossom, gatewayHost props, emits deploy-success and deploy-error events
- [ ] Optional signer prop — null triggers built-in auth (NIP-07, NIP-46, anonymous); non-null skips auth modal
- [ ] Web Component IIFE bundle — `packages/deployer/dist/nsite-deploy.js` single-file embed
- [ ] Button-to-modal UX — `<nsite-deployer trigger-label="Deploy to nsite">` renders trigger, click opens full modal
- [ ] CSS custom properties — minimum set: --deployer-accent, --deployer-bg, --deployer-text on :host
- [ ] SPA refactored to import @nsite/deployer — no duplicate logic between SPA and package
- [ ] deploy-success / deploy-error events emitted with typed detail payload

### Add After Validation (v1.x)

- [ ] `extraRelays` / `extraBlossoms` props — programmatic server injection without localStorage
- [ ] `autoDiscover` boolean prop — opt-in NIP-65/10063 relay discovery (default false in Web Component)
- [ ] ESM module export (.mjs) alongside IIFE for modern bundler consumers
- [ ] shadow="none" variant for Svelte-to-Svelte consumers who want to apply their own Tailwind

### Future Consideration (v2+)

- [ ] Full CSS custom properties coverage for fine-grained visual control (all color, spacing, border-radius tokens)
- [ ] Slot API for custom trigger button markup
- [ ] locale prop for i18n
- [ ] Progress event stream (observable/callback for real-time status outside the component)

---

## Feature Prioritization Matrix

| Feature | User Value | Implementation Cost | Priority |
|---------|------------|---------------------|----------|
| Core lib extraction | HIGH | MEDIUM (refactor, not rewrite) | P1 |
| Svelte component with full flow | HIGH | MEDIUM (orchestration already exists in App.svelte) | P1 |
| Optional signer prop | HIGH | LOW (duck-typing already used internally) | P1 |
| Web Component IIFE bundle | HIGH | HIGH (Vite lib config, shadow DOM, Tailwind inlining) | P1 |
| Button-to-modal UX | HIGH | MEDIUM (modal wrapper + trigger) | P1 |
| Deploy completion events | HIGH | LOW | P1 |
| CSS custom properties (minimal set) | MEDIUM | LOW | P1 |
| SPA refactor to consume package | HIGH | MEDIUM | P1 |
| extraRelays / extraBlossoms props | MEDIUM | LOW | P2 |
| ESM module export | MEDIUM | LOW | P2 |
| autoDiscover prop | LOW | LOW | P2 |
| shadow="none" variant | LOW | LOW | P2 |
| Full CSS token coverage | LOW | MEDIUM | P3 |
| Slot API for trigger | LOW | LOW | P3 |

**Priority key:**
- P1: Must have for milestone complete
- P2: Add in this milestone if time permits, otherwise v1.5.1
- P3: Defer to future milestone

---

## Component API Surface (Proposed)

This section documents the expected prop and event contracts. These are design inputs for roadmap phases.

### Svelte Component Props

```typescript
// Signer duck-type: any object implementing NIP-01 sign
// Consumers can pass applesauce-signers, NDK signer, or custom objects
interface SignerLike {
  getPublicKey(): Promise<string>;
  signEvent(template: object): Promise<object>;
}

export let signer: SignerLike | null = null;         // null = built-in auth flow
export let relay: string = NSITE_RELAY;               // ws(s):// relay URL
export let blossom: string = NSITE_BLOSSOM;           // https:// blossom URL
export let gatewayHost: string = NSITE_GATEWAY_HOST;  // host for site URL construction
export let extraRelays: string[] = [];                // additional relays (P2)
export let extraBlossoms: string[] = [];              // additional blossom servers (P2)
```

### Svelte Component Events

```typescript
// createEventDispatcher pattern (Svelte 4, consistent with codebase)

on:deploy-success  // detail: { event, siteUrl, uploadResult, publishResult }
on:deploy-error    // detail: { error: string }
on:auth-change     // detail: { pubkey: string | null, signerType: string | null }
```

### Web Component Attributes

```html
<!-- String attributes only — Web Component platform constraint -->
<nsite-deployer
  trigger-label="Deploy to nsite"
  relay="wss://nsite.run"
  blossom="https://nsite.run"
  gateway-host="nsite.run"
></nsite-deployer>

<!-- Complex objects set via JS property, not attribute -->
<script>
  document.querySelector('nsite-deployer').signer = mySignerObject;
</script>
```

### CSS Custom Properties (minimal v1 set)

```css
nsite-deployer {
  --deployer-accent: #6366f1;
  --deployer-accent-hover: #4f46e5;
  --deployer-bg: #0f172a;
  --deployer-surface: #1e293b;
  --deployer-text: #f8fafc;
  --deployer-text-muted: #94a3b8;
  --deployer-radius: 0.75rem;
}
```

CSS custom properties pierce shadow DOM boundaries (HIGH confidence — verified with MDN + gomakethings.com). These variables are defined on `:host` inside the component, with the consumer overriding them on the `nsite-deployer` selector.

---

## Architectural Constraints That Shape Features

These constraints are not features but they directly limit implementation choices.

**Svelte 4 (not 5)**: The codebase is Svelte 4. `createEventDispatcher` is the event pattern. Do not migrate to Svelte 5 runes in this milestone. The Web Component wrapper uses Svelte 4's `customElement: true` compiler option in `<svelte:options>`.

**Tailwind CSS 3 inside shadow DOM**: Tailwind generates utility classes; shadow DOM blocks external CSS. The IIFE bundle must include a compiled/inlined CSS string. This requires a Vite build step that captures PostCSS output and either uses `css="injected"` or manual `adoptedStyleSheets`. This is the single highest-complexity item in the milestone.

**Tailwind v4 incompatibility with shadow DOM**: Tailwind v4 uses `:root, :host` for CSS variable definitions — verified in tailwindlabs/tailwindcss discussion #15556. The project is on Tailwind v3; do not upgrade as part of this milestone.

**Vite 5 build**: The SPA uses Vite 5. The deployer package needs its own `vite.config.js` in `packages/deployer/` configured for lib mode with `formats: ['iife', 'es']`.

**No SSR**: This component uses `window.nostr`, `localStorage`, `sessionStorage`, `WebSocket`, `fetch` — all browser-only APIs. SSR is explicitly out of scope.

**applesauce-signers v5 dependency**: The built-in auth flow depends on `applesauce-signers` v5 (`PrivateKeySigner`, `ExtensionSigner`, `NostrConnectSigner`). This is a production dependency of the package, not a peer dependency. Bundle size impact is relevant for the IIFE format.

**Web Component attribute constraint**: Web Component attributes are always strings. The `signer` prop (an object) cannot be passed as an HTML attribute. It must be set via JavaScript property assignment. This is a known Web Component platform limitation — document it clearly in the package README.

**On-prefix property naming**: Svelte custom elements misinterpret props starting with `on` as event listeners. The event interface must use non-`on` names (`deploy-success` dispatched via `createEventDispatcher`, not a prop named `onDeploySuccess`).

---

## Sources

- Svelte 4 custom elements API: https://v4.svelte.dev/docs/custom-elements-api
- Svelte 5 custom elements: https://svelte.dev/docs/svelte/custom-elements
- Web Components with Svelte (Mainmatter, 2025): https://mainmatter.com/blog/2025/06/25/web-components-with-svelte/
- CSS custom properties piercing shadow DOM: https://gomakethings.com/styling-the-shadow-dom-with-css-variables-in-web-components/
- Tailwind v4 shadow DOM discussion: https://github.com/tailwindlabs/tailwindcss/discussions/15556
- Svelte 5 custom element superpower (DEV): https://dev.to/leuzga/custom-elements-the-superpower-of-svelte-5-4mo
- Codebase directly inspected: apps/spa/src/App.svelte, all lib/*.js, all components/*.svelte

---

*Feature research for: nsite.run deployer component extraction (v1.5)*
*Researched: 2026-03-25*
