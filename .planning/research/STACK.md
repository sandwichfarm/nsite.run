# Stack Research

**Domain:** Svelte component library packaging + Web Component IIFE/ESM bundling
**Researched:** 2026-03-25
**Confidence:** HIGH

## Context: What Already Exists

The SPA at `apps/spa` uses these verified installed versions (confirmed from node_modules):

| Package | Installed Version |
|---------|------------------|
| svelte | 4.2.20 |
| vite | 5.4.21 |
| @sveltejs/vite-plugin-svelte | 3.1.2 (peerDeps: svelte ^4.0.0 || ^5.0.0-next, vite ^5.0.0) |
| tailwindcss | ^3.4.0 |
| autoprefixer | ^10.4.21 |

The stealthis package in `.worktrees/enhance-button/packages/stealthis/` already demonstrates the proven production pattern:
- `vite build.lib` with `formats: ['iife', 'es']` outputting `.js` (IIFE) and `.mjs` (ESM)
- Vanilla HTMLElement Web Component — NOT Svelte's `customElement: true`
- CSS injected as an inline string constant into shadow DOM (no Tailwind in the widget layer)

**This is the in-repo proof of concept. Reuse it, do not reinvent it.**

---

## What to Add for v1.5

### New: `packages/deployer` directory

A new `packages/deployer` sits alongside `packages/shared`. It produces two artifacts:

1. **Svelte component library** — distributes `.svelte` source files via the `"svelte"` exports condition, for consumption by `apps/spa` (and any other Svelte project)
2. **Web Component widget bundle** — IIFE + ESM single-file output compiled from a vanilla HTMLElement wrapper that mounts the Svelte deployer into its shadow DOM, for embedding in third-party nsites

### New: root `package.json` (npm workspaces)

Currently the repo has no root `package.json`. The Deno workspace (`deno.json`) covers the server apps, but `apps/spa` and `packages/deployer` are npm-based. A root `package.json` with npm `"workspaces"` is required so the SPA can import `@nsite/deployer` via symlink without `npm link`.

---

## Recommended Stack — Additions Only

### Core Build Tooling

| Technology | Version | Purpose | Why Recommended |
|------------|---------|---------|-----------------|
| Vite lib mode | 5.4.x (already installed in apps/spa) | Compile the widget bundle (IIFE + ESM) | Already proven in stealthis; `build.lib` with `formats: ['iife', 'es']` produces the exact output needed; no new tool required |
| @sveltejs/vite-plugin-svelte | 3.1.2 (already installed) | Compile Svelte files in the deployer package | Same version as SPA; do not upgrade — version 4.x+ requires Svelte 5 |
| vitePreprocess | already in vite-plugin-svelte | Preprocess `<style>` and `<script lang="ts">` in .svelte files | Already used in SPA's svelte.config.js via `vitePreprocess()` |

### Package Structure

| Item | Approach | Why |
|------|----------|-----|
| Svelte component exports | `"svelte"` condition pointing at `.svelte` source files (NOT compiled JS) | Official recommended approach per Svelte packaging docs; lets SPA consumer use its own Svelte compiler and preprocessors; compiled output loses Svelte reactivity optimizations |
| Web Component exports | `"import"` → `.mjs`, `"default"` → `.js` (IIFE) | Matches stealthis pattern exactly; IIFE auto-executes for `<script src>` embedding; ESM allows `import` in modern bundlers |
| CSS in Web Component | Scoped CSS string injected into shadow DOM at runtime | Proven in stealthis `styles.ts` pattern; avoids shadow DOM / Tailwind incompatibility entirely; widget carries its own self-contained styles |

### Workspace Setup

| Item | Approach | Why |
|------|----------|-----|
| Root `package.json` | `"workspaces": ["apps/spa", "packages/deployer"]` (npm workspaces) | Missing at repo root; required for `apps/spa` to resolve `@nsite/deployer` as a symlinked local package |
| `packages/deployer/package.json` | `"type": "module"` + exports map with `"svelte"` condition + `"import"` + `"default"` | Follows stealthis for widget outputs; follows SvelteKit packaging docs for the Svelte component output |

---

## Supporting Libraries

No new runtime dependencies are needed. The deployer's runtime dependencies are a subset of what the SPA already uses:

| Library | Already In SPA? | Role in Deployer | Treatment |
|---------|-----------------|------------------|-----------|
| svelte | yes | Component framework | `peerDependency` in deployer — do not bundle |
| applesauce-core, applesauce-relay, applesauce-signers | yes | Nostr signing + relay queries | `dependency` in deployer; bundled into widget IIFE, peerDep for Svelte library build |
| nostr-tools | yes | NIP-19 encoding (npub), NIP-46 | `dependency` in deployer; same treatment |
| fflate, nanotar | yes | File extraction (zip/tar.gz) | `dependency` in deployer |
| qrcode | yes | QR code for NIP-46 bunker flow | `dependency` in deployer |
| tailwindcss | yes (SPA only) | Styling in the Svelte component build | NOT used in the Web Component widget CSS; widget uses inline CSS string like stealthis |

