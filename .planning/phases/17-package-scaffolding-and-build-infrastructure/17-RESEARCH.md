# Phase 17: Package Scaffolding and Build Infrastructure - Research

**Researched:** 2026-03-25
**Domain:** npm workspaces + Vite lib mode (IIFE+ESM) + Svelte exports map + publint validation
**Confidence:** HIGH

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

**Package naming and identity**
- D-01: Package name is `@nsite/deployer` — consistent with `@nsite/spa`, `@nsite/stealthis` convention
- D-02: Custom element tag is `<nsite-deployer>` — distinct from stealthis (which has its own separate tag)
- D-03: Bundle output files: `deployer.js` (IIFE) and `deployer.mjs` (ESM) in `dist/`

**Workspace configuration**
- D-04: npm workspaces scoped to npm packages only: `["apps/spa", "packages/deployer"]` — Deno packages (shared, edge scripts) stay outside npm workspace. JSR integration deferred to later.
- D-05: No root package.json exists currently — must create from scratch

**Exports map**
- D-06: Must include `"svelte"` export condition pointing at raw `.svelte` source files — SPA's Vite compiles them natively (no pre-build needed for dev)
- D-07: Must include `"import"` condition for ESM bundle and `"default"` for IIFE bundle — matches stealthis pattern

**Dual Vite configs**
- D-08: Widget config (`vite.widget.config.js`) builds IIFE+ESM with Svelte inlined — self-contained for embedding
- D-09: No build step needed for Svelte component library consumption — raw source exported via "svelte" condition, consumer's Vite processes it
- D-10: Widget config uses `@sveltejs/vite-plugin-svelte` for Svelte compilation within the bundle

### Claude's Discretion
- Dependency ownership split between packages/deployer and apps/spa (Claude picks cleanest approach)
- Exact exports map structure and conditions beyond "svelte", "import", "default"
- Whether to use `vite.config.js` for dev and `vite.widget.config.js` for widget build, or a single config with mode switching
- publint configuration details

### Deferred Ideas (OUT OF SCOPE)
None — discussion stayed within phase scope
</user_constraints>

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| INFRA-01 | Root package.json with npm workspaces declares packages/deployer and apps/spa | Root package.json creation pattern; npm workspaces `["apps/spa", "packages/deployer"]` — verified against npm 11.11.0 (Node 22.22.1) |
| INFRA-02 | packages/deployer has package.json with correct exports map including "svelte" condition | Exports map pattern from STACK.md + Pitfall 25; "svelte" condition pointing at `src/index.js` (NOT .svelte directly); "import" + "default" for widget bundles |
| INFRA-03 | Dual Vite configs: widget build (IIFE+ESM, Svelte inlined) and lib source export (no build step) | vite.widget.config.js pattern from stealthis reference + STACK.md; lib source has zero build steps — "svelte" condition exports raw source |
| INFRA-04 | publint validates packages/deployer exports are correct and consumable | publint@0.3.18 installed as devDependency in packages/deployer; run after build to confirm zero errors |
</phase_requirements>

---

## Summary

Phase 17 is purely infrastructure: create the npm workspace scaffold that allows `packages/deployer` to coexist with `apps/spa` under a common root, establish the `packages/deployer/package.json` exports map, and prove both Vite build targets work (IIFE+ESM widget bundle, zero-build Svelte library source). No deploy logic moves in this phase — the package ships with placeholder exports that are enough for apps/spa to resolve the import without error.

The primary technical challenge is the exports map: it must satisfy three consumers simultaneously — (1) `@sveltejs/vite-plugin-svelte` in the SPA needs the `"svelte"` condition to resolve raw source; (2) the IIFE embed consumer needs `"default"` pointing at `deployer.js`; and (3) ESM bundler consumers need `"import"` pointing at `deployer.mjs`. Pitfall 25 documents exactly how this breaks when the condition order is wrong.

The canonical in-repo reference is `~/Develop/nsite/stealthis/vite.config.ts` (plain TypeScript, no Svelte). Phase 17's widget Vite config replicates that pattern and adds `@sveltejs/vite-plugin-svelte`. The deployer's Svelte component library output needs NO Vite config — the "svelte" condition points directly at `src/index.js` which re-exports from source. This means Phase 17 ships one real Vite config (`vite.widget.config.js`) and zero Vite configs for the library output.

