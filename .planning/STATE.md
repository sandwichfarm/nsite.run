---
gsd_state_version: 1.0
milestone: v1.1
milestone_name: Feature Gaps
status: in-progress
stopped_at: "Completed 08-02-PLAN.md"
last_updated: "2026-03-20T16:50:24Z"
progress:
  total_phases: 3
  completed_phases: 2
  total_plans: 4
  completed_plans: 4
---

# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-03-20)

**Core value:** Provide reliable, always-available nsite infrastructure that serves sites fast via progressive caching while making the relay and blossom accessible to the broader nsite ecosystem.
**Current focus:** Phase 08 — anonymous-key-management

## Current Position

Phase: 08 (anonymous-key-management) — COMPLETE
Plan: 2 of 2 (all plans complete)

## Accumulated Context

### Decisions

See PROJECT.md Key Decisions table for full list with outcomes.

- All v1.1 work is SPA-only (apps/spa Svelte code) — no backend/gateway changes needed
- [Phase 07-deploy-ux-improvements]: Reject only 2+ loose files with no directory — single file and archive drops continue unchanged
- [Phase 07-deploy-ux-improvements]: TEXT_EXTENSIONS allowlist approach for preview eligibility; 100-line pagination via previewLinesShown state
- [Phase 07-deploy-ux-improvements]: Excluded state moved from FileTree internal to App.svelte-managed prop — single source of truth for excluded files
- [Phase 07-deploy-ux-improvements]: Hover-reveal toggle pattern: opacity-0 group-hover:opacity-100 with stopPropagation for exclude buttons on all file/dir rows
- [Phase 08-anonymous-key-management]: Store anonymous key as 64-char hex string in sessionStorage (not nsec) — compact and safe; auto-clears on tab close
- [Phase 08-anonymous-key-management]: Restore-or-clear pattern on mount — if signerType is anonymous but key missing from sessionStorage, clear stale session
- [Phase 08-anonymous-key-management]: Download button (purple) is primary action for nsec backup; Copy button (amber) is secondary convenience action
- [Phase 08-anonymous-key-management]: LogoutConfirmModal allows backdrop/Escape dismiss (cancel is safe); only confirming clears anonymous key
- [Phase 08-anonymous-key-management]: deployNsec threaded from App.svelte through Navbar prop to modal rather than reading sessionStorage in modal

### Pending Todos

None.

### Blockers/Concerns

None.

## Session Continuity

Last session: 2026-03-20T16:50:24Z
Stopped at: Completed 08-02-PLAN.md
Resume file: Phase 08 complete — all plans finished
