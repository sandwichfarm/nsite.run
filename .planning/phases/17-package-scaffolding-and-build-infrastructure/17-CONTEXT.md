# Phase 17: Package Scaffolding and Build Infrastructure - Context

**Gathered:** 2026-03-25
**Status:** Ready for planning

<domain>
## Phase Boundary

Create a working `packages/deployer` package skeleton with npm workspaces, correct exports map (including "svelte" condition for component library consumption), and dual Vite build configs (widget IIFE+ESM bundle and lib source export). Validate with publint. This phase delivers infrastructure only — no deploy logic moves yet.

</domain>

<decisions>
## Implementation Decisions

### Package naming and identity
- **D-01:** Package name is `@nsite/deployer` — consistent with `@nsite/spa`, `@nsite/stealthis` convention
- **D-02:** Custom element tag is `<nsite-deployer>` — distinct from stealthis (which has its own separate tag)
- **D-03:** Bundle output files: `deployer.js` (IIFE) and `deployer.mjs` (ESM) in `dist/`

### Workspace configuration
- **D-04:** npm workspaces scoped to npm packages only: `["apps/spa", "packages/deployer"]` — Deno packages (shared, edge scripts) stay outside npm workspace. JSR integration deferred to later.
- **D-05:** No root package.json exists currently — must create from scratch

### Exports map
- **D-06:** Must include `"svelte"` export condition pointing at raw `.svelte` source files — SPA's Vite compiles them natively (no pre-build needed for dev)
- **D-07:** Must include `"import"` condition for ESM bundle and `"default"` for IIFE bundle — matches stealthis pattern

### Dual Vite configs
- **D-08:** Widget config (`vite.widget.config.js`) builds IIFE+ESM with Svelte inlined — self-contained for embedding
- **D-09:** No build step needed for Svelte component library consumption — raw source exported via "svelte" condition, consumer's Vite processes it
- **D-10:** Widget config uses `@sveltejs/vite-plugin-svelte` for Svelte compilation within the bundle

### Claude's Discretion
- Dependency ownership split between packages/deployer and apps/spa (Claude picks cleanest approach)
- Exact exports map structure and conditions beyond "svelte", "import", "default"
- Whether to use `vite.config.js` for dev and `vite.widget.config.js` for widget build, or a single config with mode switching
- publint configuration details

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Stealthis reference implementation
- `~/Develop/nsite/stealthis/package.json` — Reference package.json with exports map, IIFE+ESM pattern
- `~/Develop/nsite/stealthis/vite.config.ts` — Reference Vite lib mode config: `formats: ['iife', 'es']`, outDir: dist

### Existing package structure
- `apps/spa/package.json` — Current SPA dependencies that will partially move to deployer
- `apps/spa/vite.config.js` — Current SPA Vite config with svelte plugin + yaml plugin
- `apps/spa/svelte.config.js` — Current Svelte preprocessor config (vitePreprocess)
- `packages/shared/deno.json` — Deno-based shared package (NOT in npm workspace scope)

### Research
- `.planning/research/STACK.md` — Stack recommendations, version constraints, build tooling decisions
- `.planning/research/ARCHITECTURE.md` — Package structure, dual build pipeline, dependency flow
- `.planning/research/PITFALLS.md` — Pitfall 24 (dual Vite configs), Pitfall 25 (exports map)

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- stealthis `vite.config.ts`: Direct reference for IIFE+ESM lib mode config (simple, proven)
- stealthis `package.json`: Reference for exports map with import/default conditions

### Established Patterns
- `@nsite/` scoped naming for all packages in the ecosystem
- Deno for edge scripts (relay, blossom, gateway) and shared package; npm for SPA
- No root package.json currently — this is a greenfield addition
- SPA uses `@sveltejs/vite-plugin-svelte` 3.x with `vitePreprocess()`

### Integration Points
- Root `package.json` with `workspaces` field connects apps/spa to packages/deployer
- `apps/spa/package.json` will add `"@nsite/deployer": "workspace:*"` as a dependency
- Placeholder exports in packages/deployer must resolve for apps/spa to build

</code_context>

<specifics>
## Specific Ideas

- stealthis (at ~/Develop/nsite/stealthis/) is the canonical reference for IIFE+ESM bundling pattern — replicate its Vite config approach but add Svelte plugin
- The `<nsite-deployer>` tag name is intentionally distinct from stealthis (which has its own tag)
- JSR publication is planned for later, not this milestone

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 17-package-scaffolding-and-build-infrastructure*
*Context gathered: 2026-03-25*