**Primary recommendation:** Create root `package.json` → create `packages/deployer` scaffold with placeholder `src/index.js` → write `vite.widget.config.js` (stealthis + svelte plugin) → run `npm install` from root → run `npm run build:widget` → run `publint` → confirm apps/spa resolves `import ... from '@nsite/deployer'` via the "svelte" condition.

---

## Standard Stack

### Core

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| npm workspaces | built into npm 11.11.0 | Symlink `packages/deployer` into repo node_modules so apps/spa can `import '@nsite/deployer'` | Built into npm 7+; confirmed npm 11.11.0 is present on this machine; no extra tool needed |
| vite | 5.4.21 (already in apps/spa) | Build IIFE+ESM widget bundle via `build.lib` | Already installed, already proven in stealthis reference; no upgrade needed |
| @sveltejs/vite-plugin-svelte | 3.1.2 (already in apps/spa) | Compile Svelte components inside the widget bundle | Already installed at compatible version; 4.x requires Svelte 5 — do not upgrade |
| publint | 0.3.18 | Validate exports map correctness — checks that all declared paths resolve to real files | Current version (verified 2026-03-25 from npm registry); lightweight devDependency in packages/deployer only |

### Supporting

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| svelte | 4.2.20 (already in apps/spa) | peerDependency for packages/deployer | Declared as peerDependency in deployer package.json, NOT as a direct dependency — avoids bundling a second Svelte copy |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Manual exports map | `@sveltejs/package` (svelte-package CLI) | svelte-package adds SvelteKit as a dev dependency for 5 lines of JSON; overkill; does not support dual lib+widget builds |
| npm workspaces | pnpm workspaces | repo already uses package-lock.json v3 (npm); mixing would require all developers to switch package managers |
| `vite.widget.config.js` only | Single config with mode flag | Single config with incompatible externals (bundle svelte for IIFE, externalize for ESM lib) is difficult to get right; separate configs are simpler and the stealthis pattern uses separate configs |

**Installation (new devDependencies in packages/deployer only):**
```bash
# From packages/deployer after scaffolding package.json:
npm install --save-dev publint
# @sveltejs/vite-plugin-svelte and vite are hoisted from root — reference them as peerDeps
```

**Verified versions (2026-03-25):**
- `publint`: 0.3.18 (npm registry confirmed)
- `vite`: 5.4.21 (apps/spa/node_modules/vite/package.json confirmed)
- `@sveltejs/vite-plugin-svelte`: 3.1.2 (apps/spa/node_modules confirmed)
- `svelte`: 4.2.20 (apps/spa/node_modules confirmed)
- `node`: v22.22.1 (machine confirmed)
- `npm`: 11.11.0 (machine confirmed, supports workspaces)

---

## Architecture Patterns

### Recommended Project Structure

Phase 17 creates only the scaffold — placeholders only, no logic moved yet:

```
/ (repo root)
├── package.json                         # NEW: npm workspace manifest
│                                        # { "private": true, "workspaces": ["apps/spa", "packages/deployer"] }
├── deno.json                            # UNCHANGED: Deno workspace for relay/blossom/gateway/shared
│
├── apps/
│   └── spa/
│       └── package.json                 # MODIFIED: add "@nsite/deployer": "workspace:*"
│
└── packages/
    ├── shared/                          # UNCHANGED: Deno package (not in npm workspace)
    ├── stealthis/                       # UNCHANGED: existing dist-only shell (no source here)
    └── deployer/                        # NEW: entire directory
        ├── package.json                 # @nsite/deployer manifest with exports map
        ├── vite.widget.config.js        # IIFE+ESM widget build (the only Vite config)
        ├── svelte.config.js             # Svelte 4 preprocessor (copy of apps/spa's)
        └── src/
            └── index.js                 # Placeholder: export {} (Phase 18 fills this)
```

After `npm install` from root:
```
node_modules/
└── @nsite/
    └── deployer -> ../../packages/deployer   # symlink created by npm workspaces
```

### Pattern 1: Root Package.json (npm Workspace Manifest)