---

## Build Configuration Pattern

### Dual Vite Config Approach

The deployer package needs two Vite build configurations run in sequence:

**`vite.widget.config.js`** — Web Component widget (IIFE + ESM):

```js
// Identical structure to .worktrees/enhance-button/packages/stealthis/vite.config.ts
import { defineConfig } from 'vite';
import { svelte } from '@sveltejs/vite-plugin-svelte';

export default defineConfig({
  plugins: [svelte({ compilerOptions: { css: 'injected' } })],
  build: {
    lib: {
      entry: 'src/widget/index.ts',
      name: 'NsiteDeployer',
      formats: ['iife', 'es'],
      fileName: (format) => format === 'es' ? 'deployer.mjs' : 'deployer.js'
    },
    outDir: 'dist/widget',
    cssCodeSplit: false,       // inline all CSS into the JS bundle
    rollupOptions: {
      output: { inlineDynamicImports: true }  // single file per format, no chunks
    }
  }
});
```

**For the Svelte component library** — do not use a separate Vite build. Distribute `.svelte` source files directly by pointing the `"svelte"` exports condition at the source tree. Consumers run their own Svelte compiler. This is the official Svelte library distribution pattern and requires zero build step for the library output.

### Package Exports Map (`packages/deployer/package.json`)

```json
{
  "name": "@nsite/deployer",
  "type": "module",
  "exports": {
    ".": {
      "svelte": "./src/index.js",
      "import": "./dist/widget/deployer.mjs",
      "default": "./dist/widget/deployer.js"
    },
    "./Deployer.svelte": {
      "svelte": "./src/Deployer.svelte"
    }
  },
  "main": "dist/widget/deployer.js",
  "module": "dist/widget/deployer.mjs",
  "svelte": "src/index.js",
  "scripts": {
    "build": "vite build --config vite.widget.config.js",
    "dev": "vite build --config vite.widget.config.js --watch"
  }
}
```

---

## Web Component Architecture Decision

**Use a vanilla HTMLElement wrapper, NOT Svelte's `customElement: true` compiler option.**

| Approach | Why It Fails for the Deployer |
|----------|-------------------------------|
| `<svelte:options customElement="nsite-deploy" />` | Requires ALL child Svelte components to also be compiled as custom elements. The deployer has deep component trees (LoginModal, NIP46Dialog, FileTree, ManageSite, etc.) — every one would need `<svelte:options>`. Context passing (`setContext`/`getContext`) does not work across shadow DOM boundaries. Slot composition breaks. |
| Vanilla `HTMLElement` wrapper | The stealthis worktree already implements this pattern. Mount the Svelte component into `this.attachShadow({mode: 'open'})` using `new DeployerComponent({ target: this.shadowRoot, props: {...} })`. No child component changes required. |

**Proven pattern from stealthis:**
```ts
export class NsiteDeployWidget extends HTMLElement {
  private shadow: ShadowRoot;

  constructor() {
    super();
    this.shadow = this.attachShadow({ mode: 'open' });
    // Mount Svelte deployer component into shadow root
    new Deployer({ target: this.shadow, props: { signer: null } });
  }
}

customElements.define('nsite-deploy', NsiteDeployWidget);
```

**Shadow DOM for the widget — use shadow DOM (not light DOM):**
- Shadow DOM (`mode: 'open'`) provides style isolation — widget styles do not leak into the host nsite's styles and the host's Tailwind/CSS does not break the widget
- Widget carries its own CSS (Svelte scoped styles compiled into the bundle via `css: 'injected'` + `cssCodeSplit: false`)
- Tailwind on the host page cannot style the widget's internals — intentional for an embeddable widget

---

## Alternatives Considered

| Recommended | Alternative | When Alternative Makes Sense |
|-------------|-------------|------------------------------|
| Vanilla HTMLElement wrapper | Svelte `customElement: true` | Only viable for leaf components (no child Svelte components, no context); deployer has deep component tree — not viable |
| Vite lib mode (already installed) | Rolldown directly | Rolldown avoids Vite abstractions and is better for Svelte 5 + complex IIFE builds; use it if upgrading to Svelte 5 later |
| Distribute `.svelte` source for library | Compile to JS for library output | Compiled output loses reactivity optimization at consumer compile time; only use compiled output when targeting non-Svelte consumers |
| Single `vite.widget.config.js` only | Single config building both library and widget | IIFE format cannot code-split; multiple entries break IIFE in Rollup; stealthis uses single entry per config |
| npm workspaces at repo root | `npm link` manually | Workspaces auto-symlink on install; `npm link` breaks on re-install and doesn't work with CI |
| Inline CSS string in widget | Tailwind in widget shadow DOM | Tailwind in shadow DOM requires constructable stylesheets + manual CSS variable declarations on `:host`; the inline CSS string is ~8KB and self-contained |

---

## What NOT to Add

