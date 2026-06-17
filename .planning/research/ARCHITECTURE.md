# Architecture Research

**Domain:** Svelte component extraction — monorepo package split for nsite deployer
**Researched:** 2026-03-25
**Confidence:** HIGH

## Standard Architecture

### System Overview

```
┌─────────────────────────────────────────────────────────────────────┐
│                      packages/deployer                               │
│                                                                       │
│  ┌──────────────────────┐    ┌──────────────────────────────────┐   │
│  │   Core Lib Layer     │    │      Svelte Components           │   │
│  │                      │    │                                  │   │
│  │  nostr.js            │    │  DeployerWidget.svelte           │   │
│  │  upload.js           │    │  (deploy + manage + update       │   │
│  │  publish.js          │    │   self-contained with auth)      │   │
│  │  crypto.js           │    │                                  │   │
│  │  files.js            │    │  Sub-components:                 │   │
│  │  store.js            │    │  DeployZone, FileTree,           │   │
│  │  scanner.js          │    │  ProgressIndicator, SuccessPanel,│   │
│  │  base36.js           │    │  ManageSite, LoginModal,         │   │
│  │                      │    │  AdvancedConfig, ActivityRings   │   │
│  └──────────────────────┘    └──────────────────────────────────┘   │
│                                                                       │
│  ┌──────────────────────────────────────────────────────────────┐   │
│  │               Web Component Entry Point                       │   │
│  │                                                               │   │
│  │  web-component/index.js → defines <nsite-deploy> custom      │   │
│  │  element wrapping DeployerWidget in shadow DOM                │   │
│  └──────────────────────────────────────────────────────────────┘   │
│                                                                       │
│  Build outputs: src/ (Svelte source for SPA import)                  │
│                 dist/deployer.iife.js (script tag embed)              │
│                 dist/deployer.mjs     (ESM embed)                     │
└─────────────────────────────────────────────────────────────────────┘
            │                                    │
            │ svelte source import               │ IIFE/ESM bundle
            ▼                                    ▼
┌─────────────────────┐              ┌──────────────────────┐
│     apps/spa        │              │   Any HTML page       │
│                     │              │   (embedded nsites)   │
│  App.svelte         │              │                       │
│  (thin shell):      │              │  <script src=         │
│  - Navbar           │              │   deployer.iife.js>   │
│  - NIP5ABanner      │              │  <nsite-deploy>       │
│  - ToolsResources   │              │   </nsite-deploy>     │
│  - <DeployerWidget> │              │                       │
└─────────────────────┘              └──────────────────────┘
```

### Component Responsibilities

| Component | Responsibility | Location After Extraction |
|-----------|----------------|--------------------------|
| DeployerWidget.svelte | Master orchestrator: deploy flow, manage flow, state coordination | packages/deployer/src/components/ |
| DeployZone.svelte | Drag-drop file selection, archive extraction | packages/deployer/src/components/ |
| FileTree.svelte | File tree display, per-file exclude toggles | packages/deployer/src/components/ |
| ProgressIndicator.svelte | Upload/publish progress bars | packages/deployer/src/components/ |
| SuccessPanel.svelte | Post-deploy success display and navigation | packages/deployer/src/components/ |
| ManageSite.svelte | Site listing, delete flow | packages/deployer/src/components/ |
| LoginModal.svelte | NIP-07/NIP-46/anonymous auth UI | packages/deployer/src/components/ |
| AdvancedConfig.svelte | Extra relays/blossoms configuration | packages/deployer/src/components/ |
| ActivityRings.svelte | Progress ring visualization | packages/deployer/src/components/ |
| OperationBanner.svelte | Cross-tab operation status | packages/deployer/src/components/ |
| nostr.js | Signer creation, relay queries, manifest fetch | packages/deployer/src/lib/ |
| upload.js | BUD-02 blob check/upload/delete | packages/deployer/src/lib/ |
| publish.js | Manifest build and relay publish | packages/deployer/src/lib/ |
| crypto.js | SHA-256 via WebCrypto | packages/deployer/src/lib/ |
| files.js | Archive extraction, file tree, MIME types | packages/deployer/src/lib/ |
| store.js | Svelte writable stores, localStorage persistence | packages/deployer/src/lib/ |
| scanner.js | Secret file scanning | packages/deployer/src/lib/ |
| base36.js | Base36 encode/decode for named site URLs | packages/deployer/src/lib/ |
| App.svelte | Thin shell: Navbar, NIP5ABanner, ToolsResources wrapper | apps/spa/src/ (modified, not moved) |
| Navbar.svelte | Top navigation, login button | apps/spa/src/components/ (stays in SPA) |
| NIP5ABanner.svelte | NIP-5 achievement banner | apps/spa/src/components/ (stays in SPA) |
| ToolsResources.svelte | Static educational content | apps/spa/src/components/ (stays in SPA) |

