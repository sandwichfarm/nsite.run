# Phase 18: Core Lib Extraction - Context

**Gathered:** 2026-03-25
**Status:** Ready for planning

<domain>
## Phase Boundary

Move all 8 framework-agnostic lib files from apps/spa/src/lib/ to packages/deployer/src/lib/, fix module-level singleton stores for multi-instance safety, update all SPA import paths to resolve through @nsite/deployer, and verify the SPA continues to build and function correctly. This phase moves code — it does not add new features.

</domain>

<decisions>
## Implementation Decisions

### Store scoping strategy
- **D-01:** Factory function pattern — `createDeployerStores()` returns fresh `{session, deployState, serverConfig}` instances. Consumers call the factory to get isolated store sets. No module-level singletons.
- **D-02:** `ANON_KEY_STORAGE_KEY` constant can remain module-level (it's a string constant, not state — no multi-instance concern)
- **D-03:** `persistedStore()` utility function remains a plain export (it's a factory already, no singleton issue)

### What moves vs stays
- **D-04:** All 8 lib files move: nostr.js, upload.js, publish.js, crypto.js, files.js, store.js, scanner.js, base36.js
- **D-05:** `__tests__/` directory moves with the lib files to packages/deployer (tests follow the code they test)
- **D-06:** `tools-resources.yaml` stays in apps/spa/src/lib/ (SPA-only educational content, not deployer logic)
- **D-07:** After move, apps/spa/src/lib/ contains only tools-resources.yaml

### Export organization
- **D-08:** Both barrel export AND sub-path exports — barrel `import { X } from '@nsite/deployer'` for convenience, sub-paths `import { X } from '@nsite/deployer/store'` for granularity and tree-shaking
- **D-09:** package.json exports map needs entries for ".", "./store", "./nostr", "./upload", "./publish", "./crypto", "./files", "./scanner", "./base36" — each with "svelte", "import", "default" conditions

### Claude's Discretion
- Exact import rewriting strategy across 13+ import sites (mechanical, Claude handles)
- Whether to update SPA imports to use barrel or sub-path style (sub-path likely cleaner for specificity)
- Test runner configuration adjustments (vitest config may need workspaces awareness)
- Order of operations for the move (move files first, then update imports, then fix stores — or interleave)

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Source files to move
- `apps/spa/src/lib/store.js` — 3 singleton stores + persistedStore utility + ANON_KEY_STORAGE_KEY constant. Primary refactoring target for store scoping.
- `apps/spa/src/lib/nostr.js` — Signer creation, relay/blossom list fetching, profile fetching, manifest fetching, constants (NSITE_RELAY, NSITE_BLOSSOM, etc.)
- `apps/spa/src/lib/upload.js` — Blob checking, uploading, deletion with BUD-02 auth
- `apps/spa/src/lib/publish.js` — Manifest building (kind 15128/35128), relay publishing, deletion events
- `apps/spa/src/lib/crypto.js` — SHA-256 hashing via WebCrypto
- `apps/spa/src/lib/files.js` — File extraction (zip/tar.gz), tree building, VCS filtering, MIME inference
- `apps/spa/src/lib/scanner.js` — Secret scanning patterns
- `apps/spa/src/lib/base36.js` — Base36 encoding for named site subdomains

### Destination package
- `packages/deployer/package.json` — Current exports map (needs updating for sub-path exports)
- `packages/deployer/src/index.js` — Current placeholder (needs barrel re-exports)

### Import consumers (SPA files that need updating)
- `apps/spa/src/App.svelte` — imports store, crypto, upload, publish, base36
- `apps/spa/src/components/DeployZone.svelte` — imports files, scanner
- `apps/spa/src/components/SuccessPanel.svelte` — imports nostr, base36
- `apps/spa/src/components/AdvancedConfig.svelte` — imports store, nostr
- `apps/spa/src/components/LoginModal.svelte` — imports nostr, store
- `apps/spa/src/components/NIP46Dialog.svelte` — imports nostr, store
- `apps/spa/src/components/Navbar.svelte` — imports store, nostr
- `apps/spa/src/components/ManageSite.svelte` — imports publish, upload, base36, nostr
- `apps/spa/src/components/LogoutConfirmModal.svelte` — imports nostr
- `apps/spa/src/components/ToolsResources.svelte` — imports tools-resources.yaml (stays local)

### Research
- `.planning/research/PITFALLS.md` — Pitfall 20 (singleton store bleed), Pitfall 24 (Vite externalization)
- `.planning/research/ARCHITECTURE.md` — Package boundary, store isolation, data flow

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `persistedStore()` in store.js: Already a factory function — can be moved as-is
- All 8 lib files are plain JS (no Svelte imports except store.js which imports `svelte/store`)

### Established Patterns
- SPA imports use relative paths (`./lib/X` or `../lib/X`) — all need rewriting to `@nsite/deployer/X`
- store.js `session` wraps a persistedStore with sanitization — this pattern must be preserved in factory
- `deployState` is a plain `writable({...})` — non-persisted, resets on reload

### Integration Points
- packages/deployer/package.json exports map must be extended with sub-path entries
- packages/deployer/src/index.js becomes barrel re-exporting all lib modules
- vitest config may need updating for workspace-aware test discovery

</code_context>

<specifics>
## Specific Ideas

- Factory function signature: `createDeployerStores()` returns `{ session, deployState, serverConfig, ANON_KEY_STORAGE_KEY }`
- The `session` store wrapper (sanitization on set/update) must be preserved in the factory
- Sub-path exports should follow the exact file names: `@nsite/deployer/store`, `@nsite/deployer/nostr`, etc.

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 18-core-lib-extraction*
*Context gathered: 2026-03-25*
