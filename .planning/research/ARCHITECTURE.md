# Architecture Research

**Domain:** nsite hosting gateway on Bunny Edge Scripting
**Researched:** 2026-03-13
**Confidence:** HIGH — derived from direct inspection of three working reference implementations (nostr.pub, blssm.us, nsyte) and project constraints.

## Standard Architecture

### System Overview

```
                        nsite.run (wildcard DNS)
                               |
                    ┌──────────┴──────────┐
                    │   Bunny Pull Zone    │  (CDN / WebSocket support)
                    └──────────┬──────────┘
                               |  all traffic
                    ┌──────────▼──────────┐
                    │  packages/gateway   │  Edge Script — primary router
                    │  (main.ts/router.ts)│
                    └──┬────────┬─────────┘
          subdomain?   │        │  WebSocket upgrade? / /upload / /{sha256}?
              ┌────────┘        └──────────────────────────┐
              ▼                                            ▼
   ┌──────────────────┐                       ┌────────────────────┐
   │  nsite resolver  │                       │  internal routing  │
   │  (per request)   │                       │  dispatch          │
   └──────┬───────────┘                       └───┬────────────────┘
          │                                       │
          │  nostr relay queries                  │  WebSocket → relay
          │  blossom blob fetches                 │  HTTP → blossom
          ▼                                       ▼
┌─────────────────────┐              ┌────────────────────────┐
│  packages/relay     │              │   packages/blossom     │
│  Edge Script        │              │   Edge Script          │
│  Bunny DB (libSQL)  │              │   Bunny Storage (REST) │
└─────────────────────┘              └────────────────────────┘
          ▲                                       ▲
          │ cache manifests (standard nostr)      │ cache blobs (standard blossom)
          └─────────────────────────────────────┘
                    (gateway writes back into relay+blossom
                     so the ecosystem can consume them)

   root domain (no npub subdomain):
   ┌─────────────────────────────┐
   │   packages/spa              │
   │   Svelte SPA (static files) │
   │   served from Bunny Storage │
   └─────────────────────────────┘
```

### Component Responsibilities

| Component | Responsibility | Implementation |
|-----------|----------------|----------------|
| **packages/gateway** | Primary router; receives all traffic; resolves npub subdomains; progressive cache logic; inject update banner; serve SPA at root | Bunny Edge Script, TypeScript |
| **packages/relay** | Nostr relay (NIP-01); stores/serves kinds 15128, 35128, 10002, 10063; WebSocket protocol; NIP-11 info doc | Bunny Edge Script + Bunny DB (libSQL via @libsql/client) |
| **packages/blossom** | Blossom server (BUD-01/02/04/06); stores/serves blobs keyed by SHA-256; auth via nostr signed events | Bunny Edge Script + Bunny Storage (REST API) |
| **packages/spa** | Svelte SPA; nsite deploy UI; NIP-07/46 auth; secret scanner; file upload with confirmation; educational content | Svelte, static build deployed to Bunny Storage |

## Recommended Project Structure

