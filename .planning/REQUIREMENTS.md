# Requirements: nsite.run

**Defined:** 2026-03-21
**Core Value:** Provide reliable, always-available nsite infrastructure that serves sites fast via progressive caching while making the relay and blossom accessible to the broader nsite ecosystem.

## v1.2 Requirements

Requirements for v1.2 Named Sites release. Each maps to roadmap phases.

### Gateway

- [x] **GATE-13**: Gateway parses named site subdomains using base36 encoding — single label `<pubkeyB36><dTag>` where pubkeyB36 is 50 chars and dTag is 1-13 chars of `[a-z0-9]`
- [x] **GATE-14**: Gateway resolves named site manifests by querying kind 35128 with decoded pubkey and `#d` filter for the extracted dTag
- [x] **GATE-15**: Gateway removes old double-wildcard named site format (`identifier.npub1xxx.nsite.run`) — replaced by new single-label encoding

### SPA Deploy

- [ ] **SPA-14**: User can choose between deploying a root site (kind 15128) or a named site (kind 35128) in the deploy flow
- [ ] **SPA-15**: When deploying a named site, user provides a dTag identifier validated as `^[a-z0-9]{1,13}$`
- [x] **SPA-16**: Named site manifest is published as kind 35128 with the dTag as `d` tag

### SPA Metadata

- [x] **SPA-17**: User can set a title for their site (added as `title` tag on manifest event)
- [x] **SPA-18**: User can set a description for their site (added as `description` tag on manifest event)

### SPA Management

- [ ] **SPA-19**: Manage tab shows all user's sites (root + named) with ability to switch between them for update/delete

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
| Legacy kind 34128 support | Deprecated format; new manifests only (15128/35128) |
| General-purpose relay | Storage explosion, operational complexity; nsite-only |
| General-purpose blossom | Unbounded storage growth, abuse vector; nsite-only |
| Auto-refresh on update | Disrupts user state; manual banner link instead |
| Old double-wildcard named sites | SSL certs can't do `*.*.nsite.run`; replaced by base36 encoding |

## Traceability

Which phases cover which requirements. Updated during roadmap creation.

| Requirement | Phase | Status |
|-------------|-------|--------|
| GATE-13 | Phase 10 | Complete |
| GATE-14 | Phase 10 | Complete |
| GATE-15 | Phase 10 | Complete |
| SPA-14 | Phase 11 | Pending |
| SPA-15 | Phase 11 | Pending |
| SPA-16 | Phase 11 | Complete |
| SPA-17 | Phase 11 | Complete |
| SPA-18 | Phase 11 | Complete |
| SPA-19 | Phase 11 | Pending |

**Coverage:**
- v1.2 requirements: 9 total
- Mapped to phases: 9
- Unmapped: 0

---
*Requirements defined: 2026-03-21*
*Last updated: 2026-03-21 after milestone v1.2 definition*
