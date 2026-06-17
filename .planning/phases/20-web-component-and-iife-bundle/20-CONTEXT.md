# Phase 20: Web Component and IIFE Bundle - Context

**Gathered:** 2026-03-25
**Status:** Ready for planning

<domain>
## Phase Boundary

Create a vanilla HTMLElement wrapper that mounts DeployerWidget into the DOM, produces a self-contained IIFE+ESM bundle, and provides button→modal UX with customizable trigger. The bundle must work from a single `<script>` tag with no npm or bundler required.

</domain>

<decisions>
## Implementation Decisions

### Shadow DOM + CSS strategy
- **D-01:** Prototype BOTH approaches before committing: shadow: 'open' + CSS string injection AND shadow: 'none' (no encapsulation)
- **D-02:** Final decision based on bundle size impact + visual correctness in a plain HTML test page
- **D-03:** The stealthis `styles.ts` pattern (CSS string constant injected into shadow root) is the reference for the shadow: 'open' approach
- **D-04:** Vite plugin-svelte `css: 'injected'` mode (from Phase 17 widget config) handles Svelte-scoped CSS — but Tailwind utilities need separate handling

### Button + modal UX
- **D-05:** Trigger button renders wherever `<nsite-deployer>` is placed in the DOM — NOT fixed position. Consumer controls placement.
- **D-06:** Clicking trigger opens a full-screen modal overlay containing the deployer (like stealthis modal pattern)
- **D-07:** Modal closes on Escape key and backdrop click
- **D-08:** Button text customizable via `trigger-label` attribute (default: "Deploy to nsite")
- **D-09:** Button color and background customizable via `trigger-color` and `trigger-bg` attributes

### Props and attributes
- **D-10:** `trigger-label` — HTML attribute, string, changes button text
- **D-11:** `trigger-color` and `trigger-bg` — HTML attributes for button styling
- **D-12:** `extraRelays` and `extraBlossoms` — JS properties (array of strings), set programmatically. These add servers used during upload without touching localStorage.
- **D-13:** `default-relay` and `default-blossom` — HTML attributes to override NSITE_RELAY/NSITE_BLOSSOM constants. Allows pointing the widget at different nsite infrastructure.
- **D-14:** `signer` — JS property (object), accepts an applesauce-signers compatible signer. When set, skips built-in auth flow.

### Event propagation
- **D-15:** All events from DeployerWidget re-dispatched as `composed: true` CustomEvents on the custom element — crosses shadow root boundary
- **D-16:** Event names match Phase 19 contract: deploy-success, deploy-error, auth-change, operation-start, operation-end, site-deleted

### Claude's Discretion
- How to handle the CSS prototype comparison (inline in the plan vs separate spike)
- Modal z-index and stacking context management
- Whether to use a `<dialog>` element or custom overlay div
- Keyboard focus trapping inside the modal
- Bundle size optimization (tree-shaking, minification settings)

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Reference implementations
- `~/Develop/nsite/stealthis/src/widget.ts` — Vanilla HTMLElement wrapper pattern, shadow DOM, modal UX, state machine
- `~/Develop/nsite/stealthis/src/styles.ts` — CSS string constant for shadow root injection
- `~/Develop/nsite/stealthis/src/index.ts` — Custom element registration, auto-injection logic
- `~/Develop/nsite/stealthis/vite.config.ts` — Vite lib mode IIFE+ESM config

### Existing build infrastructure
- `packages/deployer/vite.widget.config.js` — Already produces IIFE+ESM with placeholder (Phase 17)
- `packages/deployer/src/widget/index.js` — Placeholder widget entry point (Phase 17)
- `packages/deployer/package.json` — Exports map with "import" and "default" conditions for dist files

### Prior phase decisions
- `.planning/phases/17-package-scaffolding-and-build-infrastructure/17-CONTEXT.md` — D-02 (<nsite-deployer> tag), D-03 (deployer.js/deployer.mjs), D-08 (vite.widget.config.js)
- `.planning/phases/19-svelte-component/19-CONTEXT.md` — D-06-D-10 (auth inside widget), D-11-D-14 (event contract), D-15-D-16 (CSS custom properties)

### Research
- `.planning/research/PITFALLS.md` — Pitfall 22 (Tailwind + shadow DOM), Pitfall 24 (dual Vite configs), Pitfall 26 (composed events)
- `.planning/research/FEATURES.md` — Web Component API surface, attribute/property patterns

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `vite.widget.config.js` — Already configured for IIFE+ESM output with Svelte plugin. Just needs the real entry point.
- `packages/deployer/src/widget/index.js` — Placeholder to be replaced with real HTMLElement wrapper
- stealthis `widget.ts` — 546 lines of proven HTMLElement wrapper code with state machine, modal, shadow DOM

### Established Patterns
- stealthis uses `this.attachShadow({mode: 'open'})` with CSS string injection
- stealthis has `observedAttributes` for attribute→property bridging
- stealthis uses a state machine (idle→auth→loading→form→deploying→success) — similar to deployer's step machine

### Integration Points
- `packages/deployer/src/widget/index.js` entry point → `customElements.define('nsite-deployer', NsiteDeployerWidget)`
- DeployerWidget.svelte (from Phase 19) mounted inside the HTMLElement wrapper
- IIFE bundle global name: `NsiteDeployer` (from Phase 17 vite config)

</code_context>

<specifics>
## Specific Ideas

- Button should render inline where placed, not auto-inject to document.body (unlike stealthis which auto-injects)
- The `default-relay` and `default-blossom` attributes let consumers point the widget at their own nsite infrastructure (not just nsite.run)
- The prototype comparison for shadow DOM should include measuring bundle size difference and testing visual correctness in a plain HTML page with existing CSS

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 20-web-component-and-iife-bundle*
*Context gathered: 2026-03-25*
