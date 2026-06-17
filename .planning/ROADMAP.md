# Roadmap: nsite.run

## Milestones

- ✅ **v1.0 MVP** — Phases 1-6 (shipped 2026-03-20)
- ✅ **v1.1 Feature Gaps** — Phases 7-9 (shipped 2026-03-20)
- ✅ **v1.2 Named Sites** — Phases 10-11 (shipped 2026-03-21)
- ✅ **v1.3 Local Dev** — Phase 12 (shipped 2026-03-22)
- ✅ **v1.4 Deploy Safety** — Phases 13-16 (shipped 2026-03-25)
- 🚧 **v1.5 Deployer Component** — Phases 17-20 (in progress)

## Phases

<details>
<summary>✅ v1.0 MVP (Phases 1-6) — SHIPPED 2026-03-20</summary>

- [x] Phase 1: Monorepo and Build Infrastructure (3/3 plans) — completed 2026-03-13
- [x] Phase 2: Relay (2/2 plans) — completed 2026-03-13
- [x] Phase 3: Blossom (3/3 plans) — completed 2026-03-14
- [x] Phase 4: Gateway Routing Layer (1/1 plan) — completed 2026-03-14
- [x] Phase 5: nsite Resolver and Progressive Caching (4/4 plans) — completed 2026-03-14
- [x] Phase 6: SPA Deploy Interface (5/5 plans) — completed 2026-03-18

</details>

<details>
<summary>✅ v1.1 Feature Gaps (Phases 7-9) — SHIPPED 2026-03-20</summary>

- [x] Phase 7: Deploy UX Improvements (2/2 plans) — completed 2026-03-20
- [x] Phase 8: Anonymous Key Management (2/2 plans) — completed 2026-03-20
- [x] Phase 9: Site Management (2/2 plans) — completed 2026-03-20

</details>

<details>
<summary>✅ v1.2 Named Sites (Phases 10-11) — SHIPPED 2026-03-21</summary>

- [x] Phase 10: Gateway Named Site Encoding (2/2 plans) — completed 2026-03-21
- [x] Phase 11: SPA Named Site Support (2/2 plans) — completed 2026-03-21

</details>

<details>
<summary>✅ v1.3 Local Dev (Phase 12) — SHIPPED 2026-03-22</summary>

- [x] Phase 12: Local Development Harness (3/3 plans) — completed 2026-03-22

</details>

<details>
<summary>✅ v1.4 Deploy Safety (Phases 13-16) — SHIPPED 2026-03-25</summary>

- [x] Phase 13: Leave Confirmation (2/2 plans) — completed 2026-03-24
- [x] Phase 14: Delete Animation (2/2 plans) — completed 2026-03-25
- [x] Phase 15: Post-Action Navigation (2/2 plans) — completed 2026-03-25
- [x] Phase 16: Deploy Guard (1/1 plan) — completed 2026-03-25

</details>

### 🚧 v1.5 Deployer Component (In Progress)

**Milestone Goal:** Extract the complete deploy-and-manage flow into a standalone `packages/deployer` package — importable as a Svelte component and embeddable as a self-contained Web Component.

- [x] **Phase 17: Package Scaffolding and Build Infrastructure** — npm workspaces, deployer package.json with correct exports map, dual Vite configs, publint validation (completed 2026-03-25)
- [x] **Phase 18: Core Lib Extraction** — 8 lib files moved to packages/deployer, singleton stores fixed, SPA imports updated (completed 2026-03-25)
- [x] **Phase 19: Svelte Component** — DeployerWidget.svelte orchestrator with signer prop, typed events, CSS custom properties (completed 2026-03-25)
- [x] **Phase 20: Web Component and IIFE Bundle** — HTMLElement wrapper, button-to-modal UX, IIFE+ESM dist artifacts, shadow DOM event propagation (2 plans) (completed 2026-03-25)

## Phase Details

### Phase 17: Package Scaffolding and Build Infrastructure
**Goal**: A working packages/deployer scaffold with correct exports map and dual Vite build configs that produce real IIFE+ESM output files
**Depends on**: Phase 16 (v1.4 complete)
**Requirements**: INFRA-01, INFRA-02, INFRA-03, INFRA-04
**Success Criteria** (what must be TRUE):
  1. Running `npm install` from repo root installs all workspaces and creates the @nsite/deployer symlink in node_modules
  2. `npm run build:widget` (in packages/deployer) produces dist/deployer.js (IIFE) and dist/deployer.mjs (ESM) files
  3. `publint` reports zero errors on packages/deployer exports — the "svelte" condition resolves correctly
  4. apps/spa can resolve `import ... from '@nsite/deployer'` without error (even if the package has only placeholder exports)
**Plans**: 2 plans
Plans:
- [x] 17-01-PLAN.md — Scaffold workspace root and deployer package with exports map
- [x] 17-02-PLAN.md — Widget Vite build config, IIFE+ESM artifacts, publint validation
**UI hint**: yes

