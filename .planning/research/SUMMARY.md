# Project Research Summary

**Project:** nsite.run v1.5 — Deployer Component Extraction
**Domain:** Svelte component library packaging + Web Component IIFE/ESM bundling
**Researched:** 2026-03-25
**Confidence:** HIGH

> **Note:** This file was updated 2026-03-25 to cover the v1.5 Deployer Component Extraction milestone. The prior summary (v1.4 Deploy Safety UX) has been superseded by this version. The v1.4 safety UX pitfalls remain relevant and are referenced in this summary — they should be addressed during the component extraction since the extracted component should not perpetuate known bugs.

## Executive Summary

nsite.run v1.5 extracts the complete deploy-and-manage flow from `apps/spa/src/App.svelte` into a standalone `packages/deployer` package that serves two consumers: (1) the existing SPA, which imports it as a Svelte component via workspace dependency, and (2) third-party nsites that embed it as a self-contained Web Component via a single `<script>` tag. The core business logic (hash, check, upload, publish, delete) already exists and works; this is a packaging and boundary-definition exercise, not a feature build. The canonical implementation pattern is already in the repo: the `stealthis` package in `.worktrees/enhance-button/packages/stealthis/` demonstrates the exact Vite lib mode config, vanilla HTMLElement wrapper, and shadow DOM CSS injection pattern that the deployer must replicate.

The recommended approach is a dual-artifact package: Svelte source files distributed under the `"svelte"` export condition (SPA imports and compiles these natively), plus a Vite-built IIFE+ESM bundle (self-contained, inlines all dependencies) for the Web Component. The Web Component wrapper uses a vanilla `HTMLElement` subclass mounting the Svelte component into a shadow root — NOT Svelte's `customElement: true` compiler option, which breaks with deep component trees and cross-shadow context. No new runtime dependencies are required; all needed libraries (applesauce-signers, nostr-tools, fflate, svelte) are already installed in the SPA.

The principal risks are CSS strategy for the shadow DOM (Tailwind classes are invisible inside shadow roots — the research recommends `shadow: 'none'` or injecting compiled CSS as a string), singleton store bleed when multiple instances coexist (stores must move inside components or be scoped via Svelte context), and the Vite externalization split (the ESM library build must externalize Svelte; the IIFE build must inline it — these require two separate configs). Every identified pitfall has a documented resolution; none are blockers if addressed in the correct phase order.

## Key Findings

### Recommended Stack

No new build tooling is needed. Vite 5.4.x (already installed), `@sveltejs/vite-plugin-svelte` 3.1.2 (already installed), and Svelte 4.2.20 (already installed) cover all requirements. The stealthis worktree proves the IIFE+ESM output pattern works in this exact environment. A root `package.json` with npm workspaces is the only structural addition required — it does not need `npm install` of any new packages, just workspace declaration so the SPA can resolve `@nsite/deployer` via symlink.

**Core technologies:**
- **Vite 5 lib mode** — IIFE+ESM widget bundle — already installed, proven via stealthis; `formats: ['iife', 'es']` with `cssCodeSplit: false` and `inlineDynamicImports: true` produces a single self-contained file per format
- **@sveltejs/vite-plugin-svelte 3.1.2** — Svelte compilation — must not upgrade to 4.x (requires Svelte 5); stays at current version throughout this milestone
- **npm workspaces** (no version bump) — local package resolution — replaces manual `npm link`; single `npm install` from repo root wires everything up
- **Vanilla HTMLElement wrapper** (no new dep) — Web Component host — mounts Svelte component into shadow root; avoids `customElement: true` limitations with deep component trees and context
- **Svelte source export via `"svelte"` condition** (no build step) — SPA library consumption — SPA's Vite processes `.svelte` source files natively; no pre-compilation needed for dev or build

**Critical version constraints:**
- Stay on Svelte 4.2.20 — Svelte 5 requires runes migration across all components; out of scope
- Stay on `@sveltejs/vite-plugin-svelte` 3.1.2 — 4.x requires Svelte 5
- Stay on Tailwind 3 — Tailwind 4 changes `:root`/`:host` variable scoping, breaking shadow DOM strategy

### Expected Features

