# Roadmap: nsite.run

## Milestones

- ✅ **v1.0 MVP** — Phases 1-6 (shipped 2026-03-20)
- 🚧 **v1.1 Feature Gaps** — Phases 7-9 (in progress)

## Phases

<details>
<summary>✅ v1.0 MVP (Phases 1-6) — SHIPPED 2026-03-20</summary>

- [x] Phase 1: Monorepo and Build Infrastructure (3/3 plans) — completed 2026-03-13
- [x] Phase 2: Relay (2/2 plans) — completed 2026-03-13
- [x] Phase 3: Blossom (3/3 plans) — completed 2026-03-14
- [x] Phase 4: Gateway Routing Layer (1/1 plan) — completed 2026-03-14
- [x] Phase 5: nsite Resolver and Progressive Caching (4/4 plans) — completed 2026-03-14
- [x] Phase 6: SPA Deploy Interface (5/5 plans) — completed 2026-03-18

</details>

### 🚧 v1.1 Feature Gaps (In Progress)

**Milestone Goal:** Close UX gaps in the deploy SPA — improve file handling in the deploy flow, protect anonymous users from key loss, and add post-deploy site management actions. All changes are SPA-only (apps/spa Svelte code).

- [ ] **Phase 7: Deploy UX Improvements** — Reject loose file drops, add file preview, per-file exclude/include toggle
- [ ] **Phase 8: Anonymous Key Management** — Persist anonymous key across sessions, confirmation on logout, file download backup
- [ ] **Phase 9: Site Management** — Update button after deploy, returning user dashboard, site deletion

## Phase Details

### Phase 7: Deploy UX Improvements
**Goal**: Users have full control over what they deploy before uploading
**Depends on**: Phase 6 (SPA Deploy Interface)
**Requirements**: DPLX-01, DPLX-02, DPLX-03
**Success Criteria** (what must be TRUE):
  1. Dragging multiple loose files onto the drop zone shows an error message instructing the user to use a folder or archive instead
  2. Clicking a file in the deploy tree shows its contents (inline or modal) without leaving the deploy flow
  3. Hovering a file in the deploy tree reveals a toggle to exclude it, and excluded files appear in a collapsed ignored summary section
  4. A user can re-include a previously excluded file by toggling it back from the ignored summary
**Plans**: 2 plans
Plans:
- [ ] 07-01-PLAN.md — Multi-file drop rejection and inline file preview
- [ ] 07-02-PLAN.md — Universal exclude toggle and ignored summary section

### Phase 8: Anonymous Key Management
**Goal**: Anonymous users can safely navigate and log out without losing their generated key
**Depends on**: Phase 7
**Requirements**: AKEY-01, AKEY-02, AKEY-03
**Success Criteria** (what must be TRUE):
  1. Navigating away from the deploy page and returning (or reloading) restores the anonymous session with the same key and current nsite state visible
  2. Clicking logout as an anonymous user triggers a confirmation dialog that does not dismiss until the user acknowledges they have backed up their nsec
  3. The nsec backup dialog offers a file download as the primary action, with clipboard copy as a secondary option
  4. After completing the backup confirmation, logout clears the key and returns the user to the unauthenticated state
**Plans**: 2 plans
Plans:
- [ ] 08-01-PLAN.md — Session persistence, anonymous badge, and nsec download utility
- [ ] 08-02-PLAN.md — Logout confirmation modal with backup enforcement

### Phase 9: Site Management
**Goal**: Users can update or delete a published site and see existing site info on return visits
**Depends on**: Phase 8
**Requirements**: SITE-01, SITE-02, SITE-03
**Success Criteria** (what must be TRUE):
  1. After a successful deploy, an "Update Site" button is visible that returns the user to the file drop zone with the same key pre-loaded
  2. A returning logged-in user sees their existing site URL, last publish date, and file count/size on page load before taking any action
  3. A user can trigger site deletion via a confirmation dialog that publishes an empty/tombstone manifest to the relay
  4. After deletion, the UI reflects that no site is currently published for the user's key
**Plans**: TBD

## Progress

**Execution Order:** Phases execute in numeric order: 7 → 8 → 9

| Phase | Milestone | Plans Complete | Status | Completed |
|-------|-----------|----------------|--------|-----------|
| 1. Monorepo and Build Infrastructure | v1.0 | 3/3 | Complete | 2026-03-13 |
| 2. Relay | v1.0 | 2/2 | Complete | 2026-03-13 |
| 3. Blossom | v1.0 | 3/3 | Complete | 2026-03-14 |
| 4. Gateway Routing Layer | v1.0 | 1/1 | Complete | 2026-03-14 |
| 5. nsite Resolver and Progressive Caching | v1.0 | 4/4 | Complete | 2026-03-14 |
| 6. SPA Deploy Interface | v1.0 | 5/5 | Complete | 2026-03-18 |
| 7. Deploy UX Improvements | v1.1 | 0/2 | In progress | - |
| 8. Anonymous Key Management | v1.1 | 0/2 | Not started | - |
| 9. Site Management | v1.1 | 0/? | Not started | - |
