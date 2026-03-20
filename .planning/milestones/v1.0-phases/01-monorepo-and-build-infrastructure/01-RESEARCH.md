# Phase 1: Monorepo and Build Infrastructure - Research

**Researched:** 2026-03-13
**Domain:** Deno workspaces, esbuild bundling for Bunny Edge Scripts, GitHub Actions CI/CD
**Confidence:** HIGH (all key claims verified against official docs or primary source code)

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

**Runtime and toolchain**
- Deno as the development runtime and toolchain
- deno.json workspaces for monorepo management
- Built-in deno test, deno fmt, deno lint — no extra dev dependencies for these
- esbuild for final bundling to Bunny Edge Script format

**Workspace layout**
- Apps/packages split: `apps/` for deployable edge scripts, `packages/` for shared libraries
- Three app packages: `apps/relay`, `apps/blossom`, `apps/gateway`
- One shared package: `packages/shared`
- Each workspace member has its own `deno.json`

**Package naming and imports**
- Scoped package names: `@nsite/relay`, `@nsite/blossom`, `@nsite/gateway`, `@nsite/shared`
- Shared package imported as `@nsite/shared` via Deno workspace import map

**Shared package scope**
- Types AND runtime utilities (not types-only)
- Includes: nostr event types/interfaces, event validation, SHA-256 helpers, shared constants
- Anything multiple edge scripts need lives here

**Test framework**
- Set up in Phase 1 using deno test (not deferred to Phase 2)
- Test infrastructure ready before feature code arrives

**CI platform**
- GitHub Actions
- Runs on both push (any branch) and pull requests

**CI pipeline steps**
- Full validation: deno fmt --check, deno lint, deno check (type check), deno test, build, bundle size check
- All checks must pass before merge

**Bundle size enforcement**
- Hard fail at 1MB per edge script bundle
- Warning at 750KB
- PR comment bot showing absolute sizes AND delta from base branch
- Requires building both PR branch and base branch for delta comparison

**Deployment**
- CI deploys all three edge scripts to Bunny on merge to main
- All scripts deploy together (not selectively by what changed)
- Bunny API key stored in GitHub Secrets

### Claude's Discretion

- esbuild configuration details (output format, target, etc.)
- deno.json workspace configuration specifics
- GitHub Actions workflow structure (single vs multi-job)
- Bundle size check script implementation
- PR comment formatting

### Deferred Ideas (OUT OF SCOPE)

None — discussion stayed within phase scope
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| INFRA-01 | Monorepo build system produces separate bundles for relay, blossom, and gateway Edge Scripts | Deno workspace config + per-app esbuild script producing individual outfiles |
| INFRA-02 | Each Edge Script bundle stays under 1MB with CI enforcement (750KB soft warn) | Custom bundle size check script in CI; Bunny confirmed hard limit is 1MB |
| INFRA-03 | Shared types package provides common nostr/blossom types across all packages | Deno workspace member `@nsite/shared` with `exports` field, imported as bare specifier |
</phase_requirements>

---

## Summary

This phase builds a Deno monorepo with three deployable Bunny Edge Script bundles and a shared library package. Deno's native workspace support (shipped in v1.45, stable in v2.x) handles multi-package resolution with zero extra tooling — no Turborepo, Nx, or pnpm required. esbuild handles final bundling, configured with the `jsr:@luca/esbuild-deno-loader` plugin to resolve Deno-style imports including `jsr:`, `npm:`, and workspace bare specifiers.

The Bunny deploy workflow requires: (1) a pre-built ESM bundle under 1MB, (2) POST to `https://api.bunny.net/compute/script/{scriptId}/code` with the bundle as JSON `{Code: "..."}`, (3) POST to `https://api.bunny.net/compute/script/{scriptId}/publish` to activate. The official `BunnyWay/actions/deploy-script@main` GitHub Action does exactly this — it reads a file and calls those two endpoints. Three separate invocations (one per script ID) handle the three edge scripts.

Bundle size CI is best implemented as a custom Deno script: build, measure file sizes with `Deno.stat()`, fail if over 1MB, warn if over 750KB. For PR delta comments, build the base branch in a separate job, store sizes as a GitHub Actions artifact, then compare and post via `github-script` or the GitHub API.

