---
phase: 18-core-lib-extraction
plan: 02
subsystem: ui
tags: [svelte, imports, npm-workspaces, vite-build]

requires:
  - phase: 18-core-lib-extraction
    provides: 8 lib files in packages/deployer with sub-path exports
provides:
  - All SPA imports rewritten to @nsite/deployer sub-paths
  - Store factory wired in all components using stores
  - Transitive deps removed from SPA package.json
  - SPA builds and all tests pass
affects: [19-svelte-component]

tech-stack:
  added: []
  patterns: [per-component createDeployerStores() calls for store access]

key-files:
  created: []
  modified:
    - apps/spa/src/App.svelte
    - apps/spa/src/components/DeployZone.svelte
    - apps/spa/src/components/SuccessPanel.svelte
    - apps/spa/src/components/AdvancedConfig.svelte
    - apps/spa/src/components/LoginModal.svelte
    - apps/spa/src/components/NIP46Dialog.svelte
    - apps/spa/src/components/Navbar.svelte
    - apps/spa/src/components/ManageSite.svelte
    - apps/spa/src/components/LogoutConfirmModal.svelte
    - apps/spa/package.json

key-decisions:
  - "Per-component createDeployerStores() calls (not prop-passing) — simplest correct approach for single-instance usage; Phase 19 will introduce Svelte context for shared stores"
  - "Removed 6 transitive deps from SPA (applesauce-signers/relay/core, fflate, nanotar, @std/media-types) — kept nostr-tools (directly imported by SPA for npubEncode/hexToBytes)"

patterns-established:
  - "Import pattern: from '@nsite/deployer/{module}' for all deployer lib imports"
  - "Store access: const { session, deployState, serverConfig } = createDeployerStores()"

requirements-completed: [CORE-03]

duration: 5min
completed: 2026-03-25
---

# Phase 18 Plan 02: SPA Import Rewrite Summary

**Rewrote all SPA imports to @nsite/deployer sub-paths, wired store factory in 5 components, removed 6 transitive deps, SPA builds clean**

## Performance

- **Duration:** 5 min
- **Tasks:** 3
- **Files modified:** 11

## Accomplishments
- All 8 SPA components + App.svelte import from @nsite/deployer instead of relative ../lib/ paths
- 5 components (App, AdvancedConfig, LoginModal, NIP46Dialog, Navbar) wire createDeployerStores()
- 6 transitive dependencies removed from apps/spa/package.json
- SPA builds successfully (423KB JS bundle)
- All tests pass: 5 SPA tests + 112 deployer tests

## Task Commits

1. **Task 18.2.1: Rewrite App.svelte imports** - `0650205` (refactor)
2. **Task 18.2.2: Rewrite component imports** - `b7e36fa` (refactor)
3. **Task 18.2.3: Clean up deps, verify build** - `130ca8c` (refactor)

## Deviations from Plan
None - plan executed exactly as written.

## Issues Encountered
None

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- apps/spa/src/lib/ contains only tools-resources.yaml and __tests__/tools.test.js
- All deployer lib code lives in packages/deployer/src/lib/
- Phase 19 can proceed with Svelte component extraction

---
*Phase: 18-core-lib-extraction*
*Completed: 2026-03-25*
