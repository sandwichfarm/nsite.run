# Project Retrospective

*A living document updated after each milestone. Lessons feed forward into future planning.*

## Milestone: v1.0 — MVP

**Shipped:** 2026-03-20
**Phases:** 6 | **Plans:** 18

### What Was Built
- NIP-01 nostr relay scoped to nsite event kinds (15128/35128/10002/10063) with libSQL persistence
- BUD-01/02 blossom server with Bunny Storage and kind 24242 Nostr auth
- Gateway router dispatching all traffic (WebSocket/blossom/resolver/SPA) via host-header priority
- Three-state progressive caching resolver (cold/warm-outdated/warm-current) with update banner injection
- Svelte SPA deploy interface with NIP-07/NIP-46 auth, drag-drop upload, secret scanning
- CI/CD pipeline: esbuild bundling, bundle size enforcement, deploy to Bunny Edge Scripting

### What Worked
- Porting from existing reference implementations (nostr.pub, blssm.us) made phases 2-3 fast
- TDD approach caught integration issues early (esbuild loader config, import map resolution)
- Small focused plans (1-3 tasks each) kept execution clean with atomic commits
- Gateway-as-router architecture worked on first attempt — no pull zone edge rules needed

### What Was Inefficient
- v2 commit squashed all GSD-planned work into one commit — lost granular git history
- Some ROADMAP.md checkboxes weren't updated during execution (phases 1-4, 6 still unchecked)
- STATE.md progress tracking drifted from actual progress after phase 5

### Patterns Established
- Edge Script module independence: each app has its own module graph, no cross-package imports (db.ts duplicated intentionally)
- esbuild `loader: { ".html": "text" }` for inlining HTML templates at bundle time
- apps/spa as standalone npm project outside Deno workspace (npm/Vite build pipeline)
- SPA_ASSETS_URL env var pattern for gateway → CDN proxy without inlining assets

### Key Lessons
1. Bunny Edge Scripts work well for this architecture — three scripts under 150KB each, well within 1MB limit
2. Gateway db.ts duplication is worth the trade-off vs. cross-package import complexity on Edge Scripting
3. Progressive caching state machine (cold/warm-outdated/warm-current) is the most complex component — invest heavily in testing here for v2

### Cost Observations
- Model mix: balanced profile (opus for planning, sonnet for execution)
- Notable: most execution plans completed in 2-8 minutes each

---

## Cross-Milestone Trends

### Process Evolution

| Milestone | Phases | Plans | Key Change |
|-----------|--------|-------|------------|
| v1.0 | 6 | 18 | Initial milestone — established patterns |

### Cumulative Quality

| Milestone | Requirements | Coverage |
|-----------|-------------|----------|
| v1.0 | 58/58 | 100% |

### Top Lessons (Verified Across Milestones)

1. Edge Script module independence (no cross-package imports) is a hard constraint — plan for it
2. Port-from-reference is dramatically faster than greenfield for protocol implementations
