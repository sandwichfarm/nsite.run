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

## Milestone: v1.1 — Feature Gaps

**Shipped:** 2026-03-20
**Phases:** 3 | **Plans:** 6

### What Was Built
- Deploy UX: multi-file drag rejection, inline file preview with 100-line pagination, per-file exclude toggle with recursive directory support and three-layer feedback (inline + badge + summary)
- Anonymous key management: sessionStorage persistence with hex key, auto-restore on reload, logout confirmation modal with checkbox gate, nsec file download
- Site management: "Update Site" button preserving signer, SiteInfoCard with multi-relay manifest query, decentralized deletion (empty manifest + kind 5 to relays, BUD-02 DELETE to blossoms) with scope summary modal

### What Worked
- Discuss-phase → plan-phase → execute-phase pipeline ran cleanly for all 3 phases with zero replanning
- Plan checker passed all plans on first attempt — context decisions were specific enough to prevent ambiguity
- 2-task plans with 2 waves per phase kept execution fast (~2-3 min per plan)
- GitHub issues provided clear acceptance criteria — minimal discussion needed

### What Was Inefficient
- ROADMAP.md checkbox tracking drifted again (phase 7 checkboxes not updated by executor)
- STATE.md accumulated many phase-level decisions that probably belong in summaries, not state

### Patterns Established
- sessionStorage for sensitive ephemeral data (anonymous keys) — localStorage for persistent preferences
- `createEventDispatcher` + `on:event` pattern for child-to-parent communication across SPA components
- Multi-relay parallel query with `Promise.allSettled` + deduplication by event ID
- Decentralized deletion: empty replaceable event + NIP-09 kind 5 + BUD-02 DELETE — belt and suspenders

### Key Lessons
1. User feedback (GitHub issues) provides better requirements than speculative feature planning — every issue had clear problem/solution framing
2. SPA-only phases execute faster because no backend coordination needed — keep frontend and backend phases separate when possible
3. sessionStorage vs localStorage is a meaningful UX decision, not just a technical one — users' mental model of "session" matters

### Cost Observations
- Model mix: opus for planning, sonnet for execution and verification
- All 6 plans completed in single session
- Notable: zero research phases needed — existing v1.0 patterns covered all requirements

---

## Cross-Milestone Trends

### Process Evolution

| Milestone | Phases | Plans | Key Change |
|-----------|--------|-------|------------|
| v1.0 | 6 | 18 | Initial milestone — established patterns |
| v1.1 | 3 | 6 | Issue-driven — all from GitHub feedback, zero research needed |

### Cumulative Quality

| Milestone | Requirements | Coverage |
|-----------|-------------|----------|
| v1.0 | 58/58 | 100% |
| v1.1 | 9/9 | 100% |

### Top Lessons (Verified Across Milestones)

1. Edge Script module independence (no cross-package imports) is a hard constraint — plan for it
2. Port-from-reference is dramatically faster than greenfield for protocol implementations
3. User feedback (GitHub issues) produces cleaner requirements than speculative planning — confirmed in v1.1