## Recommended Project Structure

```
packages/deployer/
├── package.json              # @nsite/deployer, exports map
├── vite.config.js            # Svelte lib entry + web-component entry
├── svelte.config.js          # Svelte 4 preprocessor
├── src/
│   ├── index.js              # Named exports: DeployerWidget + all lib functions
│   ├── lib/                  # Framework-agnostic core (moved from apps/spa/src/lib/)
│   │   ├── nostr.js
│   │   ├── upload.js
│   │   ├── publish.js
│   │   ├── crypto.js
│   │   ├── files.js
│   │   ├── store.js
│   │   ├── scanner.js
│   │   └── base36.js
│   ├── components/           # Svelte UI (moved from apps/spa/src/components/)
│   │   ├── DeployerWidget.svelte   # NEW: handleDeploy + tab UI extracted from App.svelte
│   │   ├── DeployZone.svelte
│   │   ├── FileTree.svelte
│   │   ├── ProgressIndicator.svelte
│   │   ├── SuccessPanel.svelte
│   │   ├── ManageSite.svelte
│   │   ├── LoginModal.svelte
│   │   ├── AdvancedConfig.svelte
│   │   ├── ActivityRings.svelte
│   │   ├── LogoutConfirmModal.svelte
│   │   ├── NIP46Dialog.svelte
│   │   └── OperationBanner.svelte
│   └── web-component/
│       └── index.js          # customElements.define('nsite-deploy', ...)
└── dist/                     # Build output (gitignored)
    ├── deployer.iife.js       # IIFE bundle (script tag embed)
    └── deployer.mjs           # ESM bundle (type=module embed)

apps/spa/src/
├── App.svelte                # MODIFIED: thin shell, imports DeployerWidget
├── app.css
├── main.js
└── components/               # SPA-only components (not in deployer)
    ├── Navbar.svelte
    ├── NIP5ABanner.svelte
    ├── ToolsResources.svelte
    └── tools-resources.yaml
```

### Structure Rationale