```
nsite.run/
├── packages/
│   ├── gateway/           # Bunny Edge Script: router + nsite resolver
│   │   ├── src/
│   │   │   ├── main.ts    # BunnySDK.net.http.serve entry point
│   │   │   ├── router.ts  # Route dispatch: subdomain / WS / blossom / root
│   │   │   ├── resolver/
│   │   │   │   ├── manifest.ts      # Fetch kind 15128/35128 from relay
│   │   │   │   ├── cache.ts         # Progressive cache state machine
│   │   │   │   └── loader.ts        # Loading page HTML generation
│   │   │   ├── serve/
│   │   │   │   ├── file.ts          # Resolve path → SHA-256 → blob fetch
│   │   │   │   └── banner.ts        # Update banner HTML injection
│   │   │   └── relay-client.ts      # Internal fetch to packages/relay
│   │   ├── build.ts       # esbuild config
│   │   └── package.json
│   ├── relay/             # Bunny Edge Script: nostr relay
│   │   ├── src/
│   │   │   ├── main.ts    # BunnySDK.net.http.serve entry point
│   │   │   ├── router.ts  # WS upgrade, NIP-11, health
│   │   │   ├── relay/
│   │   │   │   ├── connection.ts    # WebSocket handler (NIP-01 messages)
│   │   │   │   └── store.ts         # EventStore over libSQL
│   │   │   ├── nip11/               # Relay info document
│   │   │   └── db.ts                # createDb() → @libsql/client/web
│   │   ├── build.ts
│   │   └── package.json
│   ├── blossom/           # Bunny Edge Script: blossom server
│   │   ├── src/
│   │   │   ├── main.ts    # BunnySDK.net.http.serve entry point
│   │   │   ├── router.ts  # BUD endpoint dispatch
│   │   │   ├── handlers/
│   │   │   │   ├── blob-get.ts      # GET /{sha256}
│   │   │   │   ├── blob-upload.ts   # PUT /upload
│   │   │   │   ├── blob-list.ts     # GET /list/{pubkey}
│   │   │   │   └── upload-check.ts  # HEAD /upload
│   │   │   ├── storage/
│   │   │   │   └── client.ts        # StorageClient (Bunny Storage REST)
│   │   │   └── auth/                # NIP-98 / blossom auth header validation
│   │   ├── build.ts
│   │   └── package.json
│   ├── spa/               # Svelte SPA: deploy UI
│   │   ├── src/
│   │   │   ├── App.svelte
│   │   │   ├── lib/
│   │   │   │   ├── auth/            # NIP-07 + NIP-46 signers
│   │   │   │   ├── uploader/        # File processing, secret scan, SHA-256
│   │   │   │   └── nostr/           # Event signing, relay publish
│   │   │   └── assets/
│   │   └── package.json
│   └── shared/            # Shared types used by relay + blossom + gateway
│       ├── src/
│       │   ├── nostr.ts             # Event types, kind constants
│       │   ├── blossom.ts           # BUD types
│       │   └── manifest.ts          # FilePathMapping, manifest helpers
│       └── package.json
├── .github/
│   └── workflows/
│       ├── deploy-relay.yml
│       ├── deploy-blossom.yml
│       ├── deploy-gateway.yml
│       └── deploy-spa.yml
└── package.json           # Workspace root
```

### Structure Rationale

- **packages/gateway:** The gateway is the most complex package. It needs a dedicated `resolver/` subtree for the progressive cache state machine because that logic is non-trivial (cold/warm/stale cache paths, update detection, banner injection). Keeping it separate from the route dispatch prevents the router from ballooning.
- **packages/relay and packages/blossom:** Each mirrors the existing nostr.pub and blssm.us layout exactly — `main.ts` → `router.ts` → `handlers/` → storage layer. This makes porting existing code straightforward.
- **packages/shared:** Avoids duplicating manifest kind constants and event types across all three Edge Scripts. Each Edge Script still bundles its own copy at build time (esbuild tree-shakes unused exports).
- **packages/spa:** Separate Svelte build output deployed to Bunny Storage, served by the gateway as a static fallback at the root domain. Not bundled into the gateway Edge Script — gateway fetches SPA assets from storage.

## Architectural Patterns

### Pattern 1: BunnySDK Entry Point

**What:** Every Edge Script has the same minimal `main.ts` that creates dependencies (DB client, storage client, config) then hands all requests to `route()`.
**When to use:** Always — this is the BunnySDK contract.
**Trade-offs:** Simple; all shared state is module-level (effectively singleton per edge worker instance).

```typescript
// packages/gateway/src/main.ts
import * as BunnySDK from "@bunny.net/edgescript-sdk";
import { route } from "./router.ts";
import { createRelayClient } from "./relay-client.ts";
import { createBlossomClient } from "./blossom-client.ts";

const relayClient = createRelayClient();    // internal fetch client
const blossomClient = createBlossomClient(); // internal fetch client

BunnySDK.net.http.serve(async (request: Request): Promise<Response> => {
  try {
    return await route(request, relayClient, blossomClient);
  } catch (error) {
    return new Response(JSON.stringify({ error: String(error) }), { status: 500 });
  }
});
```

### Pattern 2: Host-Header Router

**What:** The gateway's `router.ts` inspects the `Host` header to determine routing mode. No framework — direct URL/header parsing.
**When to use:** All Edge Scripts. BunnySDK provides `Request` — use `new URL(request.url)` and `request.headers.get("host")`.
**Trade-offs:** Explicit and transparent; easy to test with mock requests.

```typescript
// packages/gateway/src/router.ts
export async function route(request: Request, ...deps): Promise<Response> {
  const url = new URL(request.url);
  const host = request.headers.get("host") || url.hostname;
  const subdomain = extractSubdomain(host); // e.g. "npub1xxx" or "blog.npub1xxx"

  // 1. WebSocket upgrade → relay (regardless of subdomain)
  if (request.headers.get("upgrade")?.toLowerCase() === "websocket") {
    return forwardToRelay(request, deps.relayClient);
  }

  // 2. Blossom endpoints
  if (isBlossomPath(url.pathname)) {
    return forwardToBlossom(request, deps.blossomClient);
  }

  // 3. npub subdomain → nsite resolver
  if (subdomain && isNpub(subdomain)) {
    return resolveNsite(request, subdomain, url, deps);
  }

  // 4. Root domain → SPA
  return serveSpa(request, deps.blossomClient);
}
```

