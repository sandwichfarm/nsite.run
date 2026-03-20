# nsite.run

## What This Is

A complete nsite hosting stack running on Bunny infrastructure at nsite.run. It provides a nostr relay (nsite events only), a blossom server (file storage), an nsite gateway (site serving with progressive caching), and a Svelte SPA for deploying nsites — all as a unified, publicly accessible service. The relay and blossom use standard protocols so other gateways and tools (like nsyte) can leverage this infrastructure.

## Core Value

Provide reliable, always-available nsite infrastructure that serves sites fast via progressive caching while making the relay and blossom accessible to the broader nsite ecosystem.

## Requirements

### Validated

- ✓ Gateway resolves npub subdomains (npub1xxx.nsite.run) and serves nsite content — v1.0
- ✓ Gateway serves named sites via identifier subdomains (blog.npub1xxx.nsite.run) — v1.0
- ✓ Progressive caching: cold cache shows loading page, resolves manifest, persists to relay — v1.0
- ✓ Progressive caching: warm outdated cache serves immediately, checks background, injects update banner — v1.0
- ✓ Progressive caching: warm current cache serves immediately, background check finds nothing — v1.0
- ✓ Update banner is injected into served HTML with manual "click to refresh" link — v1.0
- ✓ nsite-only nostr relay accepts/serves kinds 15128, 35128, 10002, 10063 — v1.0
- ✓ Relay accessible at wss://nsite.run (via gateway routing) — v1.0
- ✓ nsite-only blossom server stores blobs referenced in nsite manifests — v1.0
- ✓ Blossom accessible at https://nsite.run blossom endpoints — v1.0
- ✓ Gateway caches fetched blobs into its own blossom (so other gateways can resolve from it) — v1.0
- ✓ Gateway caches manifests into its own relay (so other gateways can query it) — v1.0
- ✓ Edge script routing: gateway receives all traffic, routes to relay/blossom internally — v1.0
- ✓ SPA at nsite.run root allows users to deploy an nsite via folder/zip/tar.gz upload — v1.0
- ✓ SPA shows file list for user confirmation before upload — v1.0
- ✓ SPA scans uploads for secrets (dangerous filenames + regex content patterns), warns and rejects — v1.0
- ✓ SPA supports NIP-07 (browser extension) authentication — v1.0
- ✓ SPA supports NIP-46 (Nostr Connect / bunker) authentication — v1.0
- ✓ SPA educates users about nsites, links to other gateways (content from nsite.run) — v1.0
- ✓ Compatible with nsyte CLI — relay and blossom can be used as targets — v1.0
- ✓ Loading page shows user profile (display name, avatar) while resolving cold cache — v1.0

### Active

- [x] Deploy zone rejects multi-file drag and prompts for folder or archive — v1.1 Phase 7
- [x] File preview in deploy tree (inline or modal) — v1.1 Phase 7
- [x] Per-file exclude/include toggle in deploy tree with ignored summary — v1.1 Phase 7
- [ ] Anonymous key persists in session store across navigation/reload
- [ ] Logout confirmation warns anonymous users to back up nsec
- [ ] nsec backup via file download (not just clipboard copy)
- [ ] Update button after successful deploy returns to file drop zone
- [ ] Returning logged-in user sees existing site info (URL, last publish, file count)
- [ ] Delete/destroy button publishes empty manifest and confirms removal

## Current Milestone: v1.1 Feature Gaps

**Goal:** Close UX gaps in the deploy SPA identified from initial user feedback — improve file handling, protect anonymous users from key loss, and add site management actions.

**Target features:**
- Deploy UX: reject loose file drops, file preview, per-file exclude
- Anonymous key management: session persistence, logout confirmation, file download backup
- Site management: update button, returning user dashboard, site deletion

### Out of Scope

- Legacy kind 34128 support — new manifest kinds only (15128/35128)
- General-purpose relay — only nsite-related event kinds
- General-purpose blossom — only nsite-referenced blobs
- Auto-refresh on update detection — manual banner link only
- Mobile app — web SPA only
- Payment gating — free public infrastructure
- User accounts / subscriptions — open access

## Context

### Current State

