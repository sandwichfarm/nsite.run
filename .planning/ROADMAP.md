# Roadmap: nsite.run

## Milestones

- ✅ **v1.0 MVP** — Phases 1-6 (shipped 2026-03-20)
- ✅ **v1.1 Feature Gaps** — Phases 7-9 (shipped 2026-03-20)
- 🚧 **v1.2 Named Sites** — Phases 10-11 (in progress)

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

<details>
<summary>✅ v1.1 Feature Gaps (Phases 7-9) — SHIPPED 2026-03-20</summary>

- [x] Phase 7: Deploy UX Improvements (2/2 plans) — completed 2026-03-20
- [x] Phase 8: Anonymous Key Management (2/2 plans) — completed 2026-03-20
- [x] Phase 9: Site Management (2/2 plans) — completed 2026-03-20

</details>

### 🚧 v1.2 Named Sites (In Progress)

**Milestone Goal:** Support the updated nsite spec's base36 named site encoding in both gateway and SPA, add manifest metadata (title, description), and enable deploying and managing named sites from the web deployer.

- [x] **Phase 10: Gateway Named Site Encoding** - Replace old double-wildcard format with base36 single-label parsing and kind 35128 resolution (completed 2026-03-21)
- [ ] **Phase 11: SPA Named Site Support** - Add root/named site selector, dTag input, title/description metadata, and multi-site management

## Phase Details

### Phase 10: Gateway Named Site Encoding
**Goal**: The gateway correctly identifies and serves named sites using the new base36 single-subdomain encoding, and stops accepting the deprecated double-wildcard format
**Depends on**: Phase 9 (v1.1 complete)
**Requirements**: GATE-13, GATE-14, GATE-15
**Success Criteria** (what must be TRUE):
  1. A request to `<pubkeyB36><dTag>.nsite.run` (51-63 chars, all `[a-z0-9]`) resolves and serves the correct named site content
  2. The gateway correctly decodes the first 50 chars of the subdomain label as a base36 pubkey and the remainder as the dTag
  3. Named site manifest is fetched as kind 35128 using the decoded pubkey and dTag as the `#d` filter
  4. Requests to the old `identifier.npub1xxx.nsite.run` format no longer match a named site route
**Plans:** 2/2 plans complete

Plans:
- [x] 10-01-PLAN.md — Base36 codec in shared package (TDD)
- [x] 10-02-PLAN.md — Hostname parser rewrite + resolver adjustment

### Phase 11: SPA Named Site Support
**Goal**: Users can deploy named sites with a dTag and optional title/description, and can view and switch between all their sites (root and named) in the Manage tab
**Depends on**: Phase 10
**Requirements**: SPA-14, SPA-15, SPA-16, SPA-17, SPA-18, SPA-19
**Success Criteria** (what must be TRUE):
  1. User can select "Root site" or "Named site" in the deploy flow before uploading
  2. When "Named site" is selected, user can enter a dTag that is validated against `^[a-z0-9]{1,13}$` with inline error feedback
  3. A successful named site deploy publishes a kind 35128 event with the correct `d` tag
  4. User can add a title and description that appear as tags on the published manifest event (both root and named sites)
  5. The Manage tab lists all user sites (root kind 15128 and named kind 35128) and allows switching the active site for update or delete operations
**Plans:** 2 plans

Plans:
- [ ] 11-01-PLAN.md — Data layer: publish.js named site/metadata params, nostr.js multi-manifest fetch, base36.js utility
- [ ] 11-02-PLAN.md — UI layer: deploy flow root/named selector with dTag/metadata, ManageSite multi-site card list

## Progress

| Phase | Milestone | Plans Complete | Status | Completed |
|-------|-----------|----------------|--------|-----------|
| 1. Monorepo and Build Infrastructure | v1.0 | 3/3 | Complete | 2026-03-13 |
| 2. Relay | v1.0 | 2/2 | Complete | 2026-03-13 |
| 3. Blossom | v1.0 | 3/3 | Complete | 2026-03-14 |
| 4. Gateway Routing Layer | v1.0 | 1/1 | Complete | 2026-03-14 |
| 5. nsite Resolver and Progressive Caching | v1.0 | 4/4 | Complete | 2026-03-14 |
| 6. SPA Deploy Interface | v1.0 | 5/5 | Complete | 2026-03-18 |
| 7. Deploy UX Improvements | v1.1 | 2/2 | Complete | 2026-03-20 |
| 8. Anonymous Key Management | v1.1 | 2/2 | Complete | 2026-03-20 |
| 9. Site Management | v1.1 | 2/2 | Complete | 2026-03-20 |
| 10. Gateway Named Site Encoding | v1.2 | 2/2 | Complete | 2026-03-21 |
| 11. SPA Named Site Support | v1.2 | 0/2 | Not started | - |