### Pattern 3: Progressive Cache State Machine

**What:** The gateway maintains per-site cache state with three modes: cold (no cache), warm-stale (cache exists, manifest may have changed), warm-current (cache exists, no changes). Derived from nsyte's `NsiteGatewayServer.handleRequest()`.
**When to use:** Every nsite request that hits an npub subdomain.
**Trade-offs:** Complexity lives in the resolver, not the router. Each cache state produces a different response strategy.

```
COLD CACHE:
  1. Return loading page immediately (with user profile display name/avatar)
  2. Fire async background fetch: user outbox relays (10002) → manifest (15128/35128) → file list
  3. Persist fetched manifest to own relay (cache write-back)
  4. When ready: next request hits WARM path

WARM-STALE (cache exists, background check finds newer manifest):
  1. Serve cached file immediately (fast, no wait)
  2. Fire async background manifest check
  3. If manifest timestamp newer: update in-memory cache
  4. If served HTML: inject "update available" banner with manual refresh link
  5. Persist new manifest to own relay

WARM-CURRENT (cache exists, background check finds nothing newer):
  1. Serve cached file immediately
  2. Background check completes with no diff → no-op
```

### Pattern 4: Internal Cross-Script Communication

**What:** The gateway calls the relay and blossom as internal Bunny-origin HTTP requests. Each Edge Script is deployed to a separate Bunny Pull Zone. Internal calls use the same blossom/relay public API — the gateway is a consumer, not a special case.
**When to use:** Gateway needs to read manifests (relay query) and blobs (blossom GET). Gateway writes back via standard relay EVENT submission and blossom PUT /upload.
**Trade-offs:** Standard protocols means any external tool (nsyte CLI) can also read/write. No proprietary internal API needed.

### Pattern 5: StorageClient Abstraction (Blossom)

**What:** Bunny Storage REST API is wrapped in a `StorageClient` class providing `put`, `get`, `head`, `delete`, `list` and path helper methods (`blobPath`, `metaPath`, `listPath`). Blobs stored under `blobs/{sha256[0:2]}/{sha256}`, metadata under `meta/{sha256[0:2]}/{sha256}.json`.
**When to use:** All blossom blob operations.
**Trade-offs:** Isolates Bunny Storage API details. Swap storage backend by replacing this class only.

## Data Flow

### Flow 1: Cold Cache nsite Request

```
Browser → GET npub1xxx.nsite.run/index.html
  ↓
Gateway router: npub subdomain detected
  ↓
resolver/cache.ts: no cache entry for pubkey
  ↓
Return loading page immediately (with profile display name + avatar via kind 0)
  ↓ [async background]
Gateway → relay WebSocket: REQ for kind 10002 (user outbox relays)
  ↓
Gateway → relay WebSocket: REQ for kind 15128 (root manifest) on outbox relays
  ↓
Manifest found: extract [path, sha256] tags
  ↓
Gateway → relay EVENT: publish manifest to own relay (cache write-back)
  ↓
Cache updated in memory
  ↓ [next request]
Browser → GET npub1xxx.nsite.run/index.html (auto-refresh from loading page)
  ↓
resolver/cache.ts: cache hit → WARM path
  ↓
Look up SHA-256 for /index.html in file map
  ↓
Gateway → blossom GET /{sha256} (from manifest server tags or user 10063 list)
  ↓
If blob not in own blossom: forward to upstream server, cache-write to own blossom
  ↓
Return blob with correct Content-Type
```

### Flow 2: Warm Cache with Update

```
Browser → GET npub1xxx.nsite.run/page.html
  ↓
Gateway: cache hit → serve file immediately from blossom
  ↓ [async background]
Gateway → relay: REQ manifest with since=<last_cached_timestamp>
  ↓
Newer manifest found:
  → Update in-memory cache
  → Publish new manifest to own relay
  → Cache new blobs from upstream blossom to own blossom
  → Record update timestamp for this path
  ↓
If served response was HTML:
  → banner.ts injects "Update available — click to refresh" before </body>
  (Injection uses string replacement on response body, not DOM parsing)
```

### Flow 3: WebSocket Relay Request