**Must have (P1 — required for milestone complete):**
- Core lib layer extracted to `packages/deployer/src/lib/` — all 8 files (nostr.js, upload.js, publish.js, crypto.js, files.js, store.js, scanner.js, base36.js) moved verbatim; no rewrite needed
- `DeployerWidget.svelte` — new orchestrator component containing the ~380-line `handleDeploy` and tab coordination extracted from App.svelte; accepts `signer` prop
- Optional `signer` prop — null triggers built-in auth (NIP-07, NIP-46, anonymous); non-null skips auth modal entirely
- Web Component IIFE bundle — `packages/deployer/dist/deployer.js` single-file embed via `<script src>`
- Button-to-modal UX — `<nsite-deployer trigger-label="Deploy to nsite">` renders trigger button; click opens full modal
- CSS custom properties — minimal set on `:host`: `--deployer-accent`, `--deployer-bg`, `--deployer-text`, `--deployer-radius`
- SPA refactored to `import DeployerWidget from '@nsite/deployer'` — no duplicate logic
- `deploy-success` and `deploy-error` events with typed detail payloads

**Should have (P2 — add in this milestone if time permits):**
- `extraRelays` / `extraBlossoms` props — programmatic server injection without localStorage
- ESM module export (`.mjs`) alongside IIFE for modern bundler consumers
- `autoDiscover` boolean prop — opt-in NIP-65/10063 relay discovery (default false in Web Component)

**Defer to v2+:**
- Full CSS custom property token coverage (all color, spacing, border-radius tokens)
- Slot API for custom trigger button markup
- `locale` prop for i18n
- Progress event stream (observable/callback for real-time status outside the component)
- Headless / renderless mode — doubles maintenance surface; resolve via CSS custom properties instead
- Svelte 5 migration — dedicated milestone; runes refactor across all components

### Architecture Approach

The package splits into three layers: a framework-agnostic core lib (`packages/deployer/src/lib/` — plain JS, moved verbatim from SPA), Svelte UI components (`packages/deployer/src/components/` — all deployer-specific Svelte files), and a Web Component entry point (`packages/deployer/src/web-component/index.js` — vanilla HTMLElement wrapper). Two Vite build configurations produce two outputs: the IIFE+ESM bundle (self-contained, Svelte inlined) and the raw Svelte source (not built, exported by path for SPA consumption). The SPA becomes a thin shell: Navbar, NIP5ABanner, and ToolsResources stay in `apps/spa`; everything deploy-flow-specific moves into DeployerWidget.

**Major components:**
1. **DeployerWidget.svelte** (new) — master orchestrator: deploy flow, manage flow, state coordination; accepts `signer` prop; emits `deploy-success`, `deploy-error`, `auth-change`; owns `deployState` and `serverConfig` stores internally
2. **Core lib layer** (moved, not rewritten) — `nostr.js`, `upload.js`, `publish.js`, `crypto.js`, `files.js`, `store.js`, `scanner.js`, `base36.js`; all plain JS, framework-agnostic; `import.meta.env.VITE_*` works unchanged in both SPA and package builds
3. **Web Component entry** (new) — `customElements.define('nsite-deploy', NsiteDeployWidget)` where `NsiteDeployWidget extends HTMLElement`; mounts DeployerWidget into shadow root; handles attribute-to-prop bridging
4. **apps/spa App.svelte** (modified, not replaced) — thin shell retaining Navbar, NIP5ABanner, ToolsResources; passes `signer` prop to DeployerWidget; listens for `on:logout`
5. **Root package.json** (new) — npm workspaces manifest: `["apps/spa", "packages/deployer"]`; no new npm packages

**Key data flow decision:** App.svelte holds `currentSigner` (non-serializable, lost on reload) and passes it to DeployerWidget as a prop. DeployerWidget does NOT independently manage auth when a signer is provided. This keeps the Navbar's logout/display logic at the App level where it belongs. The signer crosses the package boundary as a prop, not via a shared store.

### Critical Pitfalls

The full PITFALLS.md catalogs 27 pitfalls across infrastructure, v1.4 safety UX, and v1.5 extraction. The five most critical for this milestone:

1. **Singleton store bleed across instances (Pitfall 20)** — Module-level stores in `store.js` become singletons shared across all deployer instances on the same page. Fix: move stores inside component `<script>` blocks or use Svelte `setContext`/`getContext`. Address in Phase 2 (lib extraction) before any component work.

