---
gsd_state_version: 1.0
milestone: v1.2
milestone_name: Named Sites
status: unknown
stopped_at: Phase 11 context gathered
last_updated: "2026-03-21T09:20:51.150Z"
progress:
  total_phases: 2
  completed_phases: 1
  total_plans: 2
  completed_plans: 2
---

# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-03-21)

**Core value:** Provide reliable, always-available nsite infrastructure that serves sites fast via progressive caching while making the relay and blossom accessible to the broader nsite ecosystem.
**Current focus:** Phase 10 — gateway-named-site-encoding

## Current Position

Phase: 10 (gateway-named-site-encoding) — EXECUTING
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

### Pending Todos

None.

### Blockers/Concerns

- Base36 encoding spec was "pending" at v1.1 ship — now being implemented. If NIP changes after Phase 10, gateway will need a follow-up fix.

## Session Continuity

Last session: 2026-03-21T09:20:51.148Z
Stopped at: Phase 11 context gathered
Resume file: .planning/phases/11-spa-named-site-support/11-CONTEXT.md