```
Client → WebSocket upgrade to wss://nsite.run
  ↓
Gateway router: Upgrade header detected
  ↓
forwardToRelay(): proxy WebSocket connection to packages/relay Edge Script
  ↓
Relay: NIP-01 protocol (REQ, EVENT, CLOSE, NOTICE)
  ↓
EventStore → Bunny DB (libSQL): query/insert events
  ↓
Filter: only accept/serve kinds 15128, 35128, 10002, 10063
```

### Flow 4: Blossom Upload (SPA deploy flow)

```
SPA → PUT /upload with Authorization header (NIP-98 signed event)
  ↓
Gateway router: /upload path → forwardToBlossom()
  ↓
Blossom handler: validate NIP-98 auth, check blob size
  ↓
StorageClient.put(blobPath(sha256), body) → Bunny Storage REST
  ↓
Return BUD-02 blob descriptor { sha256, size, url, type }
  ↓
SPA collects all descriptors → signs kind 15128/35128 manifest event
  ↓
SPA → relay EVENT submission (via WebSocket to wss://nsite.run)
```

### Flow 5: SPA Delivery (Root Domain)

```
Browser → GET https://nsite.run/
  ↓
Gateway router: no npub subdomain, no blossom path, no WebSocket
  ↓
serveSpa(): fetch index.html from Bunny Storage (SPA package deploy location)
  ↓
Return SPA HTML → browser loads JS bundle → Svelte app boots
```

## Component Boundaries

| From | To | Protocol | Notes |
|------|----|----------|-------|
| Gateway | Relay | WebSocket (NIP-01) | Manifests cached into relay via standard EVENT |
| Gateway | Relay | HTTP (NIP-11) | Relay discovery |
| Gateway | Blossom | HTTP (BUD-01) | GET blob by SHA-256 |
| Gateway | Blossom | HTTP (BUD-02) | PUT blob (cache write-back from upstream) |
| Gateway | External relays | WebSocket (NIP-01) | Resolve user 10002 outbox + manifest lookup |
| Gateway | External blossom | HTTP (BUD-01) | Fetch blobs not yet in own blossom |
| SPA | Relay | WebSocket (NIP-01) | Publish manifests after deploy |
| SPA | Blossom | HTTP (BUD-02) | Upload blobs during deploy |
| nsyte CLI | Relay | WebSocket (NIP-01) | Same standard interface as SPA |
| nsyte CLI | Blossom | HTTP (BUD-02) | Same standard interface as SPA |

The relay and blossom packages have **no knowledge of each other**. Only the gateway combines them. This means relay and blossom can be developed and deployed independently.

## Suggested Build Order

Dependencies between components determine phase ordering:

1. **packages/relay** — No dependencies on other packages in this repo. Directly portable from nostr.pub. Enables testing relay publish/query before gateway exists.

2. **packages/blossom** — No dependencies on relay. Directly portable from blssm.us. Enables testing blob upload/download before gateway exists.

3. **packages/shared** — Extract shared types (manifest kinds, event types) once relay and blossom are working. Wire shared imports into both.

4. **packages/gateway** (router + basic proxy) — Requires relay and blossom to be deployed so internal requests can be tested end-to-end. Start with just routing (WebSocket → relay, blossom paths → blossom, root → 404).

5. **packages/gateway** (nsite resolver + progressive cache) — Most complex feature. Builds on working routing. Cold cache → loading page → manifest resolution → blob serving.

6. **packages/spa** — Requires blossom (upload target) and relay (manifest publish). Can be developed in parallel with gateway resolver but integration testing needs both deployed.

## Scaling Considerations

This system runs at CDN edge. Scaling characteristics differ from traditional servers.

| Concern | Current Scale | CDN Edge Scale | Notes |
|---------|--------------|----------------|-------|
| Relay writes | Bunny DB handles small-to-medium write volume | DB is the bottleneck, not the Edge Script | nsite-only kinds keep event volume low |
| Blob storage | Bunny Storage scales horizontally | No bottleneck expected | SHA-256 path sharding already in StorageClient |
| Gateway cache | In-memory per edge worker instance | Each CDN node has cold cache until warmed | Acceptable: loading page handles cold gracefully |
| WebSocket relay | One connection per nostr client | Pull Zone must have WebSocket enabled | Not all CDN setups support WS — verify Bunny Pull Zone config |
| Manifest resolution latency | External relay queries add latency | Cold cache shows loading page — user isn't blocked | Warm cache serves immediately |

## Anti-Patterns

### Anti-Pattern 1: Monolithic Edge Script

**What people do:** Put relay, blossom, and gateway all in one bundle.
**Why it's wrong:** Approaches the 1MB bundle limit fast. Cannot deploy relay updates without redeploying gateway. Logic becomes entangled.
**Do this instead:** Three separate Edge Scripts, three separate Bunny Pull Zones, internal HTTP calls between them.