**What:** A minimal `package.json` at repo root that declares npm workspace members.
**When to use:** Required once per monorepo to enable symlink resolution.
**Example:**
```json
{
  "private": true,
  "workspaces": ["apps/spa", "packages/deployer"]
}
```

Key points:
- `"private": true` prevents accidentally publishing the root.
- Does NOT include Deno packages (`apps/relay`, `apps/blossom`, `apps/gateway`, `packages/shared`).
- After `npm install` from repo root, npm creates `node_modules/@nsite/deployer` symlink pointing at `packages/deployer`.
- The existing `apps/spa/package-lock.json` becomes the root `package-lock.json` — npm will regenerate it at root level on first `npm install`.

### Pattern 2: packages/deployer Exports Map

**What:** The exports map is the critical configuration — it must satisfy three consumers with different resolution needs.
**When to use:** Every package that is consumed both as a Svelte component library and as a pre-built bundle needs this dual-consumer exports map.

```json
{
  "name": "@nsite/deployer",
  "version": "0.1.0",
  "type": "module",
  "private": false,
  "exports": {
    ".": {
      "svelte": "./src/index.js",
      "import": "./dist/deployer.mjs",
      "default": "./dist/deployer.js"
    }
  },
  "main": "dist/deployer.js",
  "module": "dist/deployer.mjs",
  "scripts": {
    "build:widget": "vite build --config vite.widget.config.js",
    "dev:widget": "vite build --config vite.widget.config.js --watch"
  },
  "peerDependencies": {
    "svelte": "^4.0.0"
  },
  "devDependencies": {
    "publint": "^0.3.18"
  }
}
```

**Why `"svelte"` condition points at `src/index.js` not a `.svelte` file:**
The "svelte" condition is a package-level entry point, not a per-file condition. It must point at a JS/TS index file that re-exports things. In Phase 17 with placeholder only, `src/index.js` is `export {};`. In later phases it will export `DeployerWidget` and lib functions. The SPA's Vite + `@sveltejs/vite-plugin-svelte` 3.x handles the `.svelte` file imports found inside that module natively.

**Condition resolution order matters:** Node.js and bundlers evaluate conditions in declaration order. `"svelte"` must come before `"import"` and `"default"` — otherwise a Svelte consumer might accidentally resolve to the pre-built bundle.

### Pattern 3: Vite Widget Config (IIFE+ESM, Svelte Inlined)

**What:** A dedicated Vite config for the self-contained widget bundle.
**When to use:** Any time Svelte must be compiled into a standalone bundle (no external runtime).

```js
// packages/deployer/vite.widget.config.js
import { defineConfig } from 'vite';
import { svelte } from '@sveltejs/vite-plugin-svelte';

export default defineConfig({
  plugins: [
    svelte({
      compilerOptions: {
        css: 'injected'   // Svelte 4: inject compiled CSS into JS
      }
    })
  ],
  build: {
    lib: {
      entry: 'src/widget/index.js',   // placeholder in Phase 17
      name: 'NsiteDeployer',
      formats: ['iife', 'es'],
      fileName: (format) => format === 'es' ? 'deployer.mjs' : 'deployer.js'
    },
    outDir: 'dist',
    cssCodeSplit: false,          // all CSS into single bundle (default false in lib mode)
    rollupOptions: {
      output: {
        inlineDynamicImports: true  // single file per format, no chunk splitting
      }
      // No `external` here — IIFE bundle must be fully self-contained
    }
  }
});
```

**Critical difference from the ESM library pattern:** For the IIFE+ESM widget build, Svelte is NOT externalized — it must be bundled in because the widget is self-contained. This is why a separate config file is required (the lib ESM output would externalize svelte, but the widget bundle cannot).

**In Phase 17:** The widget entry point (`src/widget/index.js`) is a placeholder:
```js
// Phase 17 placeholder — Phase 20 provides the real HTMLElement wrapper
export const VERSION = '0.1.0';
```
This is enough to produce real `deployer.js` and `deployer.mjs` output files that satisfy the build success criterion.

### Pattern 4: SPA Dependency Addition

**What:** apps/spa/package.json must declare the workspace dependency.
**When to use:** Required for the SPA to resolve `import from '@nsite/deployer'` through the workspace symlink.

```json
// apps/spa/package.json — add to "dependencies":
"@nsite/deployer": "workspace:*"
```

