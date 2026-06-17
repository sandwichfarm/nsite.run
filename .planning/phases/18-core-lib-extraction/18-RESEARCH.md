# Phase 18: Core Lib Extraction - Research

**Researched:** 2026-03-25
**Confidence:** HIGH

## What Needs to Happen

Move 8 lib files from `apps/spa/src/lib/` to `packages/deployer/src/lib/`, refactor singleton stores into a factory pattern, update all SPA imports to use `@nsite/deployer` sub-path exports, move tests alongside the code, and ensure the SPA continues to build and function.

## Current State Analysis

### Source Files (apps/spa/src/lib/)

| File | Lines | Dependencies | Singletons | Notes |
|------|-------|-------------|------------|-------|
| store.js | 110 | svelte/store | 3 (session, deployState, serverConfig) | Primary refactoring target |
| nostr.js | 465 | applesauce-signers, applesauce-relay, nostr-tools, ./store.js | 2 (_pool, _profileCache) | Imports ANON_KEY_STORAGE_KEY from store |
| upload.js | 427 | none (self-contained) | 0 | Pure functions, no imports from other lib files |
| publish.js | 238 | none (self-contained) | 0 | Pure functions, no imports from other lib files |
| crypto.js | 19 | none (WebCrypto only) | 0 | Pure function |
| files.js | 429 | fflate, nanotar | 0 | Pure functions |
| scanner.js | 247 | none (self-contained) | 0 | Pure functions |
| base36.js | 33 | none (self-contained) | 0 | Pure function |

### Inter-File Dependencies (lib-internal)

```
nostr.js → store.js (imports ANON_KEY_STORAGE_KEY)
```

All other files are independent. The dependency is on a constant, not on a store — so the move is safe.

### Import Consumers (13 import sites in 10 files)

| SPA File | Imports From |
|----------|-------------|
| App.svelte | store, nostr, crypto, upload, publish, base36 |
| DeployZone.svelte | files, scanner |
| SuccessPanel.svelte | nostr, base36 |
| AdvancedConfig.svelte | store, nostr |
| LoginModal.svelte | nostr, store |
| NIP46Dialog.svelte | nostr, store |
| Navbar.svelte | store, nostr |
| ManageSite.svelte | publish, upload, base36, nostr |
| LogoutConfirmModal.svelte | nostr |
| ToolsResources.svelte | tools-resources.yaml (STAYS — not a lib file) |

### Test Files (6 test files)

| Test File | Tests | Import Style |
|-----------|-------|-------------|
| files.test.js | files.js functions | `from '../files.js'` |
| publish.test.js | publish.js functions | `from '../publish.js'` |
| upload.test.js | upload.js functions | `from '../upload.js'` |
| scanner.test.js | scanner.js functions | `from '../scanner.js'` |
| setup.test.js | vitest basics | no lib imports |
| tools.test.js | tools-resources.yaml | `from '../tools-resources.yaml'` (STAYS) |

### Singleton Store Analysis

**Module-level singletons in store.js:**
1. `session` — writable store persisted to localStorage('nsite_session'), with sanitization wrapper
2. `deployState` — plain writable (not persisted), tracks deploy progress
3. `serverConfig` — persisted to localStorage('nsite_servers'), extra relays/blossoms

**Module-level singletons in nostr.js:**
1. `_pool` — lazy singleton RelayPool instance
2. `_profileCache` — in-memory Map for profile caching

**Required changes:**
- store.js: Replace 3 module-level exports with `createDeployerStores()` factory that returns fresh instances
- nostr.js: The `_pool` and `_profileCache` are acceptable module-level singletons for Phase 18 scope — they are caches, not user state. Multi-instance isolation of the RelayPool is a Phase 19 concern when DeployerWidget gets its own store context.

## Package.json Exports Map

Current `packages/deployer/package.json` exports:
```json
{
  ".": {
    "svelte": "./src/index.js",
    "import": "./dist/deployer.mjs",
    "default": "./dist/deployer.js"
  }
}
```

Needs to expand to:
```json
{
  ".": {
    "svelte": "./src/index.js",
    "import": "./dist/deployer.mjs",
    "default": "./dist/deployer.js"
  },
  "./store": { "svelte": "./src/lib/store.js", "default": "./src/lib/store.js" },
  "./nostr": { "svelte": "./src/lib/nostr.js", "default": "./src/lib/nostr.js" },
  "./upload": { "svelte": "./src/lib/upload.js", "default": "./src/lib/upload.js" },
  "./publish": { "svelte": "./src/lib/publish.js", "default": "./src/lib/publish.js" },
  "./crypto": { "svelte": "./src/lib/crypto.js", "default": "./src/lib/crypto.js" },
  "./files": { "svelte": "./src/lib/files.js", "default": "./src/lib/files.js" },
  "./scanner": { "svelte": "./src/lib/scanner.js", "default": "./src/lib/scanner.js" },
  "./base36": { "svelte": "./src/lib/base36.js", "default": "./src/lib/base36.js" }
}
```

