# Phase 19: Svelte Component — Research

**Researched:** 2026-03-25
**Confidence:** HIGH (source code directly inspected; existing patterns verified)

## Objective

Determine how to extract the 1,177-line `App.svelte` orchestration into `DeployerWidget.svelte` — a self-contained component that handles the full deploy+manage+update flow with optional signer injection, typed events, and CSS custom property theming.

---

## Current State Analysis

### App.svelte Anatomy (1,177 lines)

The file breaks into these logical sections:

| Section | Lines | What it does | Goes into DeployerWidget? |
|---------|-------|-------------|--------------------------|
| Imports (lib) | 1-28 | store, nostr, crypto, upload, publish, base36 | YES |
| Imports (components) | 30-40 | All 11 sub-components | YES (except Navbar, NIP5ABanner, ToolsResources) |
| State declarations | 42-125 | ~30 reactive variables for deploy/manage flow | YES |
| fetchUserServers() | 130-143 | Background NIP-65/10063 relay+blossom fetch | YES |
| onMount hydration | 149-188 | Restore anonymous signer, fetch profile, restore extension | YES (auth when no signer prop) |
| Derived values | 190-256 | step, isDangerousStep, beforeunload, dTag validation, etc. | YES |
| Event handlers | 258-374 | handleFilesSelected, toggleExclude, resetDeploy, fetchSiteInfo | YES |
| handleDeploy() | 380-557 | The main deploy orchestrator (hash→check→upload→publish) | YES |
| Template: LoginModal | 560-577 | Auth modal binding | YES (built-in auth) |
| Template: App shell | 579-1177 | Navbar, tabs, DeployZone, FileTree, options, progress, success, error | SPLIT — hero/frame stays in App, inner content goes to DeployerWidget |

### What Stays in App.svelte (Thin Shell)