**Primary recommendation:** Use `jsr:@luca/esbuild-deno-loader@^0.11.1` with a `build.ts` script per app package. Each app's `deno.json` defines a `build` task. The root `deno.json` runs `deno task --recursive build` to produce all three bundles.

---

## Standard Stack

### Core

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| Deno | v2.x | Runtime, type checking, test, fmt, lint | Project decision; has native workspace support |
| esbuild | npm:esbuild@^0.27.3 | Final bundling to single ESM file | Fastest bundler; official recommendation after `deno bundle` removed in Deno 2 |
| jsr:@luca/esbuild-deno-loader | ^0.11.1 | Resolves Deno specifiers (jsr:, npm:, file:, workspace) for esbuild | Most widely used Deno esbuild plugin; maintained by Deno core team member |

### Supporting

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| jsr:@std/assert | latest | Test assertions (`assertEquals`, etc.) | All test files in Phase 1 |
| denoland/setup-deno@v2 | v2 | GitHub Actions setup for Deno | CI workflow |
| BunnyWay/actions/deploy-script@main | main | Deploy bundle to Bunny Edge Scripting | Merge-to-main deploy job |
| actions/checkout@v4 | v4 | Checkout code in CI | All CI jobs |
| actions/upload-artifact@v4 | v4 | Store bundle size data between jobs | PR bundle size delta comparison |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| jsr:@luca/esbuild-deno-loader | jsr:@twosaturdayscode/esbuild-deno-plugin | The fork has better workspace support claims but is early-stage (v0.0.x); luca's loader is stable at 0.11.1 and officially recommended |
| Custom bundle size script | bundlemon, bundle-size-diff Action | These are JS/Node-centric; a simple Deno script gives full control and stays on-stack |
| BunnyWay/actions/deploy-script | Direct API curl in workflow step | The action is thin wrapper around the same API; either works, action is cleaner |

**Installation (in build scripts, not deno.json deps):**
```bash
# In build.ts scripts, import directly:
import * as esbuild from "npm:esbuild@^0.27.3";
import { denoPlugins } from "jsr:@luca/esbuild-deno-loader@^0.11.1";
```

---

## Architecture Patterns

### Recommended Project Structure

```
nsite.run/
├── deno.json                    # Workspace root: members, shared tasks, shared imports
├── deno.lock                    # Lockfile (workspace-wide)
├── .github/
│   └── workflows/
│       ├── ci.yml               # fmt, lint, check, test, build, bundle size
│       └── deploy.yml           # Deploy to Bunny on merge to main
├── apps/
│   ├── relay/
│   │   ├── deno.json            # name: "@nsite/relay", tasks: {build}
│   │   ├── src/
│   │   │   └── main.ts          # Entry point: BunnySDK.net.http.serve(...)
│   │   ├── build.ts             # esbuild script
│   │   └── dist/
│   │       └── relay.bundle.js  # Output bundle (gitignored)
│   ├── blossom/
│   │   ├── deno.json
│   │   ├── src/main.ts
│   │   ├── build.ts
│   │   └── dist/blossom.bundle.js
│   └── gateway/
│       ├── deno.json
│       ├── src/main.ts
│       ├── build.ts
│       └── dist/gateway.bundle.js
├── packages/
│   └── shared/
│       ├── deno.json            # name: "@nsite/shared", exports: {"./types": ..., ...}
│       └── src/
│           ├── mod.ts           # Main export
│           ├── types.ts         # Nostr/blossom types
│           ├── validation.ts    # Event validation
│           ├── sha256.ts        # SHA-256 helpers
│           └── constants.ts     # Shared constants
└── scripts/
    └── check-bundle-sizes.ts    # CI bundle size enforcement script
```

### Pattern 1: Deno Workspace Root Configuration

**What:** Root `deno.json` defines workspace members and shared configuration.
**When to use:** Always — this is the entry point for all Deno workspace commands.

