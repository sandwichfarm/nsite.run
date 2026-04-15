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

- ✓ Deploy zone rejects multi-file drag and prompts for folder or archive — v1.1
- ✓ File preview in deploy tree (inline with pagination) — v1.1
- ✓ Per-file exclude/include toggle in deploy tree with ignored summary — v1.1
- ✓ Anonymous key persists in sessionStorage across navigation/reload — v1.1
- ✓ Logout confirmation warns anonymous users to back up nsec — v1.1
- ✓ nsec backup via file download (not just clipboard copy) — v1.1
- ✓ Update button after successful deploy returns to file drop zone — v1.1
- ✓ Returning logged-in user sees existing site info (URL, last publish, file count) — v1.1
- ✓ Delete/destroy publishes empty manifest + kind 5 to relays, DELETEs blobs from blossoms — v1.1

- ✓ Gateway parses named site subdomains using base36 encoding — v1.2
- ✓ Gateway resolves named site manifests (kind 35128) via decoded base36 pubkey and dTag — v1.2
- ✓ Gateway removes old double-wildcard named site format — v1.2
- ✓ User can choose root site (15128) or named site (35128) in deploy flow — v1.2
- ✓ User provides dTag identifier when deploying named site — v1.2
- ✓ Named site manifest published as kind 35128 with d tag — v1.2
- ✓ User can set title and description for their site (manifest tags) — v1.2
- ✓ Manage tab shows all user's sites (root + named) with switching — v1.2

- ✓ Edge scripts run locally with Bunny.v1.serve() polyfill — v1.3
- ✓ Relay uses local SQLite for dev, blossom uses local filesystem — v1.3
- ✓ Gateway routes to local relay/blossom matching prod architecture — v1.3
- ✓ Root dev command starts all services + SPA concurrently — v1.3
- ✓ SPA auto-configured to point at local gateway — v1.3
- ✓ Browser beforeunload guard during in-progress deploy/delete — v1.4
- ✓ OperationBanner shows background operation status across tabs — v1.4
- ✓ Per-card delete state machine with inline progress and animated exit — v1.4
- ✓ Post-action navigation: "Manage sites" / "Deploy another" on success, "Deploy new site" in manage view — v1.4
- ✓ Tab buttons disabled during active operations — v1.4
- ✓ Deploy guards: amber warnings for existing root/named sites with "Update" shortcut — v1.4
- ✓ Deploy blocked with "Checking existing sites..." while loading — v1.4

- ✓ @nsite/deployer npm workspace package with exports map and dual Vite build configs — v1.5 (Phase 17)
- ✓ Core lib extraction: nostr, upload, publish, crypto, files, store, scanner, base36 in packages/deployer — v1.5 (Phase 18)
- ✓ DeployerWidget.svelte orchestrator component with signer prop, typed events, CSS custom properties — v1.5 (Phase 19)
- ✓ NsiteDeployerElement web component with shadow DOM, trigger button, modal overlay, composed event bridge — v1.5 (Phase 20)
- ✓ IIFE+ESM bundles: single script tag loads <nsite-deployer> custom element with full deploy flow — v1.5 (Phase 20)

### Active

(Defined in REQUIREMENTS.md for v1.5)

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

Shipped v1.4 Deploy Safety. v1.5 Deployer Component Phase 20 complete -- web component and IIFE bundle delivered. Five milestones shipped (v1.0 MVP, v1.1 Feature Gaps, v1.2 Named Sites, v1.3 Local Dev, v1.4 Deploy Safety). v1.5 Deployer Component in progress (Phases 17-20 complete).

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
- `title` tag: optional site title
- `description` tag: optional site description
- `source` tag: optional link to source code
- Resolution: fetch user's 10002 relay list, query manifest, fetch blobs from manifest's server tags or user's 10063 blossom server list

Named site subdomain encoding (updated spec):
- Single subdomain label: `<pubkeyB36><dTag>` (no separator)
- pubkeyB36: raw 32-byte pubkey, base36 lowercase (50 chars)
- dTag: `^[a-z0-9]{1,13}$` (1-13 chars, total label max 63)
- Detection: label length 51-63, all `[a-z0-9]`, first 50 chars decode to valid 32-byte pubkey
- Old format (`identifier.npub1xxx.nsite.run`) deprecated — SSL certs can't do double wildcards

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
| Base36 named site encoding | SSL certs can't do double wildcards; single subdomain label fits *.nsite.run cert | ✓ Good — 50-char pubkey + 1-13 char dTag |
| Kind 5 only for deletion (no empty manifest) | Empty manifest creates lingering event; kind 5 tells relays to actually remove | ✓ Good — cleaner deletion |
| Per-card delete state Map | Card list always visible during deletion; concurrent deletes supported via Map<siteId, state> | ✓ Good — clean per-card overlays |
| CSS-only exit animation (no Svelte transitions) | Svelte 4 animate:flip + out:fade conflict (#4910); CSS fade+collapse avoids the bug | ✓ Good — smooth 800ms two-phase exit |
| Reactive beforeunload (not onMount) | Chrome treats onMount-attached beforeunload as permanently dirty page | ✓ Good — no false positives |
| One auth event per blob upload | Batch auth caused all blobs written to first hash's path — critical corruption bug | ✓ Good — matches per-blob delete auth pattern |
| Gateway dev shares relay DB | Production shares Bunny DB; dev must mirror this or gateway can't find manifests | ✓ Good — resolves local dev 404s |

## Current Milestone: v1.5 Deployer Component

**Goal:** Extract the deployer from the SPA into a standalone Svelte component (`packages/deployer`) and a Web Component bundle for ad-hoc embedding, then refactor the SPA to consume the component.

**Target features:**
- Svelte component with full deploy + manage + update flow, importable into other Svelte projects
- Web Component bundle (IIFE + ESM) with button→modal UX for embedding in nsites (like @nsite/stealthis)
- Optional signer prop — accepts external signer or shows built-in auth flow (NIP-07, NIP-46, anonymous)
- SPA refactored to consume @nsite/deployer as single source of truth
- Core lib layer (nostr, upload, publish, crypto, files) extracted into packages/deployer

## Evolution

This document evolves at phase transitions and milestone boundaries.

**After each phase transition** (via `/gsd:transition`):
1. Requirements invalidated? → Move to Out of Scope with reason
2. Requirements validated? → Move to Validated with phase reference
3. New requirements emerged? → Add to Active
4. Decisions to log? → Add to Key Decisions
5. "What This Is" still accurate? → Update if drifted

**After each milestone** (via `/gsd:complete-milestone`):
1. Full review of all sections
2. Core Value check — still the right priority?
3. Audit Out of Scope — reasons still valid?
4. Update Context with current state

---
*Last updated: 2026-03-25 after Phase 20 (Web Component and IIFE Bundle) completed*