After extraction, App.svelte retains:
- `<NIP5ABanner />` — SPA-specific celebration
- `<Navbar />` — SPA-specific navigation bar (needs session for avatar display)
- `<ToolsResources />` — SPA educational content
- `<DeployerWidget signer={...} on:deploy-success={...} on:auth-change={...} />`
- Session state for Navbar display (pubkey, displayName, avatar)
- showLoginModal binding (Navbar's login button triggers it)

### What Moves to DeployerWidget

The DeployerWidget encompasses:
- All deploy state (selectedFiles, fileTree, deployState, etc.)
- All deploy handlers (handleDeploy, handleFilesSelected, resetDeploy, etc.)
- Tab switching (deploy/manage)
- OperationBanner
- beforeunload guard
- Built-in auth flow (LoginModal, NIP46Dialog, LogoutConfirmModal)
- All deploy-related sub-components (DeployZone, FileTree, ProgressIndicator, SuccessPanel, ManageSite, AdvancedConfig, ActivityRings)

---

## Key Technical Findings

### 1. Store Scoping (createDeployerStores)

`packages/deployer/src/lib/store.js` already has the `createDeployerStores()` factory. DeployerWidget should call this in its `<script>` block and use `setContext` to make stores available to child components. Child components (LoginModal, NIP46Dialog, AdvancedConfig) currently import `session` and `serverConfig` directly from store.js — they need refactoring to use `getContext` instead.

**Pattern:**
```svelte
<!-- DeployerWidget.svelte -->
<script>
  import { setContext } from 'svelte';
  import { createDeployerStores } from '../lib/store.js';

  const stores = createDeployerStores();
  setContext('deployer-stores', stores);
  const { session, deployState, serverConfig } = stores;
</script>
```

Child components:
```svelte
<script>
  import { getContext } from 'svelte';
  const { session, serverConfig } = getContext('deployer-stores');
</script>
```

### 2. Signer Prop Interface

The signer prop should accept any object with `getPublicKey()` and `signEvent()` — the duck-type interface already used by the codebase (applesauce-signers compatible).

When `signer` prop is provided (non-null):
- Skip LoginModal rendering
- Use the provided signer directly for deploy/delete operations
- Still need session info (pubkey, displayName) — derive from signer's `getPublicKey()`

When `signer` prop is null/omitted:
- Render built-in auth UI (LoginModal, NIP46Dialog)
- Create anonymous signer on deploy if no auth chosen
- Own the complete auth lifecycle

### 3. Event Contract

DeployerWidget emits events via `createEventDispatcher()` (Svelte 4 pattern):

| Event | Detail | When |
|-------|--------|------|
| `deploy-success` | `{ pubkey, siteType, dTag, url, event, uploadResult, publishResult }` | After successful manifest publish |
| `deploy-error` | `{ error, step }` | On deploy failure |
| `auth-change` | `{ pubkey, signerType, authenticated }` | Login/logout/signer change |
| `operation-start` | `{ type: 'deploy'\|'delete', siteId }` | Deploy or delete begins |
| `operation-end` | `{ type, siteId, success }` | Deploy or delete completes |
| `site-deleted` | `{ siteId }` | After successful site deletion |

### 4. CSS Custom Properties

Four tokens on the component's root div:

```css
.deployer-widget {
  --deployer-accent: var(--deployer-accent, #a78bfa);  /* purple-400 default */
  --deployer-bg: var(--deployer-bg, #0f172a);          /* slate-900 default */
  --deployer-text: var(--deployer-text, #f1f5f9);      /* slate-100 default */
  --deployer-radius: var(--deployer-radius, 0.5rem);   /* rounded-lg default */
}
```

These CSS custom properties are applied to the root wrapper element. Internal Tailwind classes remain as-is for Svelte component consumers (Tailwind is present in the SPA's build pipeline). For the Web Component (Phase 20), CSS strategy will be different.

### 5. Template Structure Inside DeployerWidget

The DeployerWidget replaces the `<main>` section of App.svelte. It contains:

1. **OperationBanner** (fixed banner for background operations)
2. **Tab bar** (deploy/manage) — conditional on having existing sites
3. **Deploy tab content:**
   - Idle: DeployZone (drop zone)
   - Reviewing: FileTree + options (site type, dTag, title, SPA fallback, AdvancedConfig, Deploy button)
   - Progress: ProgressIndicator
   - Success: SuccessPanel
   - Error: Error panel with retry
4. **Manage tab content:** ManageSite component

### 6. Component File Organization

All deployer sub-components move to `packages/deployer/src/components/`:

```
packages/deployer/src/components/
├── DeployerWidget.svelte          ← NEW (orchestrator)
├── DeployZone.svelte              ← moved from apps/spa
├── FileTree.svelte                ← moved from apps/spa
├── ProgressIndicator.svelte       ← moved from apps/spa
├── SuccessPanel.svelte            ← moved from apps/spa
├── ManageSite.svelte              ← moved from apps/spa
├── LoginModal.svelte              ← moved from apps/spa
├── NIP46Dialog.svelte             ← moved from apps/spa
├── LogoutConfirmModal.svelte      ← moved from apps/spa
├── AdvancedConfig.svelte          ← moved from apps/spa
├── ActivityRings.svelte           ← moved from apps/spa
└── OperationBanner.svelte         ← moved from apps/spa
```

### 7. Import Path Updates

After components move, internal imports change from relative `../lib/X` to `../lib/X` (same relative distance within packages/deployer). External store imports (`import { session } from '../lib/store.js'`) must change to context-based access.

Components that directly import stores (need context refactoring):
- `LoginModal.svelte` — imports `session` from store.js
- `NIP46Dialog.svelte` — imports `session` from store.js
- `AdvancedConfig.svelte` — imports `session`, `serverConfig` from store.js
- `Navbar.svelte` — imports `session` (stays in SPA, continues using SPA's own session)

### 8. SPA Auth Boundary

The SPA has a dual-auth pattern:
- **Navbar** shows login button + user display (needs session)
- **DeployerWidget** handles deploy auth

When `signer` prop is provided by App.svelte:
- App.svelte manages its own session store for Navbar display
- DeployerWidget uses the provided signer directly
- On `auth-change` event, App.svelte updates its session for Navbar

When no signer prop:
- DeployerWidget manages its own session internally
- Login/logout happen within DeployerWidget
- App.svelte's Navbar shows unauthenticated state

### 9. Hero Section & Educational Content

The hero section (h1 "Deploy to the decentralized web", educational content below) is SPA-specific branding. Two approaches:

**Option A:** Keep hero in App.svelte, render DeployerWidget inside it
**Option B:** Move hero into DeployerWidget with a slot/mode prop

Decision: **Option A** — the hero is SPA branding that doesn't belong in a reusable component. DeployerWidget starts directly with the operation banner + tab bar + deploy/manage content.

### 10. `beforeunload` Guard Scoping

The current reactive `beforeunload` guard in App.svelte watches `isDangerousStep`. In DeployerWidget, this guard is internal — the component attaches/detaches the listener based on its own deploy state. This is correct because only the deployer knows whether a dangerous step is in progress.

---

## Risks and Mitigations

| Risk | Impact | Mitigation |
|------|--------|------------|
| Store context not propagating to deeply nested components | Child components silently use undefined stores | Test by rendering DeployerWidget in a minimal harness and verifying LoginModal can read session |
| Signer prop reactivity edge cases | Changing signer mid-deploy could cause inconsistencies | Ignore signer prop changes while a deploy is in progress (isDangerousStep) |
| Event naming collisions | Consumer already uses event names like `deploy-success` | Use namespaced events or document clearly |
| CSS custom properties not cascading to Tailwind utilities | Tailwind classes use hardcoded colors, not custom properties | Apply CSS custom properties to the wrapper only; internal components continue using Tailwind classes. Full CSS property mapping deferred to Phase 20/future |
| LoginModal/NIP46Dialog store dependency refactoring breaks existing behavior | Auth flow stops working | Move one component at a time, test each |

---

## Execution Strategy

The safest extraction order:

1. **Move sub-components** from `apps/spa/src/components/` to `packages/deployer/src/components/` (11 files). Update internal imports. Fix store imports to use `getContext`.

2. **Create DeployerWidget.svelte** — extract orchestration logic from App.svelte (state, handlers, handleDeploy, template). Wire up store context, signer prop, event dispatch.

3. **Refactor App.svelte** — replace inline deploy flow with `<DeployerWidget>` import. Keep only Navbar, NIP5ABanner, ToolsResources, hero section.

4. **Update exports** — add DeployerWidget to `packages/deployer/src/index.js` barrel export.

5. **Add CSS custom properties** — wrapper div with fallback values.

6. **Verify** — SPA builds and runs, deploy flow works end-to-end.

---

## Sources

- `apps/spa/src/App.svelte` (1,177 lines) — directly inspected
- `packages/deployer/src/lib/store.js` — createDeployerStores factory verified
- `packages/deployer/src/index.js` — current placeholder
- `packages/deployer/package.json` — current exports map
- All 14 SPA components inspected for import dependencies
- `.planning/research/ARCHITECTURE.md` — package boundary decisions
- `.planning/research/FEATURES.md` — API surface, event contracts
- `.planning/research/PITFALLS.md` — Pitfall 20 (singleton stores), 21 (event propagation), 22 (shadow DOM CSS)

---

## RESEARCH COMPLETE

*Phase 19 research for: nsite.run DeployerWidget Svelte component extraction*
*Researched: 2026-03-25*