```jsonc
// deno.json (workspace root)
{
  "workspace": [
    "./apps/relay",
    "./apps/blossom",
    "./apps/gateway",
    "./packages/shared"
  ],
  "tasks": {
    "build": "deno task --recursive build",
    "test": "deno test --recursive",
    "check": "deno check apps/relay/src/main.ts apps/blossom/src/main.ts apps/gateway/src/main.ts packages/shared/src/mod.ts"
  },
  "fmt": {
    "lineWidth": 100,
    "singleQuote": false
  },
  "lint": {
    "rules": {
      "tags": ["recommended"]
    }
  }
}
```

Source: https://docs.deno.com/runtime/fundamentals/workspaces/

### Pattern 2: Workspace Member deno.json

**What:** Each member declares its name (used as bare specifier) and exports.
**When to use:** Every workspace package — required for cross-member imports to work.

```jsonc
// packages/shared/deno.json
{
  "name": "@nsite/shared",
  "version": "0.1.0",
  "exports": {
    ".": "./src/mod.ts",
    "./types": "./src/types.ts",
    "./sha256": "./src/sha256.ts"
  }
}
```

```jsonc
// apps/relay/deno.json
{
  "name": "@nsite/relay",
  "version": "0.1.0",
  "exports": "./src/main.ts",
  "tasks": {
    "build": "deno run --allow-read --allow-write --allow-net --allow-run build.ts"
  }
}
```

Cross-member import (in relay code):
```typescript
import { NostrEvent } from "@nsite/shared/types";
import { validateEvent } from "@nsite/shared";
```

Source: https://docs.deno.com/runtime/fundamentals/workspaces/

### Pattern 3: esbuild Build Script for Bunny Edge Scripts

**What:** A `build.ts` per app that produces a single minified ESM bundle.
**When to use:** Each deployable app package.

```typescript
// apps/relay/build.ts
// Source: bunny-launcher.net/edge-scripting/bundling/ + jsr:@luca/esbuild-deno-loader docs
import * as esbuild from "npm:esbuild@^0.27.3";
import { denoPlugins } from "jsr:@luca/esbuild-deno-loader@^0.11.1";
import { builtinModules } from "node:module";

const allBuiltins = [
  ...builtinModules,
  ...builtinModules.map((m) => `node:${m}`),
];

const result = await esbuild.build({
  plugins: [...denoPlugins({ configPath: new URL("./deno.json", import.meta.url).pathname })],
  entryPoints: ["./src/main.ts"],
  outfile: "./dist/relay.bundle.js",
  bundle: true,
  format: "esm",
  minify: true,
  external: allBuiltins,
  define: { "process.env.NODE_ENV": '"production"' },
  banner: {
    js: 'import * as process from "node:process";import { Buffer } from "node:buffer";globalThis.process ??= process;globalThis.Buffer ??= Buffer;globalThis.global ??= globalThis;',
  },
});

await esbuild.stop();
console.log("Build complete:", result);
```

**Critical:** `configPath` must be absolute. Use `new URL("./deno.json", import.meta.url).pathname` to resolve relative to the script's location. The `denoPlugins()` call needs this to find the workspace's import maps and resolve `@nsite/shared`.

### Pattern 4: Bundle Size Enforcement Script

**What:** A Deno script that measures bundle sizes, fails hard at 1MB, warns at 750KB.
**When to use:** Run in CI after build step.

```typescript
// scripts/check-bundle-sizes.ts
const HARD_LIMIT = 1_000_000; // 1MB
const SOFT_WARN = 750_000;    // 750KB

const bundles = [
  { name: "relay", path: "./apps/relay/dist/relay.bundle.js" },
  { name: "blossom", path: "./apps/blossom/dist/blossom.bundle.js" },
  { name: "gateway", path: "./apps/gateway/dist/gateway.bundle.js" },
];

let failed = false;

for (const bundle of bundles) {
  const stat = await Deno.stat(bundle.path);
  const size = stat.size;
  const kb = (size / 1024).toFixed(1);

  if (size > HARD_LIMIT) {
    console.error(`FAIL: ${bundle.name} is ${kb}KB — exceeds 1MB hard limit`);
    failed = true;
  } else if (size > SOFT_WARN) {
    console.warn(`WARN: ${bundle.name} is ${kb}KB — approaching 1MB limit (warn at 750KB)`);
  } else {
    console.log(`OK: ${bundle.name} is ${kb}KB`);
  }
}

if (failed) Deno.exit(1);
```

