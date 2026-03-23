# Milestones

## v1.2 Named Sites (Shipped: 2026-03-21)

**Phases completed:** 2 phases, 4 plans, 2 tasks

**Key accomplishments:**

- Gateway: base36 single-label encoding for named site subdomains (50-char pubkey + 1-13 char dTag), replacing deprecated double-wildcard format
- Shared package: hand-rolled base36 codec (encode/decode 32-byte pubkeys ↔ 50-char base36 strings)
- SPA deploy: root/named site radio selector with inline dTag validation, title + description metadata fields on manifest events
- SPA manage: multi-site card list showing root + all named sites, per-site Update (pre-fills form) and Delete (NIP-09 kind 5)
- Manifest publishing: kind 35128 support with d tag, title/description tags, backward-compatible options object API

**Stats:** 14,680 LOC (+1,042) | 8 feature commits | 9 requirements

---

## v1.1 Feature Gaps (Shipped: 2026-03-20)

**Phases completed:** 3 phases, 6 plans, 0 tasks

**Key accomplishments:**

- Deploy UX: multi-file drag rejection, inline file preview with 100-line pagination, per-file exclude toggle with recursive directory support and ignored summary
- Anonymous key management: sessionStorage persistence with auto-restore, logout confirmation modal with backup enforcement, nsec file download
- Site management: "Update Site" button preserving signer/key, returning user site info card (URL, date, file count) via multi-relay manifest query, decentralized site deletion (empty manifest + kind 5 to relays, BUD-02 DELETE to blossoms)

**Stats:** 13,638 LOC (+1,089) | 13 feature commits | 9 requirements | Addresses GitHub issues #6-#13

---

## v1.0 MVP (Shipped: 2026-03-20)

**Phases completed:** 6 phases, 18 plans, 0 tasks

**Key accomplishments:**

- Deno monorepo with shared types, esbuild bundling, CI/CD to Bunny Edge Scripting
- NIP-01 nostr relay (kinds 15128/35128/10002/10063) with libSQL event store — 113KB bundle
- BUD-01/02 blossom server with Bunny Storage, kind 24242 auth — 50KB bundle
- Gateway router dispatching WebSocket/blossom/resolver/SPA via host-header priority
- Three-state progressive caching resolver (cold/warm-outdated/warm-current) with banner injection — 130KB bundle
- Svelte SPA deploy interface with NIP-07/NIP-46 auth, secret scanning, drag-drop upload

**Stats:** 12,549 LOC | 140 files | 58 requirements | Deno TypeScript + Svelte

---
