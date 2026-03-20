---
gsd_state_version: 1.0
milestone: v1.1
milestone_name: Feature Gaps
status: unknown
stopped_at: Completed 07-deploy-ux-improvements-07-02-PLAN.md
last_updated: "2026-03-20T16:04:42.195Z"
progress:
  total_phases: 3
  completed_phases: 1
  total_plans: 2
  completed_plans: 2
---

# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-03-20)

**Core value:** Provide reliable, always-available nsite infrastructure that serves sites fast via progressive caching while making the relay and blossom accessible to the broader nsite ecosystem.
**Current focus:** Phase 07 — deploy-ux-improvements

## Current Position

Phase: 07 (deploy-ux-improvements) — COMPLETE
Plan: 2 of 2

## Accumulated Context

### Decisions

See PROJECT.md Key Decisions table for full list with outcomes.

- All v1.1 work is SPA-only (apps/spa Svelte code) — no backend/gateway changes needed
- [Phase 07-deploy-ux-improvements]: Reject only 2+ loose files with no directory — single file and archive drops continue unchanged
- [Phase 07-deploy-ux-improvements]: TEXT_EXTENSIONS allowlist approach for preview eligibility; 100-line pagination via previewLinesShown state
- [Phase 07-deploy-ux-improvements]: Excluded state moved from FileTree internal to App.svelte-managed prop — single source of truth for excluded files
- [Phase 07-deploy-ux-improvements]: Hover-reveal toggle pattern: opacity-0 group-hover:opacity-100 with stopPropagation for exclude buttons on all file/dir rows

### Pending Todos

None.

### Blockers/Concerns

None.

## Session Continuity

Last session: 2026-03-20T16:04:42.193Z
Stopped at: Completed 07-deploy-ux-improvements-07-02-PLAN.md
Resume file: None