Note: `"workspace:*"` is the npm workspaces protocol. npm 7+ supports it and resolves to the local symlink. This is different from pnpm's `"workspace:^"` — npm uses `"workspace:*"` or `"workspace:^version"`.

### Pattern 5: publint Validation

**What:** Run publint after building to confirm zero export errors.
**When to use:** Every time package.json exports map is changed, before declaring Phase 17 complete.

```bash
# From packages/deployer after build:widget runs
npx publint
# Or with explicit package path from repo root:
npx publint packages/deployer
```

publint 0.3.18 checks:
- All paths declared in `exports` resolve to real files
- The `"svelte"` condition path exists
- `main` and `module` legacy fields point to real files
- No deprecated top-level `"svelte"` field without corresponding `exports` condition

### Anti-Patterns to Avoid

- **Using `"workspace:*"` in deployer's own package.json for peer deps:** peerDependencies use version ranges, not workspace protocol — use `"^4.0.0"` for svelte.
- **Adding deployer to deno.json workspace:** The Deno workspace (`deno.json` at root) manages Deno packages only. packages/deployer is npm-only — it MUST NOT appear in `deno.json`.
- **Creating a `vite.config.js` for the Svelte library output:** The "svelte" condition exports raw source. Zero Vite processing needed for the library mode. Only `vite.widget.config.js` exists in Phase 17.
- **Externalizing Svelte in the widget build config:** The IIFE bundle needs Svelte inlined. Adding `external: ['svelte']` to vite.widget.config.js breaks the widget bundle — it would produce output that depends on a global `svelte` that does not exist on the embedding page.
- **Running `npm install` inside `packages/deployer` directly:** All npm operations must run from repo root for workspaces to resolve correctly. Running `npm install` inside a workspace member creates a local `node_modules` that shadows the root hoisted packages.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Package symlink wiring | npm link scripts, relative path hacks | npm workspaces in root package.json | npm link breaks on re-install; workspace protocol is stable and CI-friendly |
| Exports map validation | Custom script that checks file paths exist | publint | publint checks all export conditions, validates condition ordering, checks deprecated fields |
| IIFE+ESM dual format output | Manual rollup config | Vite lib mode `formats: ['iife', 'es']` | Already proven in stealthis; handles format-specific naming via fileName callback |
| CSS injection into shadow DOM | CSS file loading, link element injection | `compilerOptions: { css: 'injected' }` + `cssCodeSplit: false` | Svelte 4 + Vite lib mode bundles CSS into JS; no separate CSS file emitted |

**Key insight:** The entire Phase 17 infrastructure can be implemented with zero new runtime code — only configuration files (`package.json`, `vite.widget.config.js`, `svelte.config.js`) and placeholder source files (`src/index.js`, `src/widget/index.js`). Every tool needed already exists in the repo or npm registry.

---

## Common Pitfalls

### Pitfall A: Wrong "svelte" Condition Target (Pitfall 25 from PITFALLS.md)

**What goes wrong:** The "svelte" condition is pointed directly at a `.svelte` file instead of a JS index. Or the condition is missing entirely and @sveltejs/vite-plugin-svelte 3.x falls back to `"main"` (which points at the pre-built IIFE). The SPA build resolves to pre-compiled output and loses HMR/Svelte processing.

**Why it happens:** The "svelte" condition is a package entry point, not a per-file directive. It must point at `src/index.js` (which can then import/export `.svelte` files). Pointing it at `./src/components/DeployerWidget.svelte` directly breaks the condition semantics.

**How to avoid:** `"svelte": "./src/index.js"` — a JS module that acts as the package entry point for Svelte consumers. In Phase 17 this is just `export {};`. Validate with publint that the path resolves.

**Warning signs:** vite-plugin-svelte emits "WARNING: The following packages have a svelte field in their package.json but no exports condition" — or the SPA's import resolves to deployer.js instead of src/index.js.

### Pitfall B: Svelte Bundled Twice When SPA Imports Deployer (Pitfall 24 from PITFALLS.md)

**What goes wrong:** Phase 17 only ships placeholder exports, so this won't manifest yet. But the vite.widget.config.js configuration sets the wrong precedent: if Svelte is NOT externalized in a future ESM lib build config, two Svelte runtimes end up in the SPA bundle. Reactivity breaks, stores don't propagate.

