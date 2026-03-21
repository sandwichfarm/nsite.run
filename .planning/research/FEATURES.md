# Feature Research

**Domain:** Decentralized static website gateway (nsite / Nostr + Blossom)
**Researched:** 2026-03-13
**Confidence:** HIGH — primary sources are the reference implementation (nsyte/src/lib/gateway.ts), the nsite NIP spec, and PROJECT.md requirements

---

## Feature Landscape

### Table Stakes (Users Expect These)

Features users assume exist. Missing these = product feels incomplete.

| Feature | Why Expected | Complexity | Notes |
|---------|--------------|------------|-------|
| npub subdomain resolution (`npub1xxx.nsite.run`) | Core nsite spec — all gateways do this | MEDIUM | Extract pubkey from hostname, resolve 10002 relay list, query kind 15128 |
| Named site subdomain resolution (`blog.npub1xxx.nsite.run`) | Core nsite spec — required for multi-site pubkeys | MEDIUM | Same as above with `#d` tag filter, kind 35128 |
| Manifest resolution (kinds 15128/35128) | Required to find which files exist and where blobs are | HIGH | Must handle 10002 outbox relay discovery, `server` tags, 10063 blossom list fallback |
| Blob fetching from blossom servers | Without blobs there is no site content | MEDIUM | Fetch by SHA-256 from manifest `server` hints then 10063 list |
| SHA-256 integrity verification | Content-addressed storage is meaningless without verification | LOW | Compare actual hash of downloaded blob to manifest hash; already in nsyte reference impl |
| Content-Type forwarding | Browsers need correct MIME types to render pages | LOW | Forward from blossom response; derive from path extension as fallback per spec |
| `/index.html` fallback for directory paths | SPA routing convention — `/blog/` must serve `/blog/index.html` | LOW | Spec-required: `path/` → `path/index.html` |
| `/404.html` fallback for missing paths | Standard web convention; spec-required | LOW | Must serve `/404.html` if the requested path is not in the manifest |
| Security headers on all responses | Browser security baseline | LOW | CSP, X-Content-Type-Options, Referrer-Policy, Permissions-Policy — already in nsyte reference |
| Brotli/gzip decompressed content serving | Deployed sites commonly pre-compress assets | MEDIUM | Detect `.br`/`.gz` manifest paths, decompress if client doesn't advertise support; already in nsyte impl |
| Loading page for cold-cache first visit | Without it, users see a blank or stalled browser | MEDIUM | Auto-refresh polling until manifest resolved; show profile name/avatar |
| User profile display on loading page | Makes cold-cache load feel intentional, not broken | LOW | Fetch kind 0 metadata for display name and avatar URL; already in nsyte reference |
| Standard nostr relay (wss://) endpoint | Other tools (nsyte CLI) expect to connect to the relay for publishing | HIGH | WebSocket upgrade routing; accept kinds 15128, 35128, 10002, 10063 per PROJECT.md |
| Standard blossom HTTP endpoints | nsyte CLI and other tools need `/upload`, `/{sha256}`, `/list` endpoints | HIGH | BUD-01/BUD-02 compliance; only nsite-referenced blobs per PROJECT.md |
| SPA at root domain for deployment | Makes the gateway self-service; root domain would otherwise be unused | HIGH | Svelte SPA; NIP-07 + NIP-46 auth; folder/zip/tar.gz upload |
| NIP-07 browser extension auth in SPA | Most nostr power users have a browser extension signer | LOW | window.nostr API; widely supported by Alby, nos2x, etc. |
| NIP-46 bunker auth in SPA | Hardware signers and remote signers use NIP-46; nsyte itself uses it | MEDIUM | bunker:// URL parsing and relay-based signing flow |
| File list preview before upload | Without confirmation, accidental uploads happen | LOW | Show filenames + sizes before signing and publishing |

### Differentiators (Competitive Advantage)

Features that set the product apart. Not required, but valued.

| Feature | Value Proposition | Complexity | Notes |
|---------|-------------------|------------|-------|
| Progressive caching (cold/warm-outdated/warm-current) | Serve cached sites instantly; check for updates without blocking | HIGH | Three-state model: no cache → loading page; cached+stale → serve immediately + background check + update banner; cached+current → serve immediately + background check that finds nothing. The reference impl (nsyte/src/lib/gateway.ts) is the direct blueprint |
| Update banner injection into served HTML | Users see updates are available without auto-reload disturbing them | MEDIUM | Inject `<div>` with "update available, click to refresh" link into HTML responses when background check detects a newer manifest event timestamp. Respects site owner content |
| Gateway caches manifests into its own relay | Creates a shared public cache that benefits other gateways and nsyte CLI | MEDIUM | When the gateway fetches and resolves a manifest, it republishes to its own relay. Makes `wss://nsite.run` a useful discovery relay for the ecosystem |
| Gateway caches fetched blobs into its own blossom | Creates a CDN-like distribution point for nsite content | MEDIUM | After downloading a blob from a user's server, re-host it at `https://nsite.run`. Other gateways can then pull from here |
| Secret scanning on SPA uploads | Prevents users from accidentally publishing private keys, API tokens, `.env` files | MEDIUM | Check filenames (`.env`, `id_rsa`, `*.pem`) and file content against regex patterns for common secret formats. Warn + block on match |
| Educational content about nsites | Lowers barrier to entry; nsite.run already has this content to incorporate | LOW | Sections: what is an nsite, how to deploy, links to other gateways/tools; already authored in ~/Develop/nsite.run |
| Links to ecosystem gateways in SPA | Creates network effects; not competing but cooperating | LOW | Show nosto.re, nwb.tf, nsite.lol, and others; data already in nsite.run tools-resources.yaml |
| nsyte CLI compatibility (relay + blossom as targets) | nsyte users can point `--relay` and `--server` flags at nsite.run directly | LOW | Flows from standard protocol compliance; no extra implementation needed |
| Named site identifier routing (`blog.npub1xxx.nsite.run`) | Unlocks multi-site pubkeys; not all gateways support this level of subdomain nesting | MEDIUM | Three-part subdomain parsing: `{identifier}.{npub}.{domain}` |

### Anti-Features (Commonly Requested, Often Problematic)

Features that seem good but create problems.

| Feature | Why Requested | Why Problematic | Alternative |
|---------|---------------|-----------------|-------------|
| Auto-refresh on update detection | Users want to always see the latest content | Disrupts user state (scroll position, form data, SPA routes); hostile UX for interactive sites | Inject a non-intrusive update banner with a manual "click to refresh" link instead |
| General-purpose relay (all event kinds) | Seems to make the relay more useful | Storage explosion, operational complexity, dilutes the purpose; this is an nsite-specific relay | Accept only nsite-relevant kinds (15128, 35128, 10002, 10063) |
| General-purpose blossom (all blobs) | Seems to make the blossom more useful | Unbounded storage growth, abuse vector, high operational cost | Only accept blobs referenced by manifests stored in the gateway's own relay |
| Legacy kind 34128 support | Some older sites used this format | Adds code complexity for a deprecated format; spec explicitly marks it legacy | New manifests only (15128/35128); document this clearly |
| Payment gating / quotas | Prevent abuse, recover costs | Creates user accounts and billing complexity; contradicts "open public infrastructure" mission | Free public service with nsite-only scope as natural abuse limiter |
| User accounts / subscriptions | Access control, premium features | Nostr pubkeys ARE the identity; creating a second account system fights the protocol | Use nostr pubkeys directly for ownership/authorization |
| Auto-detect and deploy from GitHub | Convenience for developers | Requires OAuth/GitHub integration, webhooks, complex auth; scope creep | The `nsite-action` GitHub Action already solves this in the ecosystem |
| Site analytics / visitor tracking | Site owners want to know their traffic | Privacy-violating; contradicts censorship-resistance ethos; complex to implement fairly | Out of scope; third-party analytics can be embedded by site owners in their own HTML |

---

## Feature Dependencies

```
[nsite-only relay] ─────────────────────────────────────────────────────┐
    └──enables──> [Gateway manifest caching into relay]                  │
    └──enables──> [nsyte CLI compatibility as target]                    │
                                                                         │
[nsite-only blossom] ────────────────────────────────────────────────────┤
    └──enables──> [Gateway blob caching into blossom]                    │
    └──enables──> [nsyte CLI compatibility as target]                    │
    └──requires──> [SHA-256 integrity verification] (before storing)    │
                                                                         ▼
[Manifest resolution (10002 + 15128/35128)]                   [Routing layer]
    └──requires──> [nsite-only relay] (to query cached events)          │
    └──enables──> [Progressive caching]                                  │
    └──enables──> [npub subdomain serving]                               │
    └──enables──> [Named site serving]                                   │
                                                                         │
[Progressive caching]                                                    │
    └──requires──> [Manifest resolution]                                 │
    └──enables──> [Update banner injection]                              │
    └──enables──> [Cold-cache loading page]                              │
                                                                         │
[Update banner injection]                                                │
    └──requires──> [Progressive caching] (needs "warm-outdated" state)  │
    └──requires──> [Background update check] (needs diff of timestamps) │
                                                                         │
[Cold-cache loading page]                                                │
    └──requires──> [User profile fetch] (kind 0, display name + avatar) │
                                                                         │
[SPA at root]                                                            │
    └──requires──> [Routing layer] (root vs npub subdomain routing)     │
    └──requires──> [NIP-07 auth] OR [NIP-46 auth]                      │
    └──requires──> [nsite-only blossom] (upload target)                 │
    └──requires──> [nsite-only relay] (manifest publish target)         │
    └──enables──> [Secret scanning on uploads]                          │
    └──enables──> [Educational content]                                 │
    └──enables──> [File list preview before upload]                     │
                                                                         │
[Secret scanning on uploads]                                             │
    └──requires──> [SPA at root] (scanning happens client-side on       │
                   file selection, before signing)                       │
```

### Dependency Notes

- **Routing layer is foundational**: All traffic hits one domain (nsite.run). The gateway edge script must route before anything else can work. npub subdomains go to serving logic; root domain goes to SPA; WebSocket upgrades go to relay; blossom paths go to blossom server.
- **Relay and blossom must be functional before gateway**: The gateway caches into them. If they aren't running, the gateway cannot persist manifests or blobs.
- **Progressive caching requires a working manifest resolution layer**: Cache hit/miss logic gates on whether manifests have been seen before.
- **Update banner is purely additive on top of caching**: It only fires when a background check detects a timestamp difference. Does not affect the core serve path.
- **SPA can be built independently of gateway serving logic**: They share the relay and blossom backends but have separate request paths. The SPA can be developed and deployed before the gateway serving is complete.
- **Secret scanning is client-side**: It runs in the browser before files are signed or uploaded, so it does not depend on any server-side component.

---

## MVP Definition

### Launch With (v1)

Minimum viable product — what's needed to validate the concept.

- [ ] **Routing layer** — All traffic enters at nsite.run; routes to relay/blossom/gateway/SPA based on host/path
- [ ] **nsite-only nostr relay** — Accept kinds 15128, 35128, 10002, 10063 at `wss://nsite.run`
- [ ] **nsite-only blossom server** — BUD-01/BUD-02 endpoints at `https://nsite.run`; only nsite-referenced blobs
- [ ] **npub subdomain gateway** — Resolve and serve root sites (`npub1xxx.nsite.run`)
- [ ] **Named site gateway** — Serve named sites (`blog.npub1xxx.nsite.run`)
- [ ] **Progressive caching** — Cold/warm-outdated/warm-current states with loading page
- [ ] **Update banner injection** — Inject into HTML when background check detects newer manifest
- [ ] **SPA deploy UI** — NIP-07 auth; folder/zip/tar.gz upload; file list preview; publishes to relay+blossom
- [ ] **NIP-46 auth in SPA** — Bunker auth for hardware/remote signers
- [ ] **Secret scanning** — Filename + regex content patterns; warn and block before upload
- [ ] **Educational content** — What is an nsite, how to deploy, links to ecosystem tools

### Add After Validation (v1.x)

Features to add once core is working.

- [ ] **Gateway caches manifests into relay** — Trigger: relay is live and gateway is serving sites; add re-publish step on manifest fetch
- [ ] **Gateway caches blobs into blossom** — Trigger: blossom is live and gateway is fetching blobs; add re-host step on blob download
- [ ] **Profile display on loading page** — Trigger: cold-cache UX complaints; adds kind 0 fetch to loading page render

### Future Consideration (v2+)

Features to defer until product-market fit is established.

- [ ] **Pull zone edge rules for routing** — Cost optimization: replace gateway-as-router with Bunny pull zone rules; complex to validate, low urgency at launch
- [ ] **Ecosystem gateway listing refresh** — Trigger: nsite ecosystem grows; update SPA links periodically

---

## Feature Prioritization Matrix

| Feature | User Value | Implementation Cost | Priority |
|---------|------------|---------------------|----------|
| Routing layer | HIGH | MEDIUM | P1 |
| nsite-only relay | HIGH | MEDIUM | P1 |
| nsite-only blossom | HIGH | MEDIUM | P1 |
| npub subdomain gateway (core serving) | HIGH | HIGH | P1 |
| Named site gateway | HIGH | LOW (incremental) | P1 |
| Progressive caching | HIGH | HIGH | P1 |
| Cold-cache loading page with profile | HIGH | MEDIUM | P1 |
| Update banner injection | HIGH | MEDIUM | P1 |
| SPA deploy UI (NIP-07 auth) | HIGH | HIGH | P1 |
| NIP-46 auth in SPA | HIGH | MEDIUM | P1 |
| Secret scanning on uploads | HIGH | MEDIUM | P1 |
| Educational content | MEDIUM | LOW | P1 |
| Gateway manifest caching into relay | MEDIUM | LOW | P2 |
| Gateway blob caching into blossom | MEDIUM | LOW | P2 |
| Profile display on loading page | MEDIUM | LOW | P2 |
| Links to ecosystem gateways | LOW | LOW | P2 |
| Pull zone routing optimization | LOW | HIGH | P3 |

**Priority key:**
- P1: Must have for launch
- P2: Should have, add when possible
- P3: Nice to have, future consideration

---

## Competitor Feature Analysis

| Feature | hzrd149/nsite.run | nsyte `run` command | Our Approach |
|---------|----------------------|---------------------|--------------|
| npub subdomain resolution | Yes | Yes (localhost only) | Yes — wildcard subdomain on nsite.run |
| Named site support | Unknown | Yes | Yes |
| Progressive caching | Unknown — no public implementation details | Yes — cold/warm states with disk cache | Yes — full three-state model |
| Update banner | Not found | Not present (no banner, just refresh header) | Yes — injected banner, manual click |
| Built-in relay | No (external relay required) | No (uses external relays) | Yes — nsite-only relay bundled |
| Built-in blossom | No (external blossom required) | No (uses external blossom servers) | Yes — nsite-only blossom bundled |
| Deploy SPA | No | No (CLI only) | Yes — web UI with NIP-07 + NIP-46 |
| Secret scanning | No | No | Yes — differentiator |
| Tor/I2P proxy | Yes (hzrd149) | No | Out of scope for v1 |
| Educational content | No | No | Yes — from nsite.run |
| Ecosystem relay (public caching) | No | No | Yes — via manifest re-publish |
| SHA-256 integrity verification | Likely (blossom BUD-01) | Yes (explicit in gateway.ts) | Yes |

---

## Sources

- Reference implementation: `/home/sandwich/Develop/nsyte/src/lib/gateway.ts` (HIGH confidence — direct source code)
- Reference implementation: `/home/sandwich/Develop/nsyte/src/commands/run.ts` (HIGH confidence — direct source code)
- nsite spec: `/home/sandwich/Develop/nsyte/nsite-nip.md` (HIGH confidence — authoritative draft NIP)
- Project requirements: `/home/sandwich/Develop/nsite.run/.planning/PROJECT.md` (HIGH confidence — project decisions)
- Existing ecosystem content: `/home/sandwich/Develop/nsite.run/src/lib/tools-resources.yaml` (HIGH confidence — curated ecosystem list)
- hzrd149/nsite.run: https://github.com/hzrd149/nsite.run (MEDIUM confidence — WebFetch, feature list sparse)
- Awesome-nsite: https://github.com/nostrver-se/awesome-nsite (MEDIUM confidence — ecosystem overview)
- NIP-46 spec: https://github.com/nostr-protocol/nips/blob/master/46.md (HIGH confidence — official NIP)
- NIP PR #1538: https://github.com/nostr-protocol/nips/pull/1538 (MEDIUM confidence — ongoing spec work)

---
*Feature research for: nsite gateway (decentralized static website serving via Nostr + Blossom)*
*Researched: 2026-03-13*
