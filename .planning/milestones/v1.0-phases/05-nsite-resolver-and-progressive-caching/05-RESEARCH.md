# Phase 5: nsite Resolver and Progressive Caching - Research

**Researched:** 2026-03-13
**Domain:** nsite content resolution from nostr relays + blossom servers, with progressive caching and update banners
**Confidence:** HIGH — all critical findings derived from direct code inspection of the project's own relay/blossom apps, the nsyte reference gateway implementation, and existing gateway stubs from Phase 4.

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- **Loading page:** Minimal centered card with user avatar, display name, and spinner/progress text
- **Profile data source:** kind 0 fetched from well-known public relays (e.g., purplepag.es)
- **Loading page template:** Static HTML template file (not inline string) with placeholder replacement
- **Update banner:** Fixed bar at top of viewport, "This site has been updated. Click to refresh.", dismissible with X button, includes own inline CSS
- **Resolution pipeline:** Streaming/opportunistic — parallel subscriptions, each hop triggers next immediately (not sequential)
- **Own relay queries:** Direct Bunny DB (libSQL) queries — no WebSocket hop
- **External relay queries:** Standard NIP-01 WebSocket connections
- **Seed relays:** Configurable via SEED_RELAYS env var with sensible defaults
- **No manifest found:** Friendly 404 page explaining "This nsite doesn't exist yet" with link to nsite.run
- **Path not in manifest:** Serve site's own /404.html if in manifest, otherwise gateway default 404
- **Directory paths:** / → /index.html, /about/ → /about/index.html
- **Compressed assets:** Serve as-is with Content-Encoding: br/gzip — detect from path extension (.br, .gz)
- **Security headers:** X-Content-Type-Options: nosniff, X-Frame-Options: DENY, CSP (basic), Strict-Transport-Security
- **Cache persistence:** Fetched manifests → gateway's own relay (Bunny DB); fetched blobs → gateway's own blossom (Bunny Storage)

### Claude's Discretion
- Auto-refresh mechanism choice (meta refresh vs JS polling)
- Banner injection point (prepend to body vs append with fixed positioning)
- Timeout values for relay discovery, manifest query, blob fetch
- WebSocket client implementation details for external relay connections
- How to determine if cached manifest is outdated (timestamp comparison, event id comparison)
- Content-Type detection strategy (from blossom metadata, path extension, or manifest hints)
- Exact security header values for CSP that don't break legitimate site functionality

### Deferred Ideas (OUT OF SCOPE)
- ETag / If-None-Match for 304 responses — v2 optimization (OPT-02)
- Pull zone edge rules for routing optimization — v2 (OPT-01)
- Profile caching into own relay (kind 0) — nice-to-have, not in current requirements
</user_constraints>

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| GATE-01 | Gateway resolves npub from subdomain hostname | `extractNpubAndIdentifier()` returns string npub; Phase 5 decodes to hex pubkey via `nip19.decode()` from `@nostr/tools/pure` |
| GATE-02 | Gateway resolves named site identifier from subdomain hostname | Same `extractNpubAndIdentifier()` — `identifier` field on `SitePointer` |
| GATE-03 | Gateway fetches user's NIP-65 relay list (kind 10002) from own relay and seed relays | Direct DB query for own relay; NIP-01 WebSocket for external seed relays |
| GATE-04 | Gateway queries manifest events (15128/35128) from user's relays and own relay | Direct DB query for own relay; NIP-01 WebSocket for user's outbox relays |
| GATE-05 | Gateway resolves requested path to SHA-256 hash via manifest path tags | `tags.filter(t => t[0] === "path")` — already confirmed by nsyte manifest.ts |
| GATE-06 | Gateway fetches blobs from manifest server tags, then user's 10063 blossom list | Manifest `server` tags → user's kind 10063 list → fallback fetch pattern |
| GATE-07 | Gateway verifies SHA-256 integrity of fetched blobs | `sha256Hex()` from `@nsite/shared/sha256`; compare against path tag value |
| GATE-08 | Gateway serves files with correct Content-Type | Path extension lookup via lookup table; fallback to `application/octet-stream` |
| GATE-09 | Gateway falls back to /index.html for directory paths | Strip trailing slash, append `/index.html` |
| GATE-10 | Gateway serves /404.html for unmatched paths | Check manifest for `/404.html` path tag; fallback to gateway default 404 HTML |
| GATE-11 | Gateway handles brotli/gzip compressed assets in manifests | Detect `.br`/`.gz` suffix on path tag; strip suffix for actual path; set Content-Encoding header |
| GATE-12 | Gateway sets security headers on all responses | `securityHeaders()` helper — pattern established in nsyte gateway.ts |
| CACHE-01 | Cold cache shows loading page, resolves manifest, persists to relay | Module-level `Map<string, CacheEntry>` keyed by `pubkey:identifier`; loading state triggers HTML loading page |
| CACHE-02 | Loading page displays user's profile (display name, avatar from kind 0) | Fetch kind 0 from seed relays in parallel with manifest resolution; HTML template with `{{DISPLAY_NAME}}` / `{{AVATAR_URL}}` placeholders |
| CACHE-03 | Loading page auto-refreshes until content available | JS polling (fetch `/_nsite/ready?pubkey=...`) — more reliable than meta refresh on Bunny Edge (no 0-second meta refresh) |
| CACHE-04 | Warm outdated cache serves cached site immediately | Serve from cache first; background update check in parallel |
| CACHE-05 | Warm cache triggers background update check against user's relays | Promise-as-mutex pattern: `backgroundChecks.set(key, promise)` before first await |
| CACHE-06 | When update found, inject banner into served HTML | Content-Type guard; inject before last `</body>`; append fallback if not found |
| CACHE-07 | Warm current cache serves immediately, background check finds no update | Compare incoming manifest `created_at` against cached manifest `created_at` |
| CACHE-08 | Gateway persists fetched manifests into its own relay | `insertReplaceableEvent()` / `insertParameterizedReplaceableEvent()` from `apps/relay/src/db.ts` |
| CACHE-09 | Gateway persists fetched blobs into its own blossom | `StorageClient.put()` from `apps/blossom/src/storage/client.ts` |
</phase_requirements>