**Why it happens:** Vite lib mode does not auto-externalize peer dependencies. Phase 17 only ships the widget config (where Svelte is intentionally inlined), so this risk is deferred. BUT: the exports map must NOT have a condition that makes the SPA accidentally resolve to the widget's built output. The "svelte" condition must come first and point at source.

**How to avoid:** Condition order in package.json exports: `"svelte"` first, then `"import"` (for ESM bundlers that don't know about "svelte"), then `"default"` (IIFE fallback). The SPA uses vite-plugin-svelte which activates the "svelte" condition — so it will always resolve to source, not the built output.

**Warning signs:** `apps/spa` build output is unexpectedly large (>200KB added for deployer module); double-registration errors; stores not reactive.

### Pitfall C: package-lock.json Conflict After Root package.json Creation

**What goes wrong:** `apps/spa` currently has its own `package-lock.json` at `apps/spa/package-lock.json`. When a root `package.json` with workspaces is added and `npm install` is run from root, npm creates a new root-level `package-lock.json` and may conflict with or replace the SPA's existing lockfile.

**Why it happens:** npm workspaces moves the lock file authority to the root. The existing `apps/spa/package-lock.json` becomes stale and will be ignored in favour of the root lockfile.

**How to avoid:** When running `npm install` from root for the first time, npm generates a new root `package-lock.json` from scratch. The old `apps/spa/package-lock.json` should be deleted after verifying the SPA still builds correctly — or left in place (npm will ignore it). Do not commit both. The root lockfile is the source of truth going forward.

**Warning signs:** `npm install` warns about "existing lockfile"; SPA's node_modules differ from what's in the root lock.

### Pitfall D: Deno Workspace + npm Workspace Double-Declaration

**What goes wrong:** The root `deno.json` already manages a Deno workspace (`apps/relay`, `apps/blossom`, `apps/gateway`, `packages/shared`). A root `package.json` creates an npm workspace. If someone accidentally adds `packages/deployer` to `deno.json`'s workspace list, Deno will try to resolve it as a Deno module and fail (it has no `deno.json`).

**Why it happens:** The monorepo has two coexisting workspace systems that are intentionally separate. The boundary is: npm manages SPA + deployer; Deno manages everything else.

**How to avoid:** `packages/deployer` appears ONLY in the root `package.json` workspaces array, NEVER in `deno.json`. Confirmed by D-04.

**Warning signs:** `deno task build` fails with "workspace member not found"; `deno check` attempts to process `packages/deployer/src/`.

### Pitfall E: publint Fails Because dist/ Does Not Exist Yet

**What goes wrong:** publint validates that all declared export paths exist as real files. If `vite.widget.config.js` has not been run yet, `dist/deployer.js` and `dist/deployer.mjs` do not exist. publint reports errors for `"import"` and `"default"` conditions even though the package.json is correct.

**Why it happens:** publint checks file existence, not config validity. The build must be run before publint is run.

**How to avoid:** Phase 17 plan must sequence: (1) scaffold package.json, (2) run `npm run build:widget`, (3) run publint. Do not run publint on a freshly scaffolded package before building.

**Warning signs:** publint reports `"import": "./dist/deployer.mjs" — path does not exist`.

---

## Code Examples

Verified patterns from official sources and in-repo references:

### Root package.json (Workspace Manifest)
```json
{
  "private": true,
  "workspaces": [
    "apps/spa",
    "packages/deployer"
  ]
}
```
Source: npm workspaces docs + D-04/D-05 locked decisions. No `"name"` field needed for a private root.

### packages/deployer/package.json (Full Example)
```json
{
  "name": "@nsite/deployer",
  "version": "0.1.0",
  "type": "module",
  "private": false,
  "exports": {
    ".": {
      "svelte": "./src/index.js",
      "import": "./dist/deployer.mjs",
      "default": "./dist/deployer.js"
    }
  },
  "main": "dist/deployer.js",
  "module": "dist/deployer.mjs",
  "scripts": {
    "build:widget": "vite build --config vite.widget.config.js",
    "dev:widget": "vite build --config vite.widget.config.js --watch"
  },
  "peerDependencies": {
    "svelte": "^4.0.0"
  },
  "devDependencies": {
    "@sveltejs/vite-plugin-svelte": "^3.1.2",
    "publint": "^0.3.18",
    "vite": "^5.4.0"
  }
}
```
Note: `@sveltejs/vite-plugin-svelte` and `vite` are devDependencies in the deployer so they are available for the widget build. They will be hoisted from root node_modules since the same versions are already in apps/spa.

### packages/deployer/vite.widget.config.js
```js
import { defineConfig } from 'vite';
import { svelte } from '@sveltejs/vite-plugin-svelte';

export default defineConfig({
  plugins: [
    svelte({
      compilerOptions: {
        css: 'injected'
      }
    })
  ],
  build: {
    lib: {
      entry: 'src/widget/index.js',
      name: 'NsiteDeployer',
      formats: ['iife', 'es'],
      fileName: (format) => format === 'es' ? 'deployer.mjs' : 'deployer.js'
    },
    outDir: 'dist',
    cssCodeSplit: false,
    rollupOptions: {
      output: {
        inlineDynamicImports: true
      }
    }
  }
});
```
Source: Direct adaptation of `~/Develop/nsite/stealthis/vite.config.ts` (HIGH confidence — confirmed working in-repo reference) with Svelte plugin added per STACK.md.

### packages/deployer/svelte.config.js
```js
import { vitePreprocess } from '@sveltejs/vite-plugin-svelte';

export default {
  preprocess: vitePreprocess(),
};
```
Source: Exact copy of `apps/spa/svelte.config.js` — confirmed working (HIGH confidence).

### packages/deployer/src/index.js (Phase 17 Placeholder)
```js
// Placeholder — Phase 18 moves lib files here, Phase 19 adds Svelte components
export {};
```

### packages/deployer/src/widget/index.js (Phase 17 Placeholder)
```js
// Placeholder for IIFE+ESM widget entry — Phase 20 provides the HTMLElement wrapper
export const VERSION = '0.1.0';
```
This produces a valid (if minimal) `dist/deployer.js` and `dist/deployer.mjs` that satisfy the build success criterion.

### apps/spa/package.json Change (Dependency Addition Only)
```json
// Add to "dependencies" in apps/spa/package.json:
"@nsite/deployer": "workspace:*"
```

### Verifying Workspace Resolution After npm install
```bash
# From repo root — confirms symlink was created:
ls -la node_modules/@nsite/
# Should show: deployer -> ../../packages/deployer

# Confirm SPA can resolve the import (no error expected):
cd apps/spa && node -e "import('@nsite/deployer').then(() => console.log('OK'))"
```

### publint Validation Command
```bash
# From packages/deployer after build:widget
npx publint .

# Or from repo root:
npx publint packages/deployer
```
Expected output when correct: zero errors, zero warnings. If the "svelte" condition path does not exist, publint reports an error.

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Top-level `"svelte"` field in package.json | `"svelte"` condition inside `exports` map | vite-plugin-svelte 3.x (late 2023) | Top-level field triggers deprecation warning; must use conditional exports |
| npm link for local package development | npm workspaces | npm 7+ (Node 15+, mid 2020) | Workspaces survive re-installs and work in CI without extra setup |
| Separate `rollup.config.js` for library builds | Vite `build.lib` mode | Vite 2.x (2021) | Vite lib mode wraps rollup with opinionated defaults; less config for standard library patterns |

**Deprecated/outdated:**
- Top-level `"svelte"` field in package.json: triggers warning in vite-plugin-svelte 3.x; replace with `exports["."]["svelte"]` condition
- `npm link` for local packages: broken by `npm install --force` and unreliable in CI; use workspaces

---

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| npm | Workspace wiring, package install | Yes | 11.11.0 | — |
| Node.js | npm, Vite execution | Yes | v22.22.1 | — |
| vite | Widget IIFE+ESM build | Yes (in apps/spa) | 5.4.21 | — |
| @sveltejs/vite-plugin-svelte | Widget Svelte compilation | Yes (in apps/spa) | 3.1.2 | — |
| publint | Exports map validation | No (not yet installed) | — | Install as devDep in packages/deployer |
| apps/spa/package-lock.json | Existing lockfile (will move to root) | Yes | lockfileVersion 3 | Delete after root lockfile generated |

**Missing dependencies with no fallback:**
- None — all required tools are present on the machine.

**Missing dependencies with fallback:**
- publint: not yet installed anywhere; install as `devDependencies` in `packages/deployer` during scaffold. Plan must include this install step.

---

## Open Questions

1. **packages/stealthis in nsite.run — in or out of npm workspace?**
   - What we know: `packages/stealthis` exists at `/home/sandwich/Develop/nsite.run/packages/stealthis/` but has no `package.json` or source files — only `dist/` and `node_modules/`. Its dist contains `nsite-deploy.js` and `nsite-deploy.mjs`.
   - What's unclear: Is this package intentionally excluded from the npm workspace (likely yes — it appears to be a build artifact shell or symlink target, not a source package), or should it be included in the workspace?
   - Recommendation: Do NOT include `packages/stealthis` in the npm workspace. D-04 explicitly scopes workspaces to `["apps/spa", "packages/deployer"]`. The planner should not add stealthis to the workspace array.

2. **apps/spa/package-lock.json fate after root workspace creation**
   - What we know: apps/spa has its own `package-lock.json` (lockfileVersion 3). npm workspaces will generate a new root-level lockfile on first `npm install` from root.
   - What's unclear: Should the plan explicitly delete `apps/spa/package-lock.json` before running root `npm install`, or let npm handle it?
   - Recommendation: Delete `apps/spa/package-lock.json` as an explicit plan step before running `npm install` from root. This avoids ambiguity about which lockfile is authoritative and prevents npm from emitting confusing warnings.

3. **apps/spa/node_modules fate after workspace hoisting**
   - What we know: apps/spa currently has its own `node_modules/` (all SPA dependencies installed there locally).
   - What's unclear: After root `npm install`, will npm re-hoist all SPA deps to root `node_modules` or leave the SPA's local `node_modules` intact?
   - Recommendation: npm workspaces hoist compatible deps to root but leaves workspace-specific deps in place when there are version conflicts. In practice apps/spa's `node_modules` will mostly be redundant after root install. The plan should include running `npm install` from root and verifying `apps/spa` builds correctly with `vite build` before committing. Do not manually delete `apps/spa/node_modules` — let npm manage the hoisting.

---

## Sources

### Primary (HIGH confidence)
- `/home/sandwich/Develop/nsite/stealthis/vite.config.ts` — Canonical IIFE+ESM Vite lib mode config (in-repo working reference)
- `/home/sandwich/Develop/nsite/stealthis/src/widget.ts` — Canonical HTMLElement+shadow DOM pattern (in-repo working reference)
- `/home/sandwich/Develop/nsite/stealthis/package.json` — Exports map with import/default conditions
- `/home/sandwich/Develop/nsite.run/apps/spa/package.json` — Confirmed versions: svelte@4.2.20, vite@^5.0.0, @sveltejs/vite-plugin-svelte@^3.0.0
- `/home/sandwich/Develop/nsite.run/apps/spa/vite.config.js` — Confirmed svelte() plugin usage in SPA
- `/home/sandwich/Develop/nsite.run/apps/spa/svelte.config.js` — Confirmed vitePreprocess() pattern
- `.planning/research/STACK.md` — Prior research: version constraints, dual Vite config pattern, "svelte" condition structure
- `.planning/research/PITFALLS.md` (Pitfall 24, 25) — Prior research: Svelte externalization in lib mode, exports map "svelte" condition requirements
- npm registry: `publint@0.3.18` — current version confirmed 2026-03-25

### Secondary (MEDIUM confidence)
- `npm --version` → 11.11.0 confirms workspaces support (npm 7+ required)
- `node --version` → v22.22.1 confirms Node version compatible with npm workspaces v3 lockfile

### Tertiary (LOW confidence)
- None

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — all versions confirmed from installed node_modules and npm registry
- Architecture: HIGH — patterns verified against working stealthis reference and prior stack/architecture research
- Pitfalls: HIGH — Pitfalls 24 and 25 derived from official vite-plugin-svelte FAQ and Svelte packaging docs in prior research

**Research date:** 2026-03-25
**Valid until:** 2026-04-25 (stable ecosystem — vite 5.x, svelte 4.x, npm workspaces; no fast-moving components)