### Pattern 5: GitHub Actions CI Structure

**What:** Single workflow file, multiple jobs for parallelism.
**When to use:** The CI workflow.

```yaml
# .github/workflows/ci.yml
name: CI

on:
  push:
  pull_request:

jobs:
  validate:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: denoland/setup-deno@v2
        with:
          deno-version: v2.x
          cache: true
      - run: deno fmt --check
      - run: deno lint
      - run: deno check apps/relay/src/main.ts apps/blossom/src/main.ts apps/gateway/src/main.ts packages/shared/src/mod.ts
      - run: deno test --allow-all

  build-and-size-check:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: denoland/setup-deno@v2
        with:
          deno-version: v2.x
          cache: true
      - run: deno task build
      - run: deno run --allow-read scripts/check-bundle-sizes.ts
      - name: Upload bundle sizes
        uses: actions/upload-artifact@v4
        with:
          name: bundle-sizes-${{ github.sha }}
          path: |
            apps/relay/dist/relay.bundle.js
            apps/blossom/dist/blossom.bundle.js
            apps/gateway/dist/gateway.bundle.js
          retention-days: 1
```

### Pattern 6: PR Bundle Size Delta Comment

**What:** Build base branch, compare sizes, post PR comment.
**When to use:** Pull request CI events only.

The pattern requires two jobs: one builds the current branch (uploads artifact), another checks out the base branch, builds it, then compares. A `github-script` step posts the comparison as a PR comment.

```yaml
  bundle-delta:
    runs-on: ubuntu-latest
    if: github.event_name == 'pull_request'
    steps:
      - uses: actions/checkout@v4
        with:
          ref: ${{ github.base_ref }}
      - uses: denoland/setup-deno@v2
        with:
          deno-version: v2.x
          cache: true
      - run: deno task build
      - name: Save base branch sizes
        run: |
          echo "RELAY_BASE=$(stat -c%s apps/relay/dist/relay.bundle.js)" >> $GITHUB_ENV
          echo "BLOSSOM_BASE=$(stat -c%s apps/blossom/dist/blossom.bundle.js)" >> $GITHUB_ENV
          echo "GATEWAY_BASE=$(stat -c%s apps/gateway/dist/gateway.bundle.js)" >> $GITHUB_ENV
      # Then checkout PR branch, build, compare, post comment...
```

Source: Verified approach from GitHub Actions marketplace bundle-size-diff patterns.

### Pattern 7: Bunny Deploy Workflow

**What:** Deploy all three edge scripts on merge to main.
**When to use:** The deploy workflow triggered on merge to main.

```yaml
# .github/workflows/deploy.yml
name: Deploy

on:
  push:
    branches: [main]

jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: denoland/setup-deno@v2
        with:
          deno-version: v2.x
          cache: true
      - run: deno task build

      - name: Deploy relay
        uses: BunnyWay/actions/deploy-script@main
        with:
          script_id: ${{ secrets.BUNNY_RELAY_SCRIPT_ID }}
          deploy_key: ${{ secrets.BUNNY_RELAY_DEPLOY_KEY }}
          file: apps/relay/dist/relay.bundle.js

      - name: Deploy blossom
        uses: BunnyWay/actions/deploy-script@main
        with:
          script_id: ${{ secrets.BUNNY_BLOSSOM_SCRIPT_ID }}
          deploy_key: ${{ secrets.BUNNY_BLOSSOM_DEPLOY_KEY }}
          file: apps/blossom/dist/blossom.bundle.js

      - name: Deploy gateway
        uses: BunnyWay/actions/deploy-script@main
        with:
          script_id: ${{ secrets.BUNNY_GATEWAY_SCRIPT_ID }}
          deploy_key: ${{ secrets.BUNNY_GATEWAY_DEPLOY_KEY }}
          file: apps/gateway/dist/gateway.bundle.js
```

Source: https://raw.githubusercontent.com/BunnyWay/actions/main/deploy-script/src/bunny.ts (inspected directly)

**Critical finding:** The `file` parameter receives a **pre-built JS bundle** — the action reads the file contents and sends them as the `Code` field to `POST https://api.bunny.net/compute/script/{scriptId}/code`. It does NOT compile TypeScript itself. The build step must run first to produce the bundle files.