### Phase 18: Core Lib Extraction
**Goal**: All 8 framework-agnostic lib files live in packages/deployer/src/lib/ and the SPA continues to work by importing from @nsite/deployer
**Depends on**: Phase 17
**Requirements**: CORE-01, CORE-02, CORE-03
**Success Criteria** (what must be TRUE):
  1. packages/deployer/src/lib/ contains all 8 files (nostr, upload, publish, crypto, files, store, scanner, base36) and apps/spa/src/lib/ is deleted
  2. apps/spa imports resolve through @nsite/deployer — SPA builds without errors and all existing deploy/manage functionality works in the browser
  3. No module-level singleton stores remain — stores are initialized inside component script blocks or via Svelte context, so two deployer instances on the same page do not share state
**Plans**: TBD

### Phase 19: Svelte Component
**Goal**: DeployerWidget.svelte is a self-contained orchestrator that hosts the complete deploy+manage+update flow and can be imported into any Svelte project
**Depends on**: Phase 18
**Requirements**: COMP-01, COMP-02, COMP-03, COMP-04
**Success Criteria** (what must be TRUE):
  1. Importing `<DeployerWidget />` into apps/spa App.svelte replaces the inline deploy flow — the SPA becomes a thin shell (Navbar + NIP5ABanner + ToolsResources only) with no duplicate deploy logic
  2. Passing a NIP-07 or NIP-46 signer as the `signer` prop skips the auth modal and deploys directly with that signer
  3. Omitting the signer prop (null) causes DeployerWidget to render its built-in auth flow (NIP-07, NIP-46, anonymous)
  4. On successful deploy, DeployerWidget dispatches a `deploy-success` CustomEvent with a typed detail payload (pubkey, siteType, dTag)
  5. CSS custom properties (--deployer-accent, --deployer-bg, --deployer-text, --deployer-radius) on the host element visibly restyle the component
**Plans**: TBD
**UI hint**: yes

### Phase 20: Web Component and IIFE Bundle
**Goal**: A plain HTML page can embed `<nsite-deployer>` via a single script tag and get a working deploy button that opens a full modal
**Depends on**: Phase 19
**Requirements**: WIDGET-01, WIDGET-02, WIDGET-03, WIDGET-04, WIDGET-05, WIDGET-06
**Success Criteria** (what must be TRUE):
  1. A plain HTML file with `<script src="dist/deployer.js"></script>` and `<nsite-deployer>` renders a trigger button without requiring any npm install or bundler
  2. Clicking the trigger button opens the full deploy modal — the entire deploy+manage flow works end-to-end from the IIFE bundle
  3. The `trigger-label` attribute on `<nsite-deployer trigger-label="Publish site">` changes the button text
  4. `deploy-success` and `deploy-error` events fired by the custom element are observable with `addEventListener` outside the shadow root (composed: true propagation confirmed)
  5. Setting `extraRelays` and `extraBlossoms` properties programmatically on the element causes those servers to be used during upload without localStorage
**Plans**: 2 plans
Plans:
- [x] 20-01-PLAN.md — HTMLElement wrapper with shadow DOM, modal UX, and event bridge
- [x] 20-02-PLAN.md — Entry point, custom element registration, build, and test page
**UI hint**: yes

## Progress

| Phase | Milestone | Plans Complete | Status | Completed |
|-------|-----------|----------------|--------|-----------|
| 1. Monorepo and Build Infrastructure | v1.0 | 3/3 | Complete | 2026-03-13 |
| 2. Relay | v1.0 | 2/2 | Complete | 2026-03-13 |
| 3. Blossom | v1.0 | 3/3 | Complete | 2026-03-14 |
| 4. Gateway Routing Layer | v1.0 | 1/1 | Complete | 2026-03-14 |
| 5. nsite Resolver and Progressive Caching | v1.0 | 4/4 | Complete | 2026-03-14 |
| 6. SPA Deploy Interface | v1.0 | 5/5 | Complete | 2026-03-18 |
| 7. Deploy UX Improvements | v1.1 | 2/2 | Complete | 2026-03-20 |
| 8. Anonymous Key Management | v1.1 | 2/2 | Complete | 2026-03-20 |
| 9. Site Management | v1.1 | 2/2 | Complete | 2026-03-20 |
| 10. Gateway Named Site Encoding | v1.2 | 2/2 | Complete | 2026-03-21 |
| 11. SPA Named Site Support | v1.2 | 2/2 | Complete | 2026-03-21 |
| 12. Local Development Harness | v1.3 | 3/3 | Complete | 2026-03-22 |
| 13. Leave Confirmation | v1.4 | 2/2 | Complete | 2026-03-24 |
| 14. Delete Animation | v1.4 | 2/2 | Complete | 2026-03-25 |
| 15. Post-Action Navigation | v1.4 | 2/2 | Complete | 2026-03-25 |
| 16. Deploy Guard | v1.4 | 1/1 | Complete | 2026-03-25 |
| 17. Package Scaffolding and Build Infrastructure | v1.5 | 2/2 | Complete   | 2026-03-25 |
| 18. Core Lib Extraction | v1.5 | 2/2 | Complete   | 2026-03-25 |
| 19. Svelte Component | v1.5 | 3/3 | Complete    | 2026-03-25 |
| 20. Web Component and IIFE Bundle | v1.5 | 2/2 | Complete   | 2026-03-25 |
