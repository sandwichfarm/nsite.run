---
gsd_state_version: 1.0
milestone: v1.2
milestone_name: Named Sites
status: ready_to_plan
stopped_at: null
last_updated: "2026-03-21"
last_activity: "2026-03-21 — Roadmap created for v1.2, phases 10-11 defined"
progress:
  total_phases: 2
  completed_phases: 0
  total_plans: 0
  completed_plans: 0
  percent: 0
---

# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-03-21)

**Core value:** Provide reliable, always-available nsite infrastructure that serves sites fast via progressive caching while making the relay and blossom accessible to the broader nsite ecosystem.
**Current focus:** v1.2 Named Sites — Phase 10: Gateway Named Site Encoding

## Current Position

Phase: 10 of 11 (Gateway Named Site Encoding)
Plan: —
Status: Ready to plan
Last activity: 2026-03-21 — Roadmap created for v1.2

Progress: [░░░░░░░░░░] 0%

## Accumulated Context

### Decisions

See PROJECT.md Key Decisions table for full list with outcomes.

Recent decisions affecting current work:
- Base36 named site encoding chosen because SSL certs can't do double wildcards (`*.*.nsite.run`); single-label `<pubkeyB36><dTag>` fits `*.nsite.run` cert

### Pending Todos

None.

### Blockers/Concerns

- Base36 encoding spec was "pending" at v1.1 ship — now being implemented. If NIP changes after Phase 10, gateway will need a follow-up fix.

## Session Continuity

Last session: 2026-03-21
Stopped at: Roadmap created — ready to plan Phase 10
Resume file: None
