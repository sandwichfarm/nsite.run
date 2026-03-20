# Requirements: nsite.run

**Defined:** 2026-03-20
**Core Value:** Provide reliable, always-available nsite infrastructure that serves sites fast via progressive caching while making the relay and blossom accessible to the broader nsite ecosystem.

## v1.1 Requirements

Requirements for v1.1 Feature Gaps release. Each maps to roadmap phases.

### Deploy UX

- [ ] **DPLX-01**: Deploy zone rejects multi-file drag and shows message to use folder or archive
- [ ] **DPLX-02**: User can click a file in the deploy tree to preview its contents inline or in a modal
- [ ] **DPLX-03**: User can exclude/include individual files via hover toggle in deploy tree, with excluded files collected in an ignored summary section

### Anonymous Key Management

- [ ] **AKEY-01**: Anonymous key persists in session store across navigation and page reload, with coherent UI showing current nsite
- [ ] **AKEY-02**: Logout prompts confirmation dialog ensuring anonymous user has backed up nsec before clearing key
- [ ] **AKEY-03**: User can download nsec as a text file as first backup option, with clipboard copy as secondary

### Site Management

- [ ] **SITE-01**: After successful deploy, an "Update Site" button returns user to file drop zone with same key
- [ ] **SITE-02**: Returning logged-in user sees existing site info on load (site URL, last publish date, file count/size, quick links)
- [ ] **SITE-03**: User can delete/destroy a published site via confirmation dialog that publishes empty/tombstone manifest

## Future Requirements

Deferred from v1.0 to later releases.

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
| Payment gating | Contradicts open public infrastructure mission |
| User accounts / subscriptions | Nostr pubkeys are the identity layer |
| ncryptsec download | Requires complex UX for password management; defer to future |
| Mobile app | Web SPA sufficient |

## Traceability

Which phases cover which requirements. Updated during roadmap creation.

| Requirement | Phase | Status |
|-------------|-------|--------|
| DPLX-01 | Phase 7 | Pending |
| DPLX-02 | Phase 7 | Pending |
| DPLX-03 | Phase 7 | Pending |
| AKEY-01 | Phase 8 | Pending |
| AKEY-02 | Phase 8 | Pending |
| AKEY-03 | Phase 8 | Pending |
| SITE-01 | Phase 9 | Pending |
| SITE-02 | Phase 9 | Pending |
| SITE-03 | Phase 9 | Pending |

**Coverage:**
- v1.1 requirements: 9 total
- Mapped to phases: 9
- Unmapped: 0

---
*Requirements defined: 2026-03-20*
*Last updated: 2026-03-20 after milestone v1.1 definition*
