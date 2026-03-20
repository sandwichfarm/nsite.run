---
gsd_state_version: 1.0
milestone: v1.1
milestone_name: Feature Gaps
status: unknown
stopped_at: Completed 09-02-PLAN.md
last_updated: "2026-03-20T18:26:29.057Z"
progress:
  total_phases: 3
  completed_phases: 3
  total_plans: 6
  completed_plans: 6
---

# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-03-20)

**Core value:** Provide reliable, always-available nsite infrastructure that serves sites fast via progressive caching while making the relay and blossom accessible to the broader nsite ecosystem.
**Current focus:** Phase 09 — site-management

## Current Position

Phase: 09 (site-management) — EXECUTING
Plan: 1 of 2

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
- [Phase 09-site-management]: fetchExistingManifest queries all relays in parallel (Promise.allSettled) and returns newest event — resetForUpdate preserves signer identity for seamless update flow
- [Phase 09-site-management]: publishEmptyManifest uses replaceable event semantics — no special gateway support needed; existingManifest cleared to null after deletion so UI returns to idle state automatically

### Pending Todos

None.

### Blockers/Concerns

None.

## Session Continuity

Last session: 2026-03-20T18:23:06.125Z
Stopped at: Completed 09-02-PLAN.md
Resume file: None