- **packages/deployer/src/lib/:** All lib files are already framework-agnostic plain JS. Move verbatim — no rewrite needed. They use `import.meta.env.VITE_*` for service URL overrides, which works unchanged in both Vite-built SPA and Vite-built package.
- **packages/deployer/src/components/:** Deployer-specific Svelte components move wholesale. Components that render the site frame (Navbar, NIP5ABanner, ToolsResources) stay in apps/spa.
- **DeployerWidget.svelte:** The primary new file. It contains the ~380-line `handleDeploy()` logic and tab coordination currently in App.svelte. It accepts a `signer` prop for external signer injection and exposes the full deploy+manage flow internally.
- **web-component/index.js:** Separate entry point from the Svelte component. Wraps DeployerWidget in a custom element with shadow DOM, handles the button-to-modal pattern.
- **Two Vite build targets:** `src/index.js` for Svelte library mode (processable by SPA's Vite as raw Svelte source), and `src/web-component/index.js` for IIFE+ESM bundled output. Both targets live in the same package.json with separate `exports` entries.

## Architectural Patterns

### Pattern 1: Optional Signer Prop

**What:** DeployerWidget accepts an optional `signer` prop. When provided, the widget skips its built-in auth UI and uses the external signer directly. When absent, the widget renders LoginModal/NIP46Dialog/anonymous flow internally.

**When to use:** SPA passes `signer` after user logs in via Navbar's LoginModal. Web Component embed has no external signer available and always uses the built-in auth.

**Trade-offs:** Eliminates session-sharing complexity. SPA keeps its own session/auth state in App.svelte where the Navbar also needs it. Deployer does not own the top-level session store — only its own deploy-scoped state.

**Example:**
```svelte
<!-- apps/spa App.svelte — with signer from Navbar login -->
<DeployerWidget signer={currentSigner} on:logout />

<!-- Web Component embed — no signer, uses built-in auth -->
<nsite-deploy></nsite-deploy>
```

### Pattern 2: Vite Library Mode with Dual Entry Points

**What:** A single package.json defines two separate Vite build targets: one for the Svelte component (consumed by apps/spa's Vite pipeline as raw source), and one for the self-contained IIFE+ESM web component bundle.

**When to use:** When the same logic must be usable both as a Svelte dependency and as a standalone drop-in script. The stealthis reference uses this exact approach (formats: ['iife', 'es'] in vite.config.ts).

**Trade-offs:** Two build passes per release. The SPA import resolves to Svelte source so Vite can tree-shake and process the component natively. The IIFE bundle is fully self-contained and must inline all dependencies (applesauce-signers, nostr-tools, fflate, etc.).

**Example:**
```json
// packages/deployer/package.json
{
  "name": "@nsite/deployer",
  "exports": {
    ".": {
      "svelte": "./src/index.js",
      "default": "./dist/deployer.mjs"
    },
    "./web-component": {
      "import": "./dist/deployer.mjs",
      "default": "./dist/deployer.iife.js"
    }
  }
}
```

The SPA's vite.config.js does not need changes — it picks up the `"svelte"` export condition automatically when processing the package as a workspace dependency.

### Pattern 3: Store Isolation via Store Factory

**What:** Instead of module-level singleton stores, the deployer uses a store factory that creates isolated instances. The Web Component creates its own store instances; the SPA creates stores at App.svelte level and passes the signer down as a prop.

**When to use:** Required if multiple deployer widget instances could coexist on a page. Also prevents localStorage key collisions when the Web Component and the SPA share an origin during development.

**Trade-offs:** Slightly more complex than the current singleton pattern. Svelte `setContext`/`getContext` is the clean way to propagate stores down the component tree without prop-drilling every store.

**Example:**
```js
// packages/deployer/src/lib/store.js
export function createDeployerStores(options = {}) {
  const prefix = options.storagePrefix ?? 'nsite';
  return {
    session: persistedStore(`${prefix}_session`, DEFAULT_SESSION),
    deployState: writable({ step: 'idle', files: [], warnings: [], progress: 0, result: null, error: null }),
    serverConfig: persistedStore(`${prefix}_servers`, { extraRelays: [], extraBlossoms: ['https://nostr.download', 'https://blssm.us'] }),
  };
}
```

For the SPA refactor, the simplest approach is: App.svelte creates a `session` store for the Navbar, and DeployerWidget creates its own internal deployer stores. The signer (non-serializable) is passed as a prop at the boundary.

## Data Flow

### Deploy Flow (packages/deployer internal)

```
User drops files
    ↓
DeployZone dispatches 'files-selected' { files, tree, warnings, excluded }
    ↓
DeployerWidget.handleFilesSelected() sets selectedFiles, updates deployState
    ↓
User clicks Deploy
    ↓
DeployerWidget.handleDeploy():
  1. Ensure signer (prop or create anonymous)
  2. Hash files (hashFile per file → sha256)
  3. checkExistence(hashedFiles, blossomUrls) → existing Map
  4. uploadBlobs(hashedFiles, existing, signer, blossomUrls) → uploadResult
  5. publishManifest(signer, files, servers, relays, options) → publishResult
    ↓
deployState store updates (idle → hashing → checking → uploading → publishing → success/error)
    ↓
ProgressIndicator and SuccessPanel react to deployState
```

### SPA Integration Data Flow (apps/spa → packages/deployer)

```
App.svelte
    │
    ├── owns: currentSigner (from Navbar LoginModal)
    ├── owns: session store (for Navbar display: avatar, name, logout)
    │
    └── passes to DeployerWidget:
        - signer prop → widget skips LoginModal
        - on:logout event → App.svelte clears session and signer
        (DeployerWidget owns deployState, serverConfig, all deploy logic internally)
```

### Web Component Data Flow

```
<nsite-deploy> custom element
    │
    ├── shadow DOM (style isolation)
    ├── DeployerWidget mounted inside shadow root
    ├── no external signer → built-in auth flow (LoginModal)
    └── NSITE_RELAY/BLOSSOM derived from window.location (same-origin default)
        or HTML attribute overrides: relay="wss://..." blossom="https://..."
```

### Key Data Flows

1. **Signer propagation:** App.svelte holds the live signer object (non-serializable, lost on reload) and passes it to DeployerWidget as a prop. DeployerWidget does not independently manage auth when a signer is provided. This boundary is correct — the Navbar requires the signer for logout/backup display, so it must stay at the App level.

2. **Store isolation:** `deployState` is deployer-internal (Navbar and ToolsResources never need it). `session` and `serverConfig` are either deployer-internal (Web Component case) or shared with App.svelte (SPA case — App creates the session store for the Navbar, Deployer creates its own). The signer crosses the boundary as a prop, not via a store.

3. **Service URL resolution:** `nostr.js` derives NSITE_RELAY/NSITE_BLOSSOM/NSITE_GATEWAY_HOST from `window.location` at module load, with `import.meta.env.VITE_*` overrides. This pattern works unchanged in both the SPA (Vite provides VITE_* at build time) and the Web Component (falls back to origin of the embedding page, which is correct for nsites deployed to nsite.run).

## Scaling Considerations

| Scale | Architecture Adjustments |
|-------|--------------------------|
| Single SPA (current) | App.svelte passes signer prop; DeployerWidget is the whole deploy UI |
| SPA plus multiple embedded pages | Web Component IIFE bundle served from CDN; nsite authors add script tag |
| Third-party Svelte apps | npm install @nsite/deployer; import DeployerWidget; pass signer prop |

### Scaling Priorities

1. **First bottleneck:** The package boundary itself — getting the Svelte component to build cleanly as a library while remaining processable by the SPA's Vite as raw source. Solution: export Svelte source under the `"svelte"` export condition; apps/spa's Vite processes it natively like a local component.
2. **Second bottleneck:** The Web Component bundle size — applesauce-signers + nostr-tools + fflate + svelte runtime adds up. Mitigate with aggressive Rollup tree-shaking. The stealthis reference shows this is achievable with fewer deps and no Svelte runtime; the deployer bundle will be larger but acceptable for an opt-in embed.

## Anti-Patterns

### Anti-Pattern 1: Moving Session Store into packages/deployer as Singleton

**What people do:** Export `session` and `serverConfig` as module-level singletons from packages/deployer, then import them in both the SPA and the deployer components.

**Why it's wrong:** The SPA's Navbar needs the session for user display (avatar, name, logout). If the session store is owned by packages/deployer, Navbar becomes a dependent of the deployer package, reversing the dependency direction. Singleton stores also prevent the Web Component from having its own isolated state.

**Do this instead:** DeployerWidget owns its stores internally. The SPA's App.svelte creates a separate session store for the Navbar and passes the signer to DeployerWidget as a prop. The stores are not shared across the boundary.

### Anti-Pattern 2: Including Navbar, NIP5ABanner, and ToolsResources in DeployerWidget

**What people do:** Include these in DeployerWidget because they're rendered alongside the deploy UI in the current App.svelte.

**Why it's wrong:** Navbar, NIP5ABanner, and ToolsResources are SPA-frame concerns — they reference nsite.run branding, educational YAML content, and the NIP-5A celebration feature. They have no place in a generic deployer widget and would make the package unusable in any other context.

**Do this instead:** These three components stay in apps/spa/src/components/. App.svelte renders them outside DeployerWidget. The boundary is: everything inside the main content area that is deploy-flow-specific goes into DeployerWidget; the page frame stays in App.svelte.

### Anti-Pattern 3: Single Vite Entry for Both Svelte Library and Web Component

**What people do:** Configure one Vite lib build that outputs both the Svelte component and the IIFE web component bundle from the same entry point.

**Why it's wrong:** The Svelte component entry needs Svelte externalized (SPA brings its own Svelte). The IIFE bundle needs Svelte inlined (no external runtime available in an embedded context). These are incompatible externals requirements for a single rollupOptions config.

**Do this instead:** Two separate entry points (`src/index.js` and `src/web-component/index.js`) with per-entry externals configuration, or two separate build commands. The stealthis reference uses a single entry because it has no Svelte — for a Svelte-based deployer, the split is required.

### Anti-Pattern 4: Relying on Svelte Scoped Styles for Shadow DOM Isolation

**What people do:** Mount a Svelte component directly as the Web Component's render target and rely on Svelte's scoped class names for shadow DOM style isolation.

**Why it's wrong:** Svelte 4's compiled CSS uses scoped attribute selectors that are injected into `document.head` by default. This does not pierce the shadow DOM boundary — styles are invisible to components mounted inside a shadow root.

**Do this instead:** For the Web Component entry, inject styles as a `<style>` tag inside the shadow root in the custom element constructor. Compile Svelte with `emitCss: false` in the vite-plugin-svelte options and manage the CSS string manually (the stealthis `styles.ts` pattern). Tailwind utility classes must also be either included in the injected string or omitted from the web component variant.

## Integration Points

### New Package Dependency

| Boundary | Communication | Notes |
|----------|---------------|-------|
| apps/spa → packages/deployer | `import DeployerWidget from '@nsite/deployer'` via `"svelte"` export condition | SPA's Vite processes raw Svelte source; no pre-build step needed for dev server |
| packages/deployer → packages/shared | No dependency | packages/shared is Deno-only (relay/blossom/gateway types); deployer uses npm deps directly |
| Web Component bundle | Self-contained IIFE/ESM | No external dependencies; bundle inlines svelte runtime and all npm deps |

### External Service Integration

| Service | Integration Pattern | Notes |
|---------|---------------------|-------|
| Nostr relays | WebSocket, raw protocol (queryRelay, publishToRelay) | nostr.js implements its own minimal WS client; RelayPool only used for NIP-46 |
| Blossom servers | REST (HEAD check, PUT upload, DELETE) | upload.js; auth via BUD-02 kind 24242 events |
| NIP-07 extension | `window.nostr` via applesauce-signers ExtensionSigner | Requires browser extension |
| NIP-46 bunker | WebSocket via NostrConnectSigner (applesauce-signers) | Uses DEFAULT_RELAYS for handshake, not NSITE_RELAY |

### New vs. Modified: What Changes

**New files (packages/deployer):**
- `packages/deployer/package.json` — @nsite/deployer package definition
- `packages/deployer/vite.config.js` — dual-target Vite build (Svelte lib + web component)
- `packages/deployer/svelte.config.js` — Svelte 4 preprocessor config
- `packages/deployer/src/index.js` — named exports (DeployerWidget and lib functions)
- `packages/deployer/src/components/DeployerWidget.svelte` — NEW component (handleDeploy logic extracted from App.svelte, ~380 lines)
- `packages/deployer/src/web-component/index.js` — `<nsite-deploy>` custom element definition

**Moved files (verbatim, no rewrite needed):**
- `apps/spa/src/lib/*.js` (all 8) → `packages/deployer/src/lib/`
- Deployer-specific Svelte components (DeployZone, FileTree, ProgressIndicator, SuccessPanel, ManageSite, LoginModal, AdvancedConfig, ActivityRings, LogoutConfirmModal, NIP46Dialog, OperationBanner) → `packages/deployer/src/components/`

**Modified files:**
- `apps/spa/src/App.svelte` — strip handleDeploy, strip lib imports, strip deployer components; replace with `<DeployerWidget signer={currentSigner} on:logout={...} />`. Retains Navbar, NIP5ABanner, ToolsResources, showLoginModal state, session store for Navbar.
- `apps/spa/package.json` — add `"@nsite/deployer": "*"` workspace dependency

**Unchanged:**
- `apps/spa/src/components/Navbar.svelte`
- `apps/spa/src/components/NIP5ABanner.svelte`
- `apps/spa/src/components/ToolsResources.svelte`
- `apps/spa/vite.config.js`
- All of apps/relay, apps/blossom, apps/gateway, packages/shared

### Build Order Dependency

```
packages/deployer (vite build — required for web component bundles only)
    ↓
apps/spa (vite build — can use deployer src directly in dev via workspace resolution)
```

During development, apps/spa imports from packages/deployer via workspace resolution and Vite processes the raw Svelte source directly. No pre-build step required for the SPA dev server. The IIFE/ESM web component bundle requires an explicit build in packages/deployer.

## Sources

- Codebase inspection: `apps/spa/src/App.svelte` lines 1-557 (handleDeploy, state, imports)
- Codebase inspection: `apps/spa/src/lib/` (nostr.js, upload.js, publish.js, crypto.js, files.js, store.js)
- Codebase inspection: `apps/spa/src/components/` (component inventory)
- Reference implementation: `~/Develop/nsite/stealthis/vite.config.ts` (formats: ['iife', 'es'] dual output)
- Reference implementation: `~/Develop/nsite/stealthis/src/widget.ts` (shadow DOM, state machine, style injection pattern)
- Reference implementation: `~/Develop/nsite/stealthis/package.json` (exports map structure)
- Vite library mode: https://vite.dev/guide/build#library-mode (HIGH confidence)
- Svelte `"svelte"` export condition: established convention in SvelteKit ecosystem (MEDIUM confidence)

---
*Architecture research for: nsite.run v1.5 Deployer Component extraction*
*Researched: 2026-03-25*