**Secrets required per edge script:** `BUNNY_*_SCRIPT_ID` (numeric script ID from dashboard) and `BUNNY_*_DEPLOY_KEY` (from Script → Deployments → Settings). Alternatively, use a single `api_key` (account API key) with `AccessKey` header — this works for all scripts without per-script deploy keys.

### Anti-Patterns to Avoid

- **Importing from relative paths across workspace members:** `import { X } from "../../packages/shared/src/types.ts"` — use bare specifier `@nsite/shared/types` instead. Relative cross-member imports break when members are published or moved.
- **Running `deno check .` without specifying entry points:** This may traverse test files and fail on missing permissions or over-broad type checks. Specify explicit entry points.
- **Passing raw TypeScript source to BunnyWay deploy action:** The action reads the file and sends its content verbatim to the Bunny API. You must pass a pre-built bundle — the Bunny Edge Script runtime executes it but the API endpoint does not compile TypeScript server-side.
- **Not calling `esbuild.stop()` in build scripts:** Deno won't exit while esbuild's internal child process is alive. Always call `await esbuild.stop()` at the end of build scripts.
- **Using `deno bundle` (removed in Deno 2):** The `deno bundle` subcommand was removed in Deno 2.x. Use esbuild + esbuild-deno-loader instead.
- **Omitting `configPath` from denoPlugins():** Without it, the plugin may not find the workspace import maps and will fail to resolve `@nsite/shared` bare specifiers.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Deno specifier resolution in esbuild | Custom esbuild resolver plugin | `jsr:@luca/esbuild-deno-loader` | Handles jsr:, npm:, https:, file:, import maps, workspaces — many edge cases |
| TypeScript type checking | Custom compiler invocation | `deno check` built-in | Built into Deno runtime, understands workspace structure |
| Code formatting | Custom prettier config | `deno fmt` built-in | Zero config, built-in, faster |
| Cross-platform shell commands in tasks | Bash scripts | `deno task` built-ins (cp, mv, mkdir, etc.) | Cross-platform, no extra deps |
| Script upload to Bunny | Custom fetch calls in workflow | `BunnyWay/actions/deploy-script@main` | Handles auth variants (deploy key, API key, OIDC), error handling |

**Key insight:** Deno's built-in toolchain eliminates the entire dev-dependencies category (no eslint, prettier, ts-node, jest, etc.) — the build.ts script is the only "extra" tooling needed.

---

## Common Pitfalls

### Pitfall 1: esbuild denoPlugins configPath Must Be Absolute

**What goes wrong:** `denoPlugins()` silently fails to load the import map, workspace member imports like `@nsite/shared` resolve to "not found".
**Why it happens:** `configPath` is resolved relative to the current working directory, which varies by how/where the build script is invoked.
**How to avoid:** Always use `new URL("./deno.json", import.meta.url).pathname` to get an absolute path relative to the build script's location.
**Warning signs:** Build succeeds but `@nsite/shared` imports produce "Module not found" errors.

### Pitfall 2: Node Built-in Modules Must Be External

**What goes wrong:** esbuild tries to bundle `node:crypto`, `node:buffer`, etc. — either fails or bloats bundle with polyfills.
**Why it happens:** Bunny Edge Script runtime provides these as globals; bundling them is redundant and increases size.
**How to avoid:** Always include `external: [...builtinModules, ...builtinModules.map(m => 'node:' + m)]` in esbuild config.
**Warning signs:** Bundle size unexpectedly large, or build error about unresolvable `node:*` modules.

### Pitfall 3: deno task --recursive Runs in Parallel by Default

