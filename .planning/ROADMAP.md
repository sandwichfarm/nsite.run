# Roadmap: nsite.run

## Milestones

- ✅ **v1.0 MVP** — Phases 1-6 (shipped 2026-03-20)
- ✅ **v1.1 Feature Gaps** — Phases 7-9 (shipped 2026-03-20)
- ✅ **v1.2 Named Sites** — Phases 10-11 (shipped 2026-03-21)
- 🚧 **v1.3 Local Dev** — Phase 12 (in progress)

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

<details>
<summary>✅ v1.2 Named Sites (Phases 10-11) — SHIPPED 2026-03-21</summary>

- [x] Phase 10: Gateway Named Site Encoding (2/2 plans) — completed 2026-03-21
- [x] Phase 11: SPA Named Site Support (2/2 plans) — completed 2026-03-21

</details>

### 🚧 v1.3 Local Dev (In Progress)

**Milestone Goal:** Enable local development and testing of all edge scripts with a single command, matching production routing architecture.

- [ ] **Phase 12: Local Development Harness** — Bunny.v1.serve() polyfill, local SQLite/filesystem backends, gateway proxying to local services, root dev command with concurrently

## Phase Details

### Phase 12: Local Development Harness
**Goal**: Developers can run the full nsite.run stack locally with a single command, using local storage backends that mirror production routing architecture
**Depends on**: Phase 11
**Requirements**: DEV-01, DEV-02, DEV-03, DEV-04, DEV-05, DEV-06, DEV-07
**Success Criteria** (what must be TRUE):
  1. Developer runs `deno task dev` from the repo root and all four services (relay, blossom, gateway, SPA) start with colored per-service output
  2. Edge scripts (relay, blossom, gateway) execute locally via a `Bunny.v1.serve()` polyfill with no Bunny platform dependency
  3. The local relay stores events in a SQLite file and the local blossom stores blobs in a filesystem directory — both readable on disk after operations
  4. The local gateway routes requests to local relay and blossom instances using the same routing logic as production (WebSocket → relay, blossom endpoints → blossom, subdomain → resolver, root → SPA)
  5. Pressing Ctrl+C terminates all services cleanly with no orphaned processes, and the SPA dev server connects to the local gateway without manual configuration
**Plans**: 3 plans

Plans:
- [ ] 12-01-PLAN.md — LocalStorageClient, relay and blossom dev entrypoints
- [ ] 12-02-PLAN.md — Gateway dev entrypoint and SPA env configuration
- [ ] 12-03-PLAN.md — Root dev orchestrator and deno task dev

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
| 11. SPA Named Site Support | v1.2 | 2/2 | Complete | 2026-03-21 |
| 12. Local Development Harness | v1.3 | 0/3 | In progress | - |
