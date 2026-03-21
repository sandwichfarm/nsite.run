---
gsd_state_version: 1.0
milestone: v1.2
milestone_name: Named Sites
status: in-progress
stopped_at: "Completed 11-01-PLAN.md"
last_updated: "2026-03-21T10:45:00.000Z"
progress:
  total_phases: 2
  completed_phases: 1
  total_plans: 4
  completed_plans: 3
---

# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-03-21)

**Core value:** Provide reliable, always-available nsite infrastructure that serves sites fast via progressive caching while making the relay and blossom accessible to the broader nsite ecosystem.
**Current focus:** Phase 11 — spa-named-site-support

## Current Position

Phase: 11 (spa-named-site-support) — EXECUTING
Plan: 2 of 2

## Accumulated Context

### Decisions

See PROJECT.md Key Decisions table for full list with outcomes.

Recent decisions affecting current work:

- Base36 named site encoding chosen because SSL certs can't do double wildcards (`*.*.nsite.run`); single-label `<pubkeyB36><dTag>` fits `*.nsite.run` cert
- Hand-rolled BigInt base36 codec in packages/shared — no external library needed (~55 lines)
- Decode validates with regex /^[a-z0-9]{50}$/ before any math for fast-fail on bad inputs
- [Phase 10-gateway-named-site-encoding]: SitePointer.npub kept for backward compat — named sites set npub to empty string and populate pubkeyHex
- [Phase 10-gateway-named-site-encoding]: parts.length === 3 enforces single-label subdomain; 4+ part hosts (old format) return null
- [Phase 11-01]: buildManifest backward compat: boolean third arg detected via typeof and wrapped as { spaFallback } — existing App.svelte callers unchanged during transition
- [Phase 11-01]: fetchAllManifests uses interleaved flatMap query (even=root, odd=named) — single Promise.allSettled covers all relays and both kinds
- [Phase 11-01]: Empty manifest detection: absence of path tags (not kind-based) — consistent for both 15128 and 35128

### Pending Todos

None.

### Blockers/Concerns

- Base36 encoding spec was "pending" at v1.1 ship — now being implemented. If NIP changes after Phase 10, gateway will need a follow-up fix.

## Session Continuity

Last session: 2026-03-21T10:45:00.000Z
Stopped at: Completed 11-01-PLAN.md
Resume file: .planning/phases/11-spa-named-site-support/11-02-PLAN.md
