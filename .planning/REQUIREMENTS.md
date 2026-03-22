# Requirements: nsite.run

**Defined:** 2026-03-21
**Core Value:** Provide reliable, always-available nsite infrastructure that serves sites fast via progressive caching while making the relay and blossom accessible to the broader nsite ecosystem.

## v1.3 Requirements

Requirements for v1.3 Local Dev release. Each maps to roadmap phases.

### Local Dev Harness

- [x] **DEV-01**: Each edge script (relay, blossom, gateway) can run locally as a Deno HTTP server with a `Bunny.v1.serve()` polyfill
- [x] **DEV-02**: Relay uses local SQLite file for event storage instead of Bunny DB (libSQL)
- [x] **DEV-03**: Blossom uses local filesystem directory for blob storage instead of Bunny Storage
- [x] **DEV-04**: Gateway routes to local relay and blossom instances, matching production routing architecture

### Dev Command

- [ ] **DEV-05**: A root `deno task dev` command starts all services (relay, blossom, gateway) + SPA concurrently with colored output
- [x] **DEV-06**: SPA dev server auto-configured to point at local gateway (no manual env vars needed)
- [ ] **DEV-07**: All services stop cleanly on Ctrl+C

## Future Requirements

Deferred from earlier milestones.

### Optimization

- **OPT-01**: Pull zone edge rules replace gateway-as-router for cheaper traffic routing
- **OPT-02**: ETag / If-None-Match support for 304 Not Modified responses

### Ecosystem

- **ECO-01**: NIP-05 identity verification for hosted sites
- **ECO-02**: Custom domain support via DNS TXT records

## Out of Scope

| Feature | Reason |
|---------|--------|
| Docker containerization | Deno + local SQLite/filesystem is sufficient for dev |
| Hot module reload for edge scripts | Standard Deno file watching is sufficient |
| Production deployment from dev command | Separate CI/CD workflow exists |

## Traceability

| Requirement | Phase | Status |
|-------------|-------|--------|
| DEV-01 | Phase 12 | Complete |
| DEV-02 | Phase 12 | Complete |
| DEV-03 | Phase 12 | Complete |
| DEV-04 | Phase 12 | Complete |
| DEV-05 | Phase 12 | Pending |
| DEV-06 | Phase 12 | Complete |
| DEV-07 | Phase 12 | Pending |

**Coverage:**
- v1.3 requirements: 7 total
- Mapped to phases: 7
- Unmapped: 0

---
*Requirements defined: 2026-03-21*