2. **Vite must use two separate configs — externalize Svelte for ESM library, bundle Svelte for IIFE (Pitfall 24)** — A single Rollup config cannot serve both output types (incompatible externals requirements). Fix: `vite.widget.config.js` bundles everything for IIFE; the Svelte component library has no build step (exports raw source). The stealthis pattern resolves this by using a single entry with no Svelte dep; the deployer needs the explicit split.

3. **Tailwind CSS invisible inside shadow DOM (Pitfall 22)** — Shadow root CSS scope blocks all global Tailwind utilities. Two viable fixes: (a) `shadow: 'none'` on the custom element — forfeits CSS isolation but global Tailwind works; recommended because deployer embeds in nsite.run-controlled pages; (b) inject full compiled Tailwind CSS string into shadow root — adds ~20-30KB per instance and requires a two-step build. Validate chosen strategy in a throwaway harness before building the full modal UI.

4. **`createEventDispatcher` events don't cross shadow DOM boundary (Pitfall 21)** — Events created without `composed: true` stop at the shadow root. Internal component events (DeployZone to DeployerWidget) can continue using `createEventDispatcher`. Top-level external events (`deploy-success`, `deploy-error`) must use native `CustomEvent` with `{ bubbles: true, composed: true }` dispatched on the custom element host.

5. **`package.json` exports map missing `"svelte"` condition (Pitfall 25)** — Without the `"svelte"` condition, `vite-plugin-svelte` falls back to pre-compiled JS, breaking HMR and Svelte-specific processing in the SPA. Fix: use the SvelteKit packaging docs pattern for the exports map; validate with `publint` before testing the SPA import.