| Avoid | Why | Use Instead |
|-------|-----|-------------|
| `@sveltejs/package` (svelte-package CLI) | Adds SvelteKit as a dev dependency just for packaging; overkill when the exports map is 5 lines; does not support dual library+widget builds | Manual `package.json` exports map pointing at source |
| @sveltejs/vite-plugin-svelte upgrade past 3.x | Version 4.x requires Svelte 5; upgrading the plugin without upgrading Svelte breaks compilation | Stay at 3.1.2 |
| Svelte 5 in this milestone | Requires runes refactor across all components; breaking scope change; save for dedicated upgrade milestone | Stay on svelte@4.2.20 |
| TypeScript for the deployer lib layer | SPA lib (`src/lib/*.js`) is plain JS; TS adds preprocessor complexity with no clear benefit; stealthis uses TS only for the widget wrapper, not the full lib | Plain JS with JSDoc types if needed; TS only for the widget entry if desired |
| pnpm workspaces | Introduces a new package manager; repo already has `package-lock.json v3` (npm); mixing managers creates lockfile conflicts | npm workspaces |
| `vite-plugin-lib-inject-css` | Adds a plugin dependency for CSS injection that Vite handles natively with `cssCodeSplit: false` in lib mode | Native Vite `cssCodeSplit: false` |
| CSS Modules, styled-components, emotion | SPA uses Svelte scoped styles + Tailwind; widget uses inline CSS string; no third CSS system needed | Existing patterns |

---

## Version Compatibility

| Package A | Compatible With | Notes |
|-----------|-----------------|-------|
| @sveltejs/vite-plugin-svelte@3.x | svelte@^4.0.0 || ^5.0.0-next, vite@^5.0.0 | Confirmed from installed package.json peerDependencies; 3.x is the last Svelte-4-compatible major |
| vite@5.4.x | cssCodeSplit:false + inlineDynamicImports | Both options verified in Vite 5 docs; cssCodeSplit defaults to false in lib mode |
| svelte@4.2.20 | shadow:"none" option in customElement config | `shadow` as string available since Svelte 4; not needed for the HTMLElement wrapper approach |
| npm workspaces | npm >=7 | npm 7+ (bundled with Node 15+) supports workspaces; package-lock.json v3 already in use confirms compatible npm version |

---

## Installation

No net-new packages needed for build infrastructure. Steps to wire up the workspace:

```bash
# Step 1: Create root package.json (npm workspaces manifest)
# Add: { "private": true, "workspaces": ["apps/spa", "packages/deployer"] }

# Step 2: Create packages/deployer with its own package.json
# (no npm install needed — dependencies hoisted from root after workspace setup)

# Step 3: Run from repo root to symlink the workspace packages
npm install

# Step 4: apps/spa can now import @nsite/deployer
# Vite resolves it via the "svelte" exports condition to .svelte source files
```

The only new files created are:
- `/package.json` — root npm workspace manifest
- `/packages/deployer/package.json` — deployer package manifest
- `/packages/deployer/vite.widget.config.js` — widget IIFE+ESM build config
- `/packages/deployer/svelte.config.js` — preprocessor config (copy of SPA's)

---

## Sources

- `.worktrees/enhance-button/packages/stealthis/vite.config.ts` — confirmed working IIFE+ESM Vite lib config in-repo (HIGH confidence)
- `.worktrees/enhance-button/packages/stealthis/src/widget.ts` — vanilla HTMLElement wrapper pattern with shadow DOM CSS injection (HIGH confidence)
- `apps/spa/node_modules/@sveltejs/vite-plugin-svelte/package.json` — version 3.1.2, peerDeps svelte ^4.0.0 || ^5.0.0-next, vite ^5.0.0 (HIGH confidence — direct inspection)
- `apps/spa/node_modules/svelte/package.json` — version 4.2.20 (HIGH confidence — direct inspection)
- `apps/spa/node_modules/vite/package.json` — version 5.4.21 (HIGH confidence — direct inspection)
- [Svelte Custom Elements API](https://svelte.dev/docs/custom-elements-api) — `customElement: true` limitations, context/slot constraints (HIGH confidence — official docs)
- [SvelteKit Packaging Docs](https://svelte.dev/docs/kit/packaging) — `"svelte"` export condition, uncompiled `.svelte` distribution pattern (HIGH confidence — official docs)
- [vite-plugin-svelte FAQ](https://github.com/sveltejs/vite-plugin-svelte/blob/main/docs/faq.md) — deprecated `svelte` field, export conditions (HIGH confidence — official repo)
- [Vite Build Options](https://vite.dev/config/build-options) — `build.lib.formats`, `cssCodeSplit`, IIFE format (HIGH confidence — official docs)
- [Building Embeddable Widgets with Svelte (ferndesk)](https://ferndesk.com/blog/building-embeddable-widgets-with-svelte) — shadow DOM CSS variable handling, IIFE single-file pattern (MEDIUM confidence — Svelte 5 focused but principles apply to Svelte 4)

---
*Stack research for: v1.5 Deployer Component — Svelte library packaging + Web Component IIFE/ESM bundling*
*Researched: 2026-03-25*