### Anti-Pattern 2: Synchronous Manifest Resolution on First Request

**What people do:** Block the HTTP response until the manifest is fully resolved from external relays.
**Why it's wrong:** External relay queries take 500ms–3s. Users see a hang with no feedback.
**Do this instead:** Return loading page immediately, resolve manifest async, auto-refresh (nsyte pattern). The loading page shows user profile while resolving.

### Anti-Pattern 3: DOM Parsing for Banner Injection

**What people do:** Parse served HTML as a DOM to inject the update banner.
**Why it's wrong:** No DOM parser in Deno/BunnySDK Edge environment. Adds complexity and bundle size.
**Do this instead:** String search and replace — find `</body>` and insert banner HTML before it. If `</body>` is absent, append banner at end of response body.

### Anti-Pattern 4: General-Purpose Relay/Blossom

**What people do:** Accept all event kinds and all blob uploads to maximize compatibility.
**Why it's wrong:** Storage grows unbounded. The value proposition is nsite-specific caching and reliability.
**Do this instead:** Relay filter on `kinds: [15128, 35128, 10002, 10063]` at ingress. Blossom validates that uploaded blobs are referenced in existing manifests (or uploaded by a known nsite deployer).

### Anti-Pattern 5: Proprietary Gateway Cache API

**What people do:** Create a private cache API between gateway and relay/blossom with custom endpoints.
**Why it's wrong:** Breaks compatibility with nsyte CLI and other gateways. Defeats the "other gateways can consume this infrastructure" goal.
**Do this instead:** Cache write-back via standard NIP-01 EVENT to own relay and standard BUD-02 PUT to own blossom. Any tool that speaks nostr+blossom can benefit.

## Integration Points

### External Services

| Service | Integration Pattern | Notes |
|---------|---------------------|-------|
| Bunny DB (libSQL) | `@libsql/client/web` HTTP transport | URL + authToken from env vars; see nostr.pub/src/db.ts |
| Bunny Storage | REST API via `fetch` | Hostname, username, password from env vars; see blssm.us/src/storage/client.ts |
| External nostr relays | WebSocket NIP-01 | Gateway connects outbound to user's 10002 relay list for manifest resolution |
| External blossom servers | HTTP BUD-01 | Gateway fetches blobs from manifest server tags or user's 10063 list |

### Internal Boundaries

| Boundary | Communication | Notes |
|----------|---------------|-------|
| Gateway ↔ Relay | HTTP (NIP-01 REST not WS for internal) or WebSocket proxy | Decide: internal relay calls can use HTTP REQ simulation or full WS proxy. HTTP is simpler for one-shot queries. |
| Gateway ↔ Blossom | HTTP fetch to blossom Pull Zone URL | Standard BUD endpoints; no special auth needed for cache write-back (gateway is trusted origin) |
| SPA ↔ Gateway | HTTP only — SPA is static | SPA is a static Svelte build; all dynamic operations go direct to relay/blossom endpoints |

## Sources

- `/home/sandwich/Develop/nostr.pub/src/main.ts` — BunnySDK entry point pattern (HIGH confidence, direct code inspection)
- `/home/sandwich/Develop/nostr.pub/src/router.ts` — Host-header routing, WebSocket dispatch, NIP-11 pattern (HIGH confidence)
- `/home/sandwich/Develop/blssm.us/src/main.ts` — Blossom Edge Script entry point + config pattern (HIGH confidence)
- `/home/sandwich/Develop/blssm.us/src/router.ts` — BUD endpoint routing pattern (HIGH confidence)
- `/home/sandwich/Develop/blssm.us/src/storage/client.ts` — Bunny Storage REST abstraction (HIGH confidence)
- `/home/sandwich/Develop/nostr.pub/src/db.ts` — Bunny DB libSQL client pattern (HIGH confidence)
- `/home/sandwich/Develop/nsyte/src/lib/gateway.ts` — Progressive cache state machine, banner injection, loading page pattern (HIGH confidence)
- `/home/sandwich/Develop/nsyte/src/commands/run.ts` — Manifest resolution flow (outbox → manifest → blossom server list) (HIGH confidence)
- `/home/sandwich/Develop/nsyte/src/lib/manifest.ts` — Kind 15128/35128 structure, path tag format (HIGH confidence)
- `/home/sandwich/Develop/nsite.run/.planning/PROJECT.md` — Routing architecture requirements, out-of-scope decisions (HIGH confidence)

---
*Architecture research for: nsite gateway on Bunny Edge Scripting*
*Researched: 2026-03-13*