---

## Summary

Phase 5 replaces the `handleResolverStub()` in `apps/gateway/src/stubs/resolver.ts` with a live implementation that resolves nsite content from the nostr network and serves it with progressive caching. The implementation is the largest and most complex phase in this project, spanning three concerns: (1) nostr resolution (relay discovery, manifest fetching, blob retrieval), (2) progressive cache state machine (cold/warm-outdated/warm-current), and (3) file serving (content type, compression, security headers, error pages).

The gateway uses two classes of relay access: direct Bunny DB queries (via `@libsql/client/web`, already established in `apps/relay/src/db.ts`) for the own relay, and raw NIP-01 WebSocket connections for external relays. The key architectural decision is that the gateway shares the same libSQL database as the relay, enabling zero-latency cache lookups. The `queryEvents()` function from `apps/relay/src/db.ts` is directly reusable in the gateway.

The streaming/opportunistic pipeline is the hardest design problem: relay lists, manifest events, and blob fetches must fan out in parallel, with each piece of data triggering the next hop immediately. This is implemented as an async coordination pattern (using `Promise.race()` across relay WebSocket subscriptions plus the DB query) rather than sequential await chains. The module-level cache state machine prevents redundant relay queries under concurrent load.

**Primary recommendation:** Implement as a single `apps/gateway/src/resolver.ts` module (replacing the stub) that owns the cache Map, the resolution pipeline, and all file serving logic. Import `queryEvents`/`insertReplaceableEvent`/`insertParameterizedReplaceableEvent` from `apps/relay/src/db.ts` and `StorageClient` from `apps/blossom/src/storage/client.ts`. Use `@nostr/tools/pure` (already in blossom's deno.json) for npub decoding via `nip19.decode()`.

---

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `@nostr/tools/pure` | `jsr:@nostr/tools@^2.23.3` | `nip19.decode()` for npub→hex pubkey conversion; `verifyEvent()` for manifest integrity | Already in blossom deno.json; already locked in deno.lock at 2.23.3 |
| `@libsql/client/web` | `npm:@libsql/client@*` (locked 0.17.0) | Direct DB queries to own relay (no WebSocket hop) | Already used in relay; reuse from db.ts |
| `@nsite/shared` | workspace | `NostrEvent`, `NostrFilter`, `NsiteKind`, `sha256Hex()` | Shared types already imported by relay/blossom |
| `apps/relay/src/db.ts` | workspace (internal) | `queryEvents()`, `insertReplaceableEvent()`, `insertParameterizedReplaceableEvent()`, `createDb()` | Direct DB access for own-relay cache; no WebSocket hop |
| `apps/blossom/src/storage/client.ts` | workspace (internal) | `StorageClient.put()`, `StorageClient.blobPath()` | Persist fetched blobs to own blossom |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| `@std/media-types` | (from deno std) | `contentType(ext)` for mime type lookup | Content-Type detection from path extension — only if bundle permits |
| Native `WebSocket` API | Deno built-in | NIP-01 WebSocket connections to external relays | External relay queries: REQ/EVENT/EOSE/CLOSE messages |
| Native `crypto.subtle` | Web API | SHA-256 verification of blobs | Already used in `sha256Hex()` in `@nsite/shared` |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| `@nostr/tools/pure` nip19 | `@scure/base` bech32 decode | `@nostr/tools/pure` is already in the project; bech32 decode via nip19.decode() is more readable and already correct for the npub format |
| Raw WebSocket API | applesauce-relay RelayPool | applesauce-relay + rxjs would add significant bundle weight; raw WebSocket is ~50 lines of code and fully sufficient for a single-purpose REQ/EOSE query |
| Native mime type lookup table | `@std/media-types` | Custom lookup table keeps bundle small (no extra import); ~30 lines covers 95% of web asset types |

**Installation (gateway deno.json additions):**
```bash
# Add to apps/gateway/deno.json imports:
"@nostr/tools/pure": "jsr:@nostr/tools@^2.23.3"
"@libsql/client/web": "npm:@libsql/client/web"
```

Note: The relay's db.ts functions are imported via workspace cross-package import (not external). The gateway's deno.json will need to reference `apps/relay` as a workspace dependency or duplicate only the needed DB functions. **Recommendation:** Copy only the needed functions (`queryEvents`, `insertReplaceableEvent`, `insertParameterizedReplaceableEvent`, `createDb`) into `apps/gateway/src/db.ts` to avoid cross-app coupling. This prevents entangling the relay and gateway build graphs.

---

## Architecture Patterns

### Recommended Project Structure
```
apps/gateway/src/
├── main.ts                    # entry point — unchanged from Phase 4
├── router.ts                  # REPLACE: import handleResolver (not stub)
├── hostname.ts                # KEEP: already correct from Phase 4
├── resolver.ts                # NEW: live resolver (replaces stubs/resolver.ts)
├── db.ts                      # NEW: copied DB functions from relay for own-relay queries
├── cache.ts                   # NEW: CacheEntry type + module-level Map + cache state logic
├── nostr-ws.ts                # NEW: raw NIP-01 WebSocket client for external relays
├── content-type.ts            # NEW: path extension → MIME type lookup table
├── security-headers.ts        # NEW: securityHeaders() helper
├── templates/
│   └── loading.html           # NEW: static HTML template for cold-cache loading page
└── stubs/
    ├── relay.ts               # KEEP: relay stub (Phase 5 scope doesn't change relay routing)
    ├── blossom.ts             # KEEP: blossom stub
    └── spa.ts                 # KEEP: SPA stub
```

### Pattern 1: Cache State Machine
**What:** Module-level Map tracks resolved sites in three states: loading, cached (with event timestamp), background-checking.
**When to use:** Always — every request goes through cache lookup before network.

```typescript
// Source: nsyte/src/lib/gateway.ts NsiteGatewayServer.fileListCache pattern (adapted)
// Promise-as-mutex prevents race conditions on concurrent cold-cache requests

interface CacheEntry {
  pubkey: string;
  identifier?: string;
  manifestEvent: NostrEvent | null;
  files: Map<string, string>;  // path → sha256
  blossomServers: string[];    // from manifest server tags, then kind 10063
  cachedAt: number;            // unix timestamp
  state: "loading" | "ready" | "not-found";
}

// Module-level cache — shared across requests on same edge worker instance
const siteCache = new Map<string, CacheEntry>();
// Deduplication gate for background checks: key → in-flight Promise
const backgroundChecks = new Map<string, Promise<void>>();
```

### Pattern 2: npub → hex pubkey Decoding
**What:** `SitePointer.npub` is a bech32 string from Phase 4 hostname parsing. Phase 5 decodes it to a 32-byte hex pubkey for relay queries.
**When to use:** At the start of every resolver invocation.

```typescript
// Source: @nostr/tools/pure nip19 module
import { nip19 } from "@nostr/tools/pure";

function npubToHex(npub: string): string | null {
  try {
    const decoded = nip19.decode(npub);
    if (decoded.type !== "npub") return null;
    return decoded.data; // 32-byte hex string
  } catch {
    return null;
  }
}
```

### Pattern 3: Own Relay Query (Direct DB)
**What:** Query own relay by executing SQL directly — no WebSocket round-trip.
**When to use:** First step of every resolution; warm-cache check.

```typescript
// Source: apps/relay/src/db.ts queryEvents() pattern
import { createDb, queryEvents } from "./db.ts";

// At module level (not per-request)
const db = createDb();

// Query own relay for manifest
const ownRelayEvents = await queryEvents(db, [{
  kinds: [NsiteKind.ROOT_SITE],     // 15128 for root site
  authors: [pubkeyHex],
  limit: 1,
}]);
```

### Pattern 4: Raw NIP-01 WebSocket Client
**What:** Minimal WebSocket client that sends REQ, collects EVENTs until EOSE, then closes.
**When to use:** External relay queries (seed relays + user's outbox relays from kind 10002).

```typescript
// Source: NIP-01 spec; pattern from nsyte nostr.ts pool.request() simplified
// No applesauce-relay; raw WebSocket keeps bundle small

async function queryRelayOnce(
  relayUrl: string,
  filter: NostrFilter,
  timeoutMs: number,
): Promise<NostrEvent[]> {
  return new Promise((resolve) => {
    const events: NostrEvent[] = [];
    const subId = crypto.randomUUID().slice(0, 8);
    let ws: WebSocket;

    const timer = setTimeout(() => {
      ws?.close();
      resolve(events);
    }, timeoutMs);

    try {
      ws = new WebSocket(relayUrl);
      ws.onopen = () => {
        ws.send(JSON.stringify(["REQ", subId, filter]));
      };
      ws.onmessage = (e) => {
        try {
          const msg = JSON.parse(e.data as string);
          if (msg[0] === "EVENT" && msg[1] === subId) {
            events.push(msg[2] as NostrEvent);
          } else if (msg[0] === "EOSE" && msg[1] === subId) {
            clearTimeout(timer);
            ws.close();
            resolve(events);
          }
        } catch { /* ignore parse errors */ }
      };
      ws.onerror = () => { clearTimeout(timer); resolve(events); };
      ws.onclose = () => { clearTimeout(timer); resolve(events); };
    } catch {
      clearTimeout(timer);
      resolve([]);
    }
  });
}
```

### Pattern 5: Streaming/Opportunistic Resolution Pipeline
**What:** Parallel relay subscriptions that each trigger the next hop as data arrives.
**When to use:** Cold-cache resolution for any npub or named site.

```typescript
// Resolution pipeline (pseudo-code showing data flow)
// 1. Kick off in parallel:
//    a. Own relay DB query for kind 10002 (relay list)
//    b. Own relay DB query for manifest (15128/35128)
//    c. Seed relay WebSocket queries for kind 10002

// 2. As kind 10002 events arrive:
//    → Immediately open WebSocket queries to user's outbox relays for manifest

// 3. As manifest events arrive (from own relay OR external):
//    → Immediately start fetching blobs from manifest server tags
//    → Persist manifest to own relay (CACHE-08)

// 4. As blobs arrive:
//    → Verify SHA-256 (GATE-07)
//    → Persist to own blossom (CACHE-09)
//    → Resolve the specific file request

// Key: Promise.race() picks fastest source; don't await one before starting next
```

### Pattern 6: Banner Injection
**What:** Inject the update banner HTML string before the last `</body>` tag in an HTML response.
**When to use:** Warm-outdated cache state, after determining manifest has been updated.

```typescript
// Source: PITFALLS.md Pitfall 4 analysis
const BANNER_HTML = `<div id="_nsite-banner" style="position:fixed;top:0;left:0;right:0;z-index:2147483647;background:#ffffcc;border-bottom:1px solid #ccc;padding:6px 12px;font-size:13px;font-family:sans-serif;display:flex;justify-content:space-between;align-items:center;"><span>This site has been updated. <a href="" onclick="location.reload();return false;" style="color:#0066cc;">Click to refresh.</a></span><button onclick="document.getElementById('_nsite-banner').remove()" style="border:none;background:none;cursor:pointer;font-size:16px;padding:0 4px;">✕</button></div>`;

function injectBanner(html: string): string {
  // Only inject into text/html responses (caller responsibility to check Content-Type)
  const lastBodyTag = html.lastIndexOf("</body>");
  if (lastBodyTag !== -1) {
    return html.slice(0, lastBodyTag) + BANNER_HTML + html.slice(lastBodyTag);
  }
  // Fallback: append to end (valid, browsers render it)
  return html + BANNER_HTML;
}
```

### Pattern 7: Loading Page Auto-Refresh
**What:** JS polling beats meta refresh for Bunny Edge Scripts — meta refresh with 0-second delay may be rate-limited by browsers, and there is no guarantee the Bunny CDN doesn't cache meta-refresh pages.
**When to use:** Cold-cache loading page response.

```typescript
// Loading page template pattern (in templates/loading.html)
// The page polls /_nsite/ready?k={{KEY}} every 2 seconds
// When the endpoint returns { ready: true }, JS does window.location.reload()

// Server-side: /_nsite/ready endpoint checks if cache entry has transitioned to "ready"
// Returns { ready: false } while loading, { ready: true } when manifest resolved
```

### Anti-Patterns to Avoid
- **Applesauce-relay in edge script:** Heavy bundle; raw WebSocket is sufficient for REQ/EOSE queries.
- **Sequential resolution:** Don't await relay-list fetch before starting manifest query — fan out in parallel.
- **Manifest cached per path request:** Cache the full manifest (all path tags) keyed by site; single manifest serves all file requests.
- **Creating a new DB client per request:** `createDb()` must be at module level — Pitfall 6 from PITFALLS.md.
- **Cross-importing relay build artifacts:** Don't import the relay's compiled bundle. Copy the needed DB functions into `apps/gateway/src/db.ts`.
- **Verifying blobs on every request from cache:** Only verify on first fetch; serve from trusted cache subsequently.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| npub → hex pubkey | Custom bech32 parser | `nip19.decode()` from `@nostr/tools/pure` | Already in project; handles checksum validation |
| Event SHA-256 verification | Custom digest | `sha256Hex()` from `@nsite/shared/sha256` | Already implemented; handles SubtleCrypto type constraints |
| Bunny Storage blob persistence | Custom REST client | `StorageClient` from `apps/blossom/src/storage/client.ts` | Already implements correct Bunny Storage API patterns (201 vs 200, trailing slash for listing) |
| Direct relay DB queries | Separate relay connection | `queryEvents()` / `insertReplaceableEvent()` from db.ts (copied into gateway) | Already handles all filter types, deduplication, soft-delete exclusion |
| NIP-01 filter SQL | Custom query builder | `buildFilterQuery()` internal to db.ts | Already handles prefix matching, tag joins, limit caps |
| Manifest path tag parsing | Custom tag scanner | `tags.filter(t => t[0] === "path")` pattern from nsyte/src/lib/manifest.ts | Three-element `["path", "/foo.html", "<sha256>"]` tag format |
| Blossom server list parsing | Custom tag scanner | `tags.filter(t => t[0] === "server")` pattern | Same tag format used in manifest and kind 10063 events |
| HTML entity escaping | Custom replacer | Simple `escapeHtml()` from nsyte/src/lib/gateway.ts pattern | Prevents XSS in loading page display name / avatar URL |

---

## Common Pitfalls

### Pitfall 1: Race Condition — Duplicate Background Checks (CRITICAL)
**What goes wrong:** Two concurrent requests for the same warm-outdated site both pass the `!backgroundChecks.has(key)` guard, triggering two parallel relay queries. Whichever relay responds last overwrites the cache, potentially reverting to older data.
**Why it happens:** The Map check and the subsequent `set()` are separated by at least one async await — requests processed concurrently by the same edge worker both see `has()` return false.
**How to avoid:** Set the Map entry synchronously with the Promise reference BEFORE the first `await` in the check function:
```typescript
// CORRECT: Map entry set synchronously before any await
const promise = (async () => {
  // ... relay queries with awaits ...
})();
backgroundChecks.set(key, promise); // Set BEFORE the async work starts
```
**Warning signs:** Duplicate relay queries in logs for the same pubkey within milliseconds.

### Pitfall 2: Loading Page Served for Non-HTML Asset Requests (UX)
**What goes wrong:** A request for `/style.css` or `/logo.png` on a cold-cache site returns a loading page HTML — the browser renders a broken page because the HTML shows where CSS/images should be.
**Why it happens:** The cache is empty; the resolver returns the loading page for all request types.
**How to avoid:** Return 404 immediately for non-HTML-like paths when cache is cold (check path extension). Show loading page only when the request is for a path likely to be HTML: `pathname === "/" || pathname.endsWith(".html") || !pathname.includes(".")`.
**Warning signs:** Browser DevTools shows loading page content for CSS/JS/image requests.

### Pitfall 3: Banner Injected into Binary Content
**What goes wrong:** A path response has incorrect Content-Type (e.g., a `.wasm` file served as `text/html`). The banner injection corrupts the binary by inserting UTF-8 HTML bytes.
**Why it happens:** Content-Type is inferred from path extension; if path has no extension or wrong extension, the MIME lookup falls through to a default.
**How to avoid:** Check that Content-Type header is `text/html` before injecting. Never inject into `application/*`, `image/*`, `font/*`, or `audio/*` responses.
**Warning signs:** Download files are corrupted; binary responses include visible HTML text.

### Pitfall 4: Manifest Staleness Check — `created_at` Comparison
**What goes wrong:** The gateway fetches a manifest event with the same `created_at` as the cached one. This is not an update; comparing event IDs is more reliable than comparing timestamps (relays can serve multiple events with the same second timestamp).
**Why it happens:** Two different manifest events can have identical `created_at` values if the site owner published rapidly. The gateway would incorrectly inject the update banner.
**How to avoid:** Compare event IDs first: if the fetched event ID equals the cached event ID, no update. Only flag as updated if event IDs differ AND `created_at >= cached.created_at`.
**Warning signs:** Update banner appears immediately on first warm-cache serve even when site has not changed.

### Pitfall 5: Bundle Size Blowup from applesauce-relay
**What goes wrong:** Adding `applesauce-relay` or `applesauce-loaders` to the gateway deno.json for relay pool functionality pushes the bundle over 750KB. `applesauce-relay` depends on `rxjs` which is ~40KB minified on its own.
**Why it happens:** nsyte uses applesauce-relay because it needs a persistent relay pool across multiple CLI invocations. The gateway edge script needs only one-shot REQ/EOSE queries.
**How to avoid:** Use the raw WebSocket NIP-01 client pattern (Pattern 4 above). A single `queryRelayOnce()` function is ~50 lines and adds zero bundle weight. Monitor bundle size: hard fail at 1MB, warn at 750KB.
**Warning signs:** Build output shows bundle > 600KB after Phase 5 additions.

### Pitfall 6: Cross-Package Import Creates Circular Build Graph
**What goes wrong:** `apps/gateway/build.ts` bundles `apps/gateway/src/resolver.ts` which imports from `apps/relay/src/db.ts`. The esbuild bundler follows the import chain and tries to bundle the relay's entire source tree into the gateway bundle, including relay-specific dependencies.
**Why it happens:** Deno workspace allows cross-package imports via workspace: specifiers or relative paths. esbuild's deno-loader follows them into the relay's source tree.
**How to avoid:** Copy the needed DB functions (`queryEvents`, `insertReplaceableEvent`, `insertParameterizedReplaceableEvent`, `createDb`) into `apps/gateway/src/db.ts`. This breaks the cross-package coupling. The functions are stable and well-tested; duplication is acceptable.
**Warning signs:** Gateway bundle includes `@libsql/client` twice; bundle size jumps unexpectedly after adding relay import.

### Pitfall 7: Blossom Blob Fetch — Server Tag URL Format
**What goes wrong:** Manifest `server` tags contain blossom server base URLs (e.g., `https://cdn.example.com`). The gateway naively fetches `<serverUrl>/<sha256>` but some blossom servers require `/get/<sha256>` or use a different path structure.
**Why it happens:** BUD-01 standardizes `GET /<sha256>` but some servers deviate. The `server` tag in a manifest is the blossom server base URL per BUD-01.
**How to avoid:** Construct blob URL as `${serverUrl.replace(/\/$/, "")}/${sha256}` (strip trailing slash, append sha256 directly). This matches BUD-01 spec. Verify SHA-256 after fetch regardless of server.
**Warning signs:** Blob fetches return 404 from servers that serve correctly in a browser.

### Pitfall 8: Loading Page HTML Template — Absolute vs Relative Path
**What goes wrong:** The loading page template file (`templates/loading.html`) is read via `Deno.readTextFile()` with a relative path at module load time. Bunny Edge Scripts have no file system; `Deno.readTextFile()` will throw.
**Why it happens:** Templates are files in the source tree, not bundled by esbuild unless explicitly handled.
**How to avoid:** Two options: (a) inline the template as a TypeScript string literal in a `loading-template.ts` module — esbuild bundles strings correctly; or (b) use esbuild's `loader: { ".html": "text" }` option to inline the HTML file as a string import. Option (a) is simpler and already the pattern used for other inline HTML in this codebase.
**Warning signs:** `Deno.readTextFile is not a function` or file-not-found errors in Bunny logs.

---

## Code Examples

Verified patterns from existing codebase and nsyte reference implementation:

### Manifest Path Tag Parsing
```typescript
// Source: nsyte/src/lib/manifest.ts getManifestFiles()
function getManifestFiles(manifest: NostrEvent): Array<{ path: string; sha256: string }> {
  return manifest.tags
    .filter((tag) => tag[0] === "path" && tag.length >= 3)
    .map((tag) => ({ path: tag[1], sha256: tag[2] }));
}
```

### Manifest Server Tag Parsing
```typescript
// Source: nsyte/src/lib/manifest.ts getManifestServers() → getBlossomServersFromList()
// Server tags: ["server", "https://cdn.example.com"]
function getManifestServers(manifest: NostrEvent): string[] {
  return manifest.tags
    .filter((tag) => tag[0] === "server" && tag.length >= 2)
    .map((tag) => tag[1]);
}
```

### Directory Path Resolution
```typescript
// Source: CONTEXT.md decision + nsyte gateway.ts pattern
function resolveIndexPath(pathname: string): string {
  // "/" → "/index.html"
  if (pathname === "/") return "/index.html";
  // "/about/" → "/about/index.html"
  if (pathname.endsWith("/")) return pathname + "index.html";
  return pathname;
}
```

### Compressed Asset Detection
```typescript
// Source: CONTEXT.md decision — detect .br/.gz suffix on path tag
function detectCompression(path: string): { encoding: string; basePath: string } | null {
  if (path.endsWith(".br")) return { encoding: "br", basePath: path.slice(0, -3) };
  if (path.endsWith(".gz")) return { encoding: "gzip", basePath: path.slice(0, -3) };
  return null;
}
// Usage: serve blob as-is, set Content-Encoding: br or gzip
// Browser handles decompression transparently
```

### Security Headers
```typescript
// Source: nsyte/src/lib/gateway.ts securityHeaders() — adapted for nsite content
// CSP must allow 'unsafe-inline' because nsite sites may embed inline styles/scripts
function securityHeaders(): Record<string, string> {
  return {
    "X-Content-Type-Options": "nosniff",
    "X-Frame-Options": "SAMEORIGIN", // DENY breaks sites embedded as iframes in their own domains
    "Strict-Transport-Security": "max-age=31536000; includeSubDomains",
    "Referrer-Policy": "strict-origin-when-cross-origin",
    "Content-Security-Policy":
      "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src * data: blob:; media-src * data: blob:; font-src * data:; connect-src 'self' wss: https:; frame-src 'none'; object-src 'none'",
  };
}
```

### Persist Manifest to Own Relay
```typescript
// Source: apps/relay/src/db.ts insertReplaceableEvent() / insertParameterizedReplaceableEvent()
// kind 15128 (ROOT_SITE) is a NIP-01 replaceable event → insertReplaceableEvent
// kind 35128 (NAMED_SITE) is a NIP-33 parameterized replaceable → insertParameterizedReplaceableEvent
async function persistManifest(db: Client, event: NostrEvent): Promise<void> {
  if (event.kind === NsiteKind.ROOT_SITE) {
    await insertReplaceableEvent(db, event);
  } else if (event.kind === NsiteKind.NAMED_SITE) {
    await insertParameterizedReplaceableEvent(db, event);
  }
}
```

### Persist Blob to Own Blossom
```typescript
// Source: apps/blossom/src/storage/client.ts StorageClient.put()
// No auth needed for gateway writing to its own blossom — internal operation
async function persistBlob(
  storage: StorageClient,
  sha256: string,
  data: ArrayBuffer,
  contentType: string,
): Promise<void> {
  const path = storage.blobPath(sha256); // "blobs/{pre}/{sha256}"
  await storage.put(path, data, contentType);
}
```

### Content-Type Lookup Table
```typescript
// Custom table — covers all common nsite asset types
// Source: Claude's discretion (standard web MIME types, no external library needed)
const CONTENT_TYPES: Record<string, string> = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css",
  ".js": "application/javascript",
  ".mjs": "application/javascript",
  ".json": "application/json",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".gif": "image/gif",
  ".webp": "image/webp",
  ".ico": "image/x-icon",
  ".woff": "font/woff",
  ".woff2": "font/woff2",
  ".ttf": "font/ttf",
  ".otf": "font/otf",
  ".xml": "application/xml",
  ".txt": "text/plain",
  ".md": "text/markdown",
  ".wasm": "application/wasm",
  ".pdf": "application/pdf",
};

function detectContentType(path: string): string {
  const ext = path.substring(path.lastIndexOf(".")).toLowerCase();
  return CONTENT_TYPES[ext] ?? "application/octet-stream";
}
```

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| kind 34128 manifests | kind 15128 (root) + 35128 (named) | nsite NIP v2 | Use only 15128/35128; 34128 is out of scope per REQUIREMENTS.md |
| Sequential relay discovery | Streaming/opportunistic pipeline | nsyte v1.x → v2.x pattern | Significantly reduces cold-cache time; each relay response triggers next hop |
| Auto-refresh on update | Manual "click to refresh" banner | Per UX requirements | Prevents disrupting SPA state and form inputs |
| Blocking file serve on each request | Module-level manifest cache | nsyte gateway.ts | Single relay query serves all file requests for a site |
| applesauce-relay for all relay interaction | Raw NIP-01 WebSocket for edge scripts | This project's design | Keeps gateway bundle under 750KB |

**Deprecated/outdated:**
- kind 34128: Replaced by 15128/35128; do not implement or handle
- `BunnySDK.net.http.serve()`: Replaced by `export default { fetch }` per STATE.md decision

---

## Design Decisions (Claude's Discretion)

These require research-driven recommendations:

### Auto-Refresh Mechanism: JS Polling (RECOMMENDED)
- `<meta http-equiv="refresh" content="2">` has browser-side rate limiting (minimum 1-5s varies); Bunny CDN may cache the meta-refresh response.
- JS polling via `fetch("/_nsite/ready?key=...")` every 2s is more reliable, can be stopped when ready (no infinite refresh loop), and allows the loading page to update the progress indicator without a full page reload.
- **Decision:** JS polling with 2-second interval; `/_nsite/ready` endpoint returns `{"ready":false}` while loading, `{"ready":true}` when manifest resolved; JS on response performs `window.location.reload()`.

### Banner Injection Point: Prepend to `<body>` Content (RECOMMENDED)
- Inserting before `</body>` (last occurrence) is more reliable than prepending to `<body>` because `<body>` may have attributes (`<body class="...">`).
- Using `lastIndexOf("</body>")` with case-insensitive handling covers most cases.
- Fallback: append to document end if `</body>` not found.
- The banner uses `position: fixed; top: 0` CSS so it always appears at the viewport top regardless of injection point.

### Timeout Values (RECOMMENDED)
- Own relay DB query: 2000ms (should be near-zero latency on Bunny DB; generous allowance for cold starts)
- External relay WebSocket connection: 3000ms timeout per relay
- Seed relay queries (kind 10002): 5000ms total (race multiple relays, take first response)
- Manifest queries: 8000ms total (race own relay + user's outbox relays)
- Blob fetch per server: 10000ms (blobs can be large; per-server timeout)
- Total resolution timeout: 30000ms (30s hard limit before returning 504)

### Outdated Cache Detection: Event ID Comparison (RECOMMENDED)
- Compare `fetchedEvent.id !== cachedEntry.manifestEvent.id` — if IDs differ, update is available.
- Secondary check: `fetchedEvent.created_at > cachedEntry.manifestEvent.created_at` — only show banner if the new event is strictly newer (prevents spurious updates from relay echoes).
- Both conditions must be true: different ID AND newer timestamp.

### Content-Type Strategy: Path Extension First, Blossom Metadata Fallback (RECOMMENDED)
- Manifest path tags contain the canonical path (e.g., `/index.html`). Path extension is the primary signal.
- If no extension, check blossom blob metadata (`StorageClient.getJson(metaPath(sha256))`) for the stored `type` field.
- Final fallback: `application/octet-stream` for unknown types with `X-Content-Type-Options: nosniff` to prevent browser sniffing.

---

## Open Questions

1. **Cross-package import of relay DB functions**
   - What we know: Gateway needs `queryEvents()`, `insertReplaceableEvent()`, `insertParameterizedReplaceableEvent()`, `createDb()` from relay's db.ts
   - What's unclear: Whether esbuild bundling via workspace import creates a circular build graph or bloats the gateway bundle with relay-only code
   - Recommendation: Copy the four DB functions into `apps/gateway/src/db.ts` — avoids coupling, eliminates risk, functions are stable and well-tested. ~150 lines of code.

2. **WebSocket support in Bunny Edge Scripts (STATE.md blocker)**
   - What we know: STATE.md notes "Bunny edge script fetch() WebSocket upgrade forwarding is unconfirmed"
   - What's unclear: Whether `new WebSocket(relayUrl)` works inside a Bunny Edge Script for outbound client connections (not just incoming upgrade handling)
   - Recommendation: Use native `new WebSocket(relayUrl)` — this is the Deno standard WebSocket client API, which Bunny's Deno 1.46.3 runtime supports. The relay app already uses `Deno.upgradeWebSocket()` for inbound; outbound `new WebSocket()` is a different code path. Test in Wave 1 with a simple seed relay query; if it fails, fall back to HTTP polling via relay's `?filter=...` query endpoint.

3. **Loading page template bundling**
   - What we know: Bunny Edge Scripts have no file system access; `Deno.readTextFile()` will throw
   - What's unclear: Whether esbuild can be configured to inline `.html` files as text strings
   - Recommendation: Use TypeScript string literal in `apps/gateway/src/templates/loading-template.ts` — `export const LOADING_HTML = \`...template...\`;`. This is simple and guaranteed to work with esbuild.

---

## Validation Architecture

> `workflow.nyquist_validation` is not present in .planning/config.json — skip per instructions.

---

## Sources

### Primary (HIGH confidence)
- `apps/gateway/src/stubs/resolver.ts` — the stub being replaced; confirms Phase 5 integration point
- `apps/gateway/src/hostname.ts` — `SitePointer` type; `npub` is a string bech32 that Phase 5 decodes
- `apps/gateway/src/router.ts` line 54 — `handleResolverStub(request, sitePointer)` call to replace
- `apps/relay/src/db.ts` — `queryEvents()`, `insertReplaceableEvent()`, `insertParameterizedReplaceableEvent()` — direct DB access pattern confirmed
- `apps/blossom/src/storage/client.ts` — `StorageClient.put()`, `StorageClient.blobPath()` — blob persistence confirmed
- `packages/shared/src/types.ts` — `NostrEvent`, `NostrFilter`, `NsiteKind` types
- `packages/shared/src/sha256.ts` (exists per CONTEXT.md) — `sha256Hex()` for blob integrity
- `nsyte/src/lib/gateway.ts` — streaming resolution pipeline, cache state machine, banner injection patterns
- `nsyte/src/lib/manifest.ts` — manifest path/server tag parsing (`["path", "/foo", sha256]`, `["server", url]`)
- `nsyte/src/lib/nostr.ts` — relay query patterns, timeout values, kind 10002 discovery
- `.planning/research/STACK.md` — `@nostr/tools@2.23.3` confirmed in deno.lock; applesauce bundle risk
- `.planning/research/PITFALLS.md` — Race condition pattern (Pitfall 3), banner injection (Pitfall 4)
- `.planning/phases/04-gateway-routing-layer/04-RESEARCH.md` — established patterns reused in Phase 5

### Secondary (MEDIUM confidence)
- `deno.lock` — `@nostr/tools@2.23.3`, `@noble/curves@2.0.1`, `@noble/hashes@2.0.1` locked versions confirmed
- `apps/blossom/deno.json` — `@nostr/tools/pure` import specifier already used in project
- `apps/relay/src/schema.ts` — DB schema; confirms `kind`, `pubkey`, `d_tag` columns for filter queries

### Tertiary (LOW confidence)
- STATE.md blocker note re: WebSocket upgrade forwarding — unresolved, classified as LOW until tested in implementation

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — all libraries already in the project or directly reusable from existing apps
- Architecture: HIGH — patterns derived from working nsyte reference and project's own established code
- Pitfalls: HIGH — derived from code analysis and PITFALLS.md from earlier research phases
- Design decisions (Claude's discretion): MEDIUM — reasoned recommendations, not independently verified against Bunny platform behavior

**Research date:** 2026-03-13
**Valid until:** 2026-04-13 (stable domain; nostr protocol and Bunny API are stable; recheck if @nostr/tools or @libsql/client has major version bumps)