Shipped v1.0 with 12,549 LOC across TypeScript (Deno) and Svelte.

Tech stack: Deno TypeScript, esbuild, Bunny Edge Scripting, Bunny DB (libSQL), Bunny Storage, Svelte 4, Vite 5, Tailwind CSS 3.

Architecture: monorepo with `apps/relay`, `apps/blossom`, `apps/gateway`, `apps/spa`, `packages/shared`. Gateway bundle 130KB, relay 113KB, blossom 50KB — all well under 1MB Edge Script limit.

### Existing Ecosystem

- **nsyte** (~/Develop/nsyte): Deno CLI tool for deploying nsites
- **nostr.pub** (~/Develop/nostr.pub): Reference relay on Bunny — architecture template for relay component
- **blssm.us** (~/Develop/blssm.us): Reference blossom on Bunny — architecture template for blossom component

### nsite Spec

Site manifests are nostr events:
- Kind 15128: Root site manifest (replaceable, no d tag)
- Kind 35128: Named site manifest (addressable, d tag = identifier)
- `path` tags map absolute paths to SHA-256 hashes
- `server` tags hint at blossom servers
- Resolution: fetch user's 10002 relay list, query manifest, fetch blobs from manifest's server tags or user's 10063 blossom server list

### Bunny Infrastructure

- **Edge Scripting**: TypeScript/Deno code running at CDN edge via BunnySDK
- **Bunny DB**: libSQL-compatible database (relay event storage)
- **Bunny Storage**: REST API blob storage (blossom blob persistence)
- **Pull Zones**: CDN distribution with WebSocket support

### Routing Architecture

All traffic hits nsite.run. The gateway Edge Script acts as the primary router:
- Root domain (no npub subdomain) → SPA (served from Bunny CDN Storage)
- npub subdomains → nsite resolver (progressive caching)
- WebSocket upgrade → relay
- Blossom endpoints (/upload, /{sha256}) → blossom

## Constraints

- **Platform**: Bunny Edge Scripting (BunnySDK, esbuild bundle <1MB per script)
- **Stack**: Deno TypeScript, consistent with nostr.pub and blssm.us
- **Repo**: Monorepo with shared types/libs (apps/relay, apps/blossom, apps/gateway, apps/spa, packages/shared)
- **Domain**: nsite.run (wildcard subdomain for npub resolution)
- **Protocol**: Must use standard nostr relay and blossom protocols — not proprietary APIs
- **SPA**: Svelte (consistent with existing nsite.run)

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| Separate Edge Scripts for relay/blossom/gateway | Separation of concerns, independent scaling, code reuse from existing projects | ✓ Good — clean boundaries, small bundles |
| Gateway-as-router (initial) | Known to work on Bunny; research pull zone rules later for cost optimization | ✓ Good — works, pull zone rules deferred to v2 |
| Monorepo | Shared types between relay, blossom, gateway, and SPA; single CI/CD | ✓ Good — shared package avoids duplication |
| nsite-only relay and blossom | Focused scope, controlled storage growth, purpose-built infrastructure | ✓ Good — keeps scope tight |
| Cache into own relay + blossom (not private storage) | Other gateways and tools can leverage this infrastructure via standard protocols | ✓ Good — ecosystem benefit confirmed |
| New manifest kinds only (15128/35128) | Simpler implementation, spec is moving forward, no legacy baggage | ✓ Good — cleaner code |
| Svelte SPA | Consistent with existing nsite.run, can incorporate its educational content | ✓ Good — reused educational content |
| NIP-07 + NIP-46 auth | Maximum signer compatibility for the deploy SPA | ✓ Good — covers major signer types |
| SPA served from Bunny CDN Storage (not inlined) | Avoids gateway bundle size bloat; SPA assets proxy via SPA_ASSETS_URL | ✓ Good — gateway stays at 130KB |
| Gateway db.ts duplicates relay code | Edge Scripts have independent module graphs; no cross-package imports | ✓ Good — avoids import complexity |
| 120s symmetric auth window for blossom | Stricter than reference (blssm.us); rejects created_at >120s in past or future | ✓ Good — tighter security |

---
*Last updated: 2026-03-20 after Phase 7 completion*