**What goes wrong:** Build tasks for apps try to import workspace members that haven't been "built" yet. (Not an issue here since TypeScript sources are imported directly, but matters if build order creates artifacts.)
**Why it happens:** `deno task --recursive` runs matching tasks across all workspace members concurrently.
**How to avoid:** For this project, the shared package has no build step (it's imported as TypeScript source), so parallel is fine. If a build step is added to shared later, dependency ordering must be handled explicitly.
**Warning signs:** Intermittent build failures when members depend on each other's build artifacts.

### Pitfall 4: BunnyWay deploy-script@main Pins to Unstable Tip

**What goes wrong:** Using `@main` means any upstream change can break your deploy workflow without warning.
**Why it happens:** The official Bunny docs show `@main` in examples.
**How to avoid:** Once the initial setup works, pin to a specific commit SHA or tag: `BunnyWay/actions/deploy-script@v1` or `@<sha>`.
**Warning signs:** Deploy job suddenly fails after no changes to your repo.

### Pitfall 5: deno check Across All Entry Points Required

**What goes wrong:** Type errors in one app are missed if you only run `deno check` in one directory.
**Why it happens:** `deno check` without arguments only checks the current directory's entry points.
**How to avoid:** In CI and root deno.json tasks, explicitly list all entry points: `deno check apps/relay/src/main.ts apps/blossom/src/main.ts apps/gateway/src/main.ts packages/shared/src/mod.ts`. Alternatively, run `deno check **/*.ts` but this can be slow.
**Warning signs:** Type errors in app X slip through because CI only checked app Y.

### Pitfall 6: Bundle Size Check Runs After Deploy

**What goes wrong:** A bundle over 1MB is deployed to Bunny, then the size check fails — too late.
**Why it happens:** CI jobs run in wrong order.
**How to avoid:** Bundle size check must be a prerequisite of (or included in) the build job that precedes deployment. The deploy job should only run if build-and-size-check passes.
**Warning signs:** Bunny API may reject oversized bundles with a 400 error (unverified — size limit may also be enforced server-side, but don't rely on it).

---

## Code Examples

Verified patterns from official sources and inspected source code:

### Bunny API Endpoints (from inspected BunnyWay/actions source)

```typescript
// POST to save script code
// Source: https://raw.githubusercontent.com/BunnyWay/actions/main/deploy-script/src/bunny.ts
const endpoint_save = `https://api.bunny.net/compute/script/${scriptId}/code`;
await fetch(endpoint_save, {
  method: "POST",
  headers: {
    "Accept": "application/json",
    "Content-Type": "application/json",
    "DeploymentKey": deployKey,       // OR "AccessKey": apiKey
  },
  body: JSON.stringify({ Code: bundleContents }),
});

// POST to publish (make live)
const endpoint_publish = `https://api.bunny.net/compute/script/${scriptId}/publish`;
await fetch(endpoint_publish, {
  method: "POST",
  headers: { ... }, // same auth headers
});
```

### Workspace Member Import (verified against Deno workspace docs)

```typescript
// In apps/relay/src/main.ts
import { NostrEvent } from "@nsite/shared/types";  // bare specifier
import { validateEvent } from "@nsite/shared";       // default export path
```

### Deno Test Setup

```typescript
// packages/shared/src/sha256_test.ts
import { assertEquals } from "jsr:@std/assert";
import { sha256Hex } from "./sha256.ts";

Deno.test("sha256Hex produces correct hash", async () => {
  const result = await sha256Hex(new TextEncoder().encode("hello"));
  assertEquals(result, "2cf24dba5fb0a30e26e83b2ac5b9e29e1b161e5c1fa7425e73043362938b9824");
});
```

### Running Tests Across Workspace

```bash
# From workspace root — runs tests in all members
deno test --allow-all --recursive

# From root deno.json task
# "test": "deno test --allow-all --recursive"
```

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| `deno bundle` | esbuild + jsr:@luca/esbuild-deno-loader | Deno 2.0 (Oct 2024) | Must use esbuild for bundling; deno bundle removed entirely |
| Separate package managers (npm/yarn) for Node libs | `npm:` specifiers in deno.json | Deno 1.28+ | Import npm packages directly without node_modules setup |
| Manual import maps | deno.json workspace with name field | Deno 1.45 (Jul 2024) | Workspace members auto-resolve each other by name |
| `deno task --cwd apps/relay build` per member | `deno task --recursive build` | Deno 1.45+ | Single command builds all workspace members |

**Deprecated/outdated:**
- `deno bundle`: Removed in Deno 2.0 — use esbuild
- `deno vendor`: Deprecated in Deno 1.x — avoid
- jsr:@luca/esbuild-deno-loader on deno.land/x: Old location — use JSR (`jsr:@luca/esbuild-deno-loader@^0.11.1`)

---

## Open Questions

1. **Does esbuild-deno-loader v0.11.1 resolve workspace bare specifiers correctly?**
   - What we know: The plugin accepts a `configPath` pointing to a `deno.json`; Deno workspace docs confirm members resolve by `name` field
   - What's unclear: Whether the loader correctly merges the root workspace `deno.json` scopes with member `deno.json` import maps when `configPath` points to a member-level `deno.json`
   - Recommendation: Test with a minimal workspace setup early in implementation. If cross-member resolution fails, try pointing `configPath` at the root `deno.json` instead of the member's. The alternative `jsr:@twosaturdayscode/esbuild-deno-plugin` explicitly advertises workspace scope injection as a feature.

2. **Does Bunny Edge Script runtime version (Deno 1.46.3) affect TypeScript targeting?**
   - What we know: Bunny runs "a modified Deno runtime, currently version 1.x (1.46.3 at the time of writing)" per community sources
   - What's unclear: Whether this version constraint should affect esbuild `target` setting (e.g., `target: "deno1.46"`)
   - Recommendation: Set `target: "esnext"` initially — esbuild only transpiles syntax, and Deno 1.46 supports modern JS. If runtime errors occur, add explicit target.

3. **Are per-script deploy keys or a single account API key preferred for CI?**
   - What we know: BunnyWay action supports both `deploy_key` (per-script) and `api_key` (account-level)
   - What's unclear: Security best practices for Bunny — per-script keys are more scoped
   - Recommendation: Use per-script `DEPLOY_KEY` secrets (3 secrets per script × 3 scripts = 6 secrets total, plus 3 SCRIPT_IDs = 9 secrets). This limits blast radius if a secret is compromised. The account API key approach (3 SCRIPT_IDs + 1 API_KEY = 4 secrets) is simpler but grants broader access.

---

## Sources

### Primary (HIGH confidence)
- `https://docs.deno.com/runtime/fundamentals/workspaces/` — workspace configuration, member imports, task flags
- `https://docs.deno.com/runtime/reference/cli/task/` — `--recursive`, `--filter`, `--cwd` flags
- `https://docs.deno.com/runtime/fundamentals/testing/` — deno test, test file patterns
- `https://docs.deno.com/runtime/reference/continuous_integration/` — GitHub Actions workflow for Deno
- `https://raw.githubusercontent.com/BunnyWay/actions/main/deploy-script/src/bunny.ts` — Bunny API endpoints (inspected directly)
- `https://raw.githubusercontent.com/BunnyWay/actions/main/deploy-script/action.yml` — action inputs (inspected directly)
- `https://raw.githubusercontent.com/BunnyWay/actions/main/deploy-script/src/action.ts` — confirms file is read and sent verbatim (inspected directly)
- `jsr:@luca/esbuild-deno-loader@^0.11.1` JSR docs — configuration options (configPath, loader, etc.)

### Secondary (MEDIUM confidence)
- `https://bunny-launcher.net/edge-scripting/bundling/` — esbuild config for Bunny Edge Scripts (unofficial but detailed, cross-referenced with official Bunny docs)
- `https://docs.bunny.net/docs/edge-scripting-standalone` — Bunny standalone script entry point format
- `https://deno.com/blog/v1.45` — workspace feature announcement, verified against current docs
- `https://toshy.github.io/BunnyNet-PHP/edge-scripting-api/` — API operation names (SetCode/PublishRelease) cross-referenced with inspected action source

### Tertiary (LOW confidence)
- Community source (via WebSearch): Bunny Edge Script runtime is "Deno 1.46.3" — not verified against official Bunny docs

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — all libraries verified against official docs/JSR; versions from release pages
- Architecture: HIGH — workspace config verified against Deno docs; API endpoints inspected from source
- Pitfalls: HIGH for items from inspected source; MEDIUM for runtime version targeting question
- Bunny deploy flow: HIGH — inspected actual action source code, confirmed exact API calls

**Research date:** 2026-03-13
**Valid until:** 2026-06-13 (stable domain — Deno workspace API, esbuild plugin, Bunny deploy action unlikely to change fundamentally within 90 days)
