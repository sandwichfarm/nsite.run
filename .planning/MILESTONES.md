# Milestones

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
