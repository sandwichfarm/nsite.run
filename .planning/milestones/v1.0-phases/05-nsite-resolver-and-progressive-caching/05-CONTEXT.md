# Phase 5: nsite Resolver and Progressive Caching - Context

**Gathered:** 2026-03-13
**Status:** Ready for planning

<domain>
## Phase Boundary

Resolve npub and named-site subdomains to nsite content and serve files with progressive caching. Three cache states: cold (loading page → resolve → serve), warm-outdated (serve cached + background check → update banner), warm-current (serve immediately). Persist fetched manifests to own relay and blobs to own blossom for ecosystem caching.

</domain>

<decisions>
## Implementation Decisions

### Loading page experience
- Cold-cache shows a minimal centered card with user's avatar, display name, and a spinner/progress text
- Profile data (kind 0) fetched from well-known public relays (e.g., purplepag.es)
- Loading page uses a static HTML template (not inline string) with placeholder replacement for profile data
- Auto-refresh mechanism: Claude's discretion (meta refresh or JS polling — pick simplest for Bunny Edge)
- Loading page auto-refreshes until manifest is resolved and content is ready to serve

### Update banner
- Fixed bar at the top of the viewport, above site content
- Minimal text: "This site has been updated. Click to refresh." — plain text, small font, subtle background
- Dismissible with an X button (small inline JS for close behavior)
- Banner injection strategy: Claude's discretion (prepend to body or append with fixed CSS — pick most reliable)
- Banner includes its own inline CSS so it works regardless of the site's styles

### Relay discovery and resolution
- **Streaming/opportunistic pipeline**: Don't resolve sequentially (find relays → query manifests → fetch blobs). Instead, each piece of data triggers the next hop immediately:
  1. Open parallel subscriptions to own relay + seed relays
  2. As kind 10002 relay lists arrive → immediately open subscriptions to those relays for manifests
  3. As manifests arrive → immediately start fetching blobs from server tags
- **Own relay queries**: Direct Bunny DB (libSQL) queries — no WebSocket hop, lowest latency. The gateway shares the same database as the relay.
- **External relay queries**: Standard NIP-01 WebSocket connections — REQ/EVENT messages. The gateway acts as a nostr client connecting to the user's outbox relays.
- **Seed relays**: Configurable via SEED_RELAYS env var with sensible defaults (e.g., purplepag.es, relay.damus.io)
- **Timeouts**: Claude's discretion — pick reasonable per-hop and total timeouts based on real-world relay latency

### Error handling and edge cases
- **No manifest found**: Friendly 404 page explaining "This nsite doesn't exist yet" with link to nsite.run
- **Path not in manifest**: Serve site's own /404.html if it exists in the manifest, otherwise serve gateway default 404
- **Directory paths**: / → /index.html, /about/ → /about/index.html (standard directory index resolution)
- **Compressed assets**: Serve compressed blobs as-is with Content-Encoding: br/gzip header — browser handles decompression. Detect compression from manifest path (.br, .gz extensions)
- **Security headers**: Standard set on all responses — X-Content-Type-Options: nosniff, X-Frame-Options: DENY, Content-Security-Policy (basic), Strict-Transport-Security

### Cache persistence
- Fetched manifests persisted into gateway's own relay (Bunny DB) — other gateways can query them
- Fetched blobs persisted into gateway's own blossom (Bunny Storage) — other gateways can fetch them
- This enables ecosystem-wide caching: once one gateway resolves a site, others can find it faster

### Claude's Discretion
- Auto-refresh mechanism choice (meta refresh vs JS polling)
- Banner injection point (prepend to body vs append with fixed positioning)
- Timeout values for relay discovery, manifest query, blob fetch
- WebSocket client implementation details for external relay connections
- How to determine if cached manifest is outdated (timestamp comparison, event id comparison)
- Content-Type detection strategy (from blossom metadata, path extension, or manifest hints)
- Exact security header values for CSP that don't break legitimate site functionality

</decisions>

<specifics>
## Specific Ideas

- Resolution pipeline should follow nsyte's approach — streaming/opportunistic, not sequential
- Own relay should be queried via direct DB access, not WebSocket — eliminates a network hop for cached data
- The loading page should feel like a profile preview card, not a heavy splash screen
- Update banner should be as non-intrusive as possible — text link, not a flashy notification

</specifics>

<code_context>
## Existing Code Insights

### Reusable Assets
- `apps/gateway/src/hostname.ts`: `extractNpubAndIdentifier()` returns `SitePointer { kind, npub, identifier? }` — already handles npub and named-site subdomain parsing
- `apps/gateway/src/stubs/resolver.ts`: `handleResolverStub()` — Phase 5 replaces this with live resolution
- `apps/gateway/src/router.ts`: `route()` dispatches to resolver for subdomain requests — Phase 5 replaces the stub import
- `@nsite/shared/sha256`: `sha256Hex()` for blob integrity verification
- `@nsite/shared/types`: `NostrEvent`, `NostrFilter`, `NsiteKind` — used for manifest events
- `@nsite/shared/constants`: `ALLOWED_KINDS` — manifest kinds (15128, 35128)
- `apps/relay/src/db.ts`: Database query functions — gateway can import these for direct DB queries

### Established Patterns
- `export default { fetch }` entry point for all Edge Scripts
- esbuild bundling with denoPlugins
- nostr-tools for event verification (`@nostr/tools/pure`)
- Bunny DB (libSQL) via `@libsql/client/web` (relay pattern)
- Bunny Storage REST API (blossom pattern)

### Integration Points
- `apps/gateway/src/router.ts` line 54: `handleResolverStub(request, sitePointer)` — replace with live resolver
- `apps/relay/src/db.ts`: Direct DB access for own-relay queries (shared Bunny DB)
- `apps/blossom/src/storage/client.ts`: StorageClient pattern for persisting blobs to own blossom
- Bunny DB connection: same libSQL database used by relay, accessible from gateway edge script

</code_context>

<deferred>
## Deferred Ideas

- ETag / If-None-Match for 304 responses — v2 optimization (OPT-02)
- Pull zone edge rules for routing optimization — v2 (OPT-01)
- Profile caching into own relay (kind 0) — nice-to-have, not in current requirements

</deferred>

---

*Phase: 05-nsite-resolver-and-progressive-caching*
*Context gathered: 2026-03-13*
