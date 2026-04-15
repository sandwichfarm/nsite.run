# Phase 1: Monorepo and Build Infrastructure - Context

**Gathered:** 2026-03-13
**Status:** Ready for planning

<domain>
## Phase Boundary

Scaffold a Deno monorepo with esbuild bundling for three Bunny Edge Scripts (relay, blossom, gateway), a shared types+utilities package, and a CI pipeline that enforces bundle size limits and deploys to Bunny. No feature code — just build infrastructure that all subsequent phases build on.

</domain>

<decisions>
## Implementation Decisions

### Runtime and toolchain
- Deno as the development runtime and toolchain
- deno.json workspaces for monorepo management
- Built-in deno test, deno fmt, deno lint — no extra dev dependencies for these
- esbuild for final bundling to Bunny Edge Script format

### Workspace layout
- Apps/packages split: `apps/` for deployable edge scripts, `packages/` for shared libraries
- Three app packages: `apps/relay`, `apps/blossom`, `apps/gateway`
- One shared package: `packages/shared`
- Each workspace member has its own `deno.json`

### Package naming and imports
- Scoped package names: `@nsite/relay`, `@nsite/blossom`, `@nsite/gateway`, `@nsite/shared`
- Shared package imported as `@nsite/shared` via Deno workspace import map

### Shared package scope
- Types AND runtime utilities (not types-only)
- Includes: nostr event types/interfaces, event validation, SHA-256 helpers, shared constants
- Anything multiple edge scripts need lives here

### Test framework
- Set up in Phase 1 using deno test (not deferred to Phase 2)
- Test infrastructure ready before feature code arrives

### CI platform
- GitHub Actions
- Runs on both push (any branch) and pull requests

### CI pipeline steps
- Full validation: deno fmt --check, deno lint, deno check (type check), deno test, build, bundle size check
- All checks must pass before merge

### Bundle size enforcement
- Hard fail at 1MB per edge script bundle
- Warning at 750KB
- PR comment bot showing absolute sizes AND delta from base branch
- Requires building both PR branch and base branch for delta comparison

### Deployment
- CI deploys all three edge scripts to Bunny on merge to main
- All scripts deploy together (not selectively by what changed)
- Bunny API key stored in GitHub Secrets

### Claude's Discretion
- esbuild configuration details (output format, target, etc.)
- deno.json workspace configuration specifics
- GitHub Actions workflow structure (single vs multi-job)
- Bundle size check script implementation
- PR comment formatting

</decisions>

<specifics>
## Specific Ideas

No specific requirements — open to standard approaches for Deno monorepo setup.

</specifics>

<code_context>
## Existing Code Insights

### Reusable Assets
- None — greenfield project, no existing code

### Established Patterns
- None yet — Phase 1 establishes the patterns all subsequent phases follow

### Integration Points
- Root `deno.json` defines workspace members and shared configuration
- Each app's `deno.json` declares its own dependencies and build tasks
- esbuild config produces bundles that Bunny Edge Scripting runtime can execute

</code_context>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 01-monorepo-and-build-infrastructure*
*Context gathered: 2026-03-13*
