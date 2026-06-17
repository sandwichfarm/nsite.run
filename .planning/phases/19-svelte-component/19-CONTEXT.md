# Phase 19: Svelte Component - Context

**Gathered:** 2026-03-25
**Status:** Ready for planning

<domain>
## Phase Boundary

Create DeployerWidget.svelte — a self-contained Svelte component that orchestrates the complete deploy+manage+update flow. It accepts an optional signer prop, has its own auth flow when signer is null, emits typed events, and supports CSS custom property theming. The SPA's App.svelte becomes a thin shell: Navbar + NIP5ABanner + ToolsResources only.

</domain>

<decisions>
## Implementation Decisions

### Component boundary
- **D-01:** DeployerWidget.svelte contains the ENTIRE deploy experience: deploy flow, manage flow, tab switching, file state, OperationBanner, beforeunload guard, deploy guards
- **D-02:** App.svelte becomes a thin shell with only: Navbar, NIP5ABanner, ToolsResources, and a `<DeployerWidget>` import
- **D-03:** OperationBanner lives INSIDE DeployerWidget — SPA doesn't need to know about operations
- **D-04:** beforeunload guard lives INSIDE DeployerWidget — it knows about dangerous steps
- **D-05:** All deploy-related sub-components move to packages/deployer: DeployZone, FileTree, ProgressIndicator, SuccessPanel, ManageSite, LoginModal, NIP46Dialog, LogoutConfirmModal, AdvancedConfig, ActivityRings

### Auth + signer prop
- **D-06:** Auth flow (LoginModal, NIP46Dialog) lives INSIDE DeployerWidget — fully self-contained
- **D-07:** When signer prop is null/omitted: widget shows its own login UI (NIP-07, NIP-46, anonymous)
- **D-08:** When signer prop is provided: widget skips auth entirely, uses the given signer directly
- **D-09:** Widget should expose a way to trigger auth programmatically and accept a standard signer interface (e.g. applesauce-signers compatible)
- **D-10:** `auth-change` event emitted when signer changes (login/logout) — consumer can react

### Event contract
- **D-11:** Core events: `deploy-success` (detail: {pubkey, siteType, dTag, url}), `deploy-error` (detail: {error, step})
- **D-12:** Operation events: `operation-start` (detail: {type: 'deploy'|'delete', siteId}), `operation-end` (detail: {type, siteId, success}), `site-deleted` (detail: {siteId})
- **D-13:** Auth event: `auth-change` (detail: {pubkey, signerType, authenticated: boolean})
- **D-14:** All events use Svelte's `createEventDispatcher` for Svelte consumers. For Web Component (Phase 20), these become `composed: true` CustomEvents.

### CSS custom properties
- **D-15:** 4 basic tokens: `--deployer-accent`, `--deployer-bg`, `--deployer-text`, `--deployer-radius`
- **D-16:** These override Tailwind defaults where applicable. Minimal set per requirements — expand later if needed.

### Claude's Discretion
- How to structure the 1,177-line App.svelte extraction (incremental vs big-bang)
- Internal state management within DeployerWidget (which vars become component state vs stay in stores)
- How tab switching and step state machine work inside DeployerWidget
- Whether to keep existing Svelte component event dispatch patterns or switch to callback props

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Source components (SPA — to be extracted)
- `apps/spa/src/App.svelte` — 1,177 lines, master orchestrator with handleDeploy, step state machine, tab switching, all wiring
- `apps/spa/src/components/DeployZone.svelte` — File input/drop zone (254L)
- `apps/spa/src/components/FileTree.svelte` — File review tree with excludes (278L)
- `apps/spa/src/components/ProgressIndicator.svelte` — Server-by-server deploy progress (275L)
- `apps/spa/src/components/SuccessPanel.svelte` — Deploy result display (234L)
- `apps/spa/src/components/ManageSite.svelte` — Site list, delete, update (504L)
- `apps/spa/src/components/LoginModal.svelte` — NIP-07/anonymous auth (188L)
- `apps/spa/src/components/NIP46Dialog.svelte` — Nostr Connect auth (259L)
- `apps/spa/src/components/LogoutConfirmModal.svelte` — Anonymous key backup warning (139L)
- `apps/spa/src/components/AdvancedConfig.svelte` — Extra relay/blossom config (135L)
- `apps/spa/src/components/ActivityRings.svelte` — Deploy activity visualization (126L)
- `apps/spa/src/components/OperationBanner.svelte` — Background operation status (77L)

### SPA-only components (stay in apps/spa)
- `apps/spa/src/components/Navbar.svelte` — Header, login button, session display (97L)
- `apps/spa/src/components/NIP5ABanner.svelte` — Celebration banner (37L)
- `apps/spa/src/components/ToolsResources.svelte` — Educational content (104L)

### Prior phase decisions
- `.planning/phases/17-package-scaffolding-and-build-infrastructure/17-CONTEXT.md` — Package identity, build infrastructure
- `.planning/phases/18-core-lib-extraction/18-CONTEXT.md` — Store factory pattern, export organization

### Research
- `.planning/research/ARCHITECTURE.md` — DeployerWidget component boundary, signer prop interface
- `.planning/research/FEATURES.md` — Component API surface, event contracts, CSS theming
- `.planning/research/PITFALLS.md` — Pitfall 20 (singleton stores), Pitfall 22 (shadow DOM CSS)

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- All 12 sub-components can be moved to packages/deployer/src/components/ with minimal changes
- Lib layer already extracted in Phase 18 — imports from @nsite/deployer/store etc.
- createDeployerStores() factory (from Phase 18) provides multi-instance safe stores

### Established Patterns
- App.svelte uses Svelte event dispatch (`on:files-selected`, `on:deploy`, etc.) between components
- Step state machine: `idle → hashing → checking → uploading → publishing → success/error`
- Tab state: `currentPage` ('deploy' | 'manage') with isDangerousStep gating
- beforeunload: reactive `$: if (isDangerousStep)` attachment

### Integration Points
- packages/deployer/src/index.js barrel export adds DeployerWidget
- packages/deployer/package.json "svelte" condition must include component path
- apps/spa/src/App.svelte imports `<DeployerWidget>` from @nsite/deployer

</code_context>

<specifics>
## Specific Ideas

- The signer interface should be compatible with applesauce-signers (which the project already uses)
- Auth can be triggered programmatically — useful for consumers that want to control when login appears
- Event payloads should include enough data for consumers to build their own success/manage views if desired
- The 4 CSS custom properties map to accent color (buttons/highlights), background, text color, and border-radius

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 19-svelte-component*
*Context gathered: 2026-03-25*