## Store Factory Design

```js
// packages/deployer/src/lib/store.js
import { writable } from 'svelte/store';

export function persistedStore(key, defaultValue) { /* unchanged */ }

const DEFAULT_SESSION = { /* unchanged */ };
function sanitizeSession(s) { /* unchanged */ }

export function createDeployerStores(options = {}) {
  const prefix = options.storagePrefix ?? 'nsite';

  const _rawSession = persistedStore(`${prefix}_session`, DEFAULT_SESSION);
  const session = {
    subscribe: _rawSession.subscribe,
    set: (v) => _rawSession.set(sanitizeSession(v)),
    update: (fn) => _rawSession.update((s) => sanitizeSession(fn(s))),
  };

  // Clear corrupted session on creation
  try {
    const stored = localStorage.getItem(`${prefix}_session`);
    if (stored && stored.includes('nsec1')) {
      console.error('SECURITY: nsec found in stored session, clearing');
      localStorage.removeItem(`${prefix}_session`);
      _rawSession.set(DEFAULT_SESSION);
    }
  } catch { /* ignore */ }

  const deployState = writable({
    step: 'idle',
    files: [],
    warnings: [],
    progress: 0,
    result: null,
    error: null,
  });

  const serverConfig = persistedStore(`${prefix}_servers`, {
    extraRelays: [],
    extraBlossoms: ['https://nostr.download', 'https://blssm.us'],
  });

  return { session, deployState, serverConfig };
}

export const ANON_KEY_STORAGE_KEY = 'nsite_anon_key';
```

## Vitest Configuration

Current: `apps/spa/vitest.config.js` runs tests from `apps/spa/src/lib/__tests__/`.

After move: Tests for deployer lib files move to `packages/deployer/src/lib/__tests__/`. Need a new `packages/deployer/vitest.config.js` (or add test script to deployer package.json). The `tools.test.js` stays in apps/spa since it tests `tools-resources.yaml` which stays.

Deployer vitest config needs:
- `environment: 'node'` (same as SPA)
- No special plugins (no yaml needed — deployer has no yaml files)

## Order of Operations

### Wave 1: Move files + fix stores (can be one plan — foundational)
1. Create `packages/deployer/src/lib/` directory
2. Move all 8 lib files (git mv)
3. Refactor store.js: singleton → factory
4. Move `__tests__/` (excluding tools.test.js) to `packages/deployer/src/lib/__tests__/`
5. Update test import paths (from `../files.js` → `../files.js` — relative paths stay the same since tests move alongside)
6. Add vitest config and test script to deployer package
7. Update `packages/deployer/package.json` exports map with sub-path entries
8. Update `packages/deployer/src/index.js` barrel file with re-exports

### Wave 1 (parallel): Update SPA imports
1. Rewrite all 10 SPA files' imports from relative `./lib/X` or `../lib/X` to `@nsite/deployer/X`
2. Update SPA components that use `session`, `deployState`, `serverConfig` to call `createDeployerStores()`
3. Move `tools-resources.yaml` to `apps/spa/src/lib/` (stays, just needs `tools.test.js` to stay too)
4. Delete `apps/spa/src/lib/` after confirming all files moved (except tools-resources.yaml)
5. Verify SPA builds: `npm run build` in apps/spa

**Decision:** These two could be in the same wave since the SPA import updates depend on the files being moved. But the file moves and store refactoring are independent. Best approach: **single wave, two plans** — Plan 01 handles the move + store refactoring + deployer package updates, Plan 02 handles SPA import rewrites + cleanup + build verification.

## Risks

1. **nostr.js imports from store.js** — After move, the internal relative import `from './store.js'` still works since both files move to the same directory. No change needed.
2. **npm workspace resolution** — `@nsite/deployer` is already a workspace dependency of `@nsite/spa`. Sub-path exports require the "exports" map to be correct.
3. **Test discovery** — vitest needs to be configured at the deployer package level to find tests in `src/lib/__tests__/`.
4. **Transitive dependencies** — nostr.js uses applesauce-signers, applesauce-relay, nostr-tools. These are currently in apps/spa/package.json dependencies. After the move, packages/deployer will need these as dependencies (or peerDependencies). Since the SPA resolves them via workspace hoisting, this works for now, but for correctness the deployer package.json should declare them.

## RESEARCH COMPLETE

---
*Research for Phase 18: Core Lib Extraction*
*Researched: 2026-03-25*