**v1.4 safety UX pitfalls to carry forward into Phase 3 (DeployerWidget extraction):**
- Pitfall 11 (deploy guard races async fetch) and Pitfall 18 (relay list staleness in guard) — guard must await `sitesLoading` and use `NSITE_RELAY` + `DEFAULT_RELAYS` as baseline
- Pitfall 13 (optimistic delete with no rollback) and Pitfall 19 (deleteState collapses success/error) — fix state machine correctness before adding any animation
- Pitfall 14 (flip+fade race condition in Svelte 4 issue #4910) — use `out:fade` alone, never combined with `animate:flip`
- Pitfall 15/16 (beforeunload reliability and false triggers on wrong steps) — dangerous steps are only `['hashing', 'checking', 'uploading', 'publishing']`
- Pitfall 17 (post-action navigation clears signer) — update paths must use `resetForUpdate()`, not `resetDeploy()`

## Implications for Roadmap

The phase structure follows a strict dependency order: establish the package scaffolding and build configuration first (nothing else works without it), then move code, then build the Web Component wrapper, then validate the embed scenario end-to-end.

### Phase 1: Package Scaffolding and Build Infrastructure

**Rationale:** All subsequent phases depend on having a working `packages/deployer` with correct Vite configs and workspace resolution. This phase has no feature deliverable but is the highest-leverage work — getting the build configuration wrong cascades into every subsequent phase.
**Delivers:** Root `package.json` (npm workspaces), `packages/deployer/package.json` with correct exports map and `"svelte"` condition, `vite.widget.config.js`, `svelte.config.js`. Validated with `publint`. IIFE and ESM output files exist even if they contain placeholder content.
**Addresses:** Pitfall 24 (dual Vite configs), Pitfall 25 (exports map), npm workspace setup
**Must avoid:** Using a single Vite config for both outputs; referencing Svelte 4 upgrade or Tailwind 4

### Phase 2: Core Lib Extraction

**Rationale:** The 8 lib files are framework-agnostic plain JS that move verbatim. No component work required. This phase de-risks the remainder by proving the package boundary works and that `apps/spa` can still import the lib functions.
**Delivers:** `packages/deployer/src/lib/` with all 8 files. `apps/spa/src/lib/` deleted. SPA imports updated to `@nsite/deployer/lib/*`. All existing SPA functionality preserved.
**Addresses:** Pitfall 20 (store singleton audit — identify which stores need context-scoping before component work begins); verify `import.meta.env.VITE_*` fallback behavior in non-Vite contexts
**Must avoid:** Pitfall 20 — audit module-level state during this phase, not after component work starts

### Phase 3: DeployerWidget Component (Svelte Library)

**Rationale:** Extract the ~380-line `handleDeploy` and tab coordination from App.svelte into `DeployerWidget.svelte`. Move all deployer-specific Svelte components to `packages/deployer/src/components/`. Simultaneously fix the v1.4 safety UX bugs — the extracted component should not perpetuate known state machine bugs.
**Delivers:** `DeployerWidget.svelte` (new orchestrator), all sub-components moved, `src/index.js` named exports, SPA App.svelte refactored to thin shell using `<DeployerWidget signer={currentSigner} />`. Full SPA functionality preserved. v1.4 safety UX bugs fixed (deploy guard, delete state machine, leave confirmation, post-action navigation).
**Addresses:** Component boundary definition, signer prop pattern, store isolation via context, v1.4 pitfalls 11/13/14/15/16/17/18/19
**Must avoid:** Including Navbar/NIP5ABanner/ToolsResources in DeployerWidget; moving session store into deployer package as singleton; using `resetDeploy()` on update paths

### Phase 4: Web Component Wrapper and IIFE Bundle

**Rationale:** With the Svelte component working correctly in the SPA, the Web Component wrapper is a contained addition. The CSS strategy (shadow vs. no-shadow, Tailwind injection) must be validated with a prototype before building out the full modal UI.
**Delivers:** `packages/deployer/src/web-component/index.js` (HTMLElement wrapper), built `dist/deployer.js` (IIFE) and `dist/deployer.mjs` (ESM), `<nsite-deployer>` custom element definition, button-to-modal UX, CSS custom properties on `:host`, `deploy-success`/`deploy-error` events with `composed: true`
**Addresses:** Pitfall 21 (shadow DOM event propagation), Pitfall 22 (Tailwind in shadow DOM), Pitfall 23 (prop availability timing)
**Must avoid:** Using Svelte `customElement: true` (breaks deep component trees and context); using `createEventDispatcher` for top-level external events; building full modal UI before CSS strategy is validated

### Phase 5: Embed Validation and Documentation

**Rationale:** The Web Component must be tested in an actual embed scenario — a plain HTML page and an nsite — before declaring the milestone complete. Bundle size must be measured against acceptable limits.
**Delivers:** Working embed demo, bundle size report, package README with usage examples (Svelte import + Web Component `<script>` embed + signer property assignment pattern), `publint` validation output
**Addresses:** Bundle size audit (deployer bundle will be larger than stealthis due to Svelte runtime and applesauce-signers), cross-origin anonymous key persistence limitation documented (sessionStorage origin-scoped; known limitation, not a bug to fix in this milestone)
**Must avoid:** Shipping without testing IIFE from a non-Vite HTML page in an actual browser

### Phase Ordering Rationale

- Phases 1 through 4 are strict sequential dependencies: each phase's output is the input to the next
- Phase 3 deliberately bundles the v1.4 safety UX fixes with the component extraction — fixing bugs in the extracted component rather than in the SPA and then re-extracting them
- CSS strategy decision (Pitfall 22) blocks Phase 4 and must be prototyped at Phase 4 start before any full component build
- Phase 5 (validation) is non-blocking for Phase 4 completion but required before any public release of the package

### Research Flags

Phases likely needing additional research during planning:

- **Phase 4 (Web Component wrapper):** CSS strategy decision (shadow vs. no-shadow) has significant downstream consequences; prototype both options before committing. Shadow DOM `composed: true` event semantics should be verified with an actual browser harness, not just spec reading. The `shadow: 'none'` recommendation from research needs a quick prototype to confirm Tailwind utility classes apply as expected from the host page.
- **Phase 4 (IIFE bundle size):** Bundle size of the deployer IIFE (Svelte runtime + applesauce-signers + nostr-tools + fflate) is unknown until built. May need targeted tree-shaking or explicit dep splitting. Monitor during Phase 1 once the build config is in place with placeholder content.

Phases with well-documented patterns (skip research-phase):

- **Phase 1 (scaffolding):** npm workspaces and Vite lib mode are well-documented; stealthis is a proven in-repo template; patterns are unambiguous
- **Phase 2 (lib extraction):** Move-only operation on framework-agnostic JS; no research needed
- **Phase 3 (component extraction):** Standard Svelte 4 refactoring; all patterns exist in current codebase; v1.4 bug fixes have documented resolutions in PITFALLS.md

## Confidence Assessment

| Area | Confidence | Notes |
|------|------------|-------|
| Stack | HIGH | All versions confirmed by direct inspection of `node_modules`; stealthis is in-repo proof of concept; no external unknowns |
| Features | HIGH | Codebase directly inspected; API surface derived from existing SPA; Web Component platform constraints verified against official spec and MDN |
| Architecture | HIGH | Component inventory derived from direct file inspection; build architecture derived from proven stealthis pattern; data flow follows clear dependency analysis |
| Pitfalls | HIGH | Derived from: (1) actual working implementations (nostr.pub, blssm.us, nsyte), (2) direct codebase inspection for SPA-specific pitfalls, (3) official Svelte 4 docs and GitHub issues for packaging pitfalls |

**Overall confidence:** HIGH

### Gaps to Address

- **Bundle size of the deployer IIFE:** Unknown until the build runs. applesauce-signers + nostr-tools + fflate + svelte runtime could push 300-500KB. Acceptable for an opt-in embed widget, but should be measured and documented. Address by running the Phase 1 build with placeholder content.
- **CSS strategy for shadow DOM:** Research recommends `shadow: 'none'` but acknowledges it forfeits CSS isolation. The final decision should be validated with a prototype before committing to shadow DOM architecture in Phase 4. The stealthis approach (inline CSS string) is an alternative but requires a two-step build.
- **Anonymous key persistence in cross-origin embeds:** Documented as a known limitation — `sessionStorage` is origin-scoped; a Web Component embedded on `my-nsite.npub1xxx.nsite.run` cannot share anonymous keys with the main nsite.run SPA. Acceptable behavior for v1; document clearly in the package README.
- **`import.meta.env.VITE_*` in the IIFE bundle:** The lib files use `import.meta.env.VITE_NSITE_RELAY` etc. for service URL overrides. These will be `undefined` in the IIFE bundle (no Vite build step for consumers). Verify the fallback logic in `nostr.js` handles undefined env vars gracefully — it should fall back to `window.location` origin, which is correct behavior for nsites.

## Sources

### Primary (HIGH confidence)
- `.worktrees/enhance-button/packages/stealthis/vite.config.ts` — confirmed IIFE+ESM Vite lib config, in-repo
- `.worktrees/enhance-button/packages/stealthis/src/widget.ts` — vanilla HTMLElement wrapper, shadow DOM CSS injection
- `apps/spa/node_modules/@sveltejs/vite-plugin-svelte/package.json` — version 3.1.2, peerDeps verified
- `apps/spa/node_modules/svelte/package.json` — version 4.2.20 confirmed
- `apps/spa/node_modules/vite/package.json` — version 5.4.21 confirmed
- `apps/spa/src/App.svelte` — deploy flow source, component inventory, store structure
- `apps/spa/src/lib/` — all 8 lib files inspected
- Svelte Custom Elements API: https://v4.svelte.dev/docs/custom-elements-api
- SvelteKit Packaging Docs: https://svelte.dev/docs/kit/packaging
- Vite Build Options: https://vite.dev/config/build-options
- MDN CSS Custom Properties piercing shadow DOM: https://gomakethings.com/styling-the-shadow-dom-with-css-variables-in-web-components/

### Secondary (MEDIUM confidence)
- Building Embeddable Widgets with Svelte (ferndesk): https://ferndesk.com/blog/building-embeddable-widgets-with-svelte — Svelte 5 focused but principles apply to Svelte 4
- Web Components with Svelte (Mainmatter, 2025): https://mainmatter.com/blog/2025/06/25/web-components-with-svelte/
- Svelte GitHub issue #3327 — `createEventDispatcher` and shadow DOM `composed: true`
- Svelte GitHub issue #4910 — `animate:flip` + `transition:fade` race condition in Svelte 4

### Tertiary (LOW confidence)
- Tailwind v4 shadow DOM discussion: https://github.com/tailwindlabs/tailwindcss/discussions/15556 — confirms Tailwind 4 `:root/:host` variable scoping change; rationale for staying on Tailwind 3

---
*Research completed: 2026-03-25*
*Ready for roadmap: yes*
