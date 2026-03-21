# Pitfalls Research

**Domain:** nsite gateway / nostr relay / blossom server on Bunny Edge Scripting
**Researched:** 2026-03-13
**Confidence:** HIGH — derived from reading actual working implementations (nostr.pub, blssm.us, nsyte/src/lib/gateway.ts) and official Bunny documentation

---

## Critical Pitfalls

### Pitfall 1: Bundle Size Creep Past 1MB Hard Limit

**What goes wrong:**
Adding a new dependency (e.g. a nostr library, a full blossom client, a crypto utility) bloats
the esbuild bundle past 1MB, which causes the Bunny Edge Script deploy to fail or behave
unpredictably. In a monorepo with three edge scripts (relay, blossom, gateway), each script
is a separate bundle subject to its own 1MB ceiling.

**Why it happens:**
Developers import a high-level library expecting tree-shaking to keep only what's used, but
CommonJS dependencies cannot be tree-shaken by esbuild. Libraries like `@libsql/client` (which
pulls in `ws`, `node-fetch`, `cross-fetch`, and polyfills) inflate bundles substantially.
nostr.pub's build.ts encodes this with a 750KB soft-warn and a 1MB hard-fail gate — the
blssm.us build.ts does not, which means it would silently exceed limits.

**How to avoid:**
- Add bundle size check to CI/CD for every package: hard-fail at 1MB, warn at 750KB.
- Use `import "@libsql/client/web"` (HTTP transport) instead of `"@libsql/client"` (which
  pulls in native binaries and WebSocket polyfills).
- Always pass `external: ["@bunny.net/edgescript-sdk"]` to esbuild — this is already handled
  correctly in both reference implementations.
- Generate and inspect the esbuild metafile (`dist/meta.json`) when the bundle grows
  unexpectedly; use it to identify the largest contributors.
- Mark non-critical libraries as `external` if Bunny provides the equivalent natively.

**Warning signs:**
- Build output shows bundle > 750KB.
- Adding a new `import` causes bundle to jump >50KB.
- Any dependency with `peerDependencies` on `ws`, `node-fetch`, or native binaries.

**Phase to address:** Bundle infrastructure phase (monorepo setup). Add the size check before
any feature work starts so it catches violations immediately.

---

### Pitfall 2: WebSocket Idle Timeout Kills Long-Lived Relay Connections

**What goes wrong:**
Bunny Edge Scripts enforce a hard 120-second idle timeout on WebSocket connections. Nostr
relay clients (e.g. NDK, nostr-tools) often hold open connections for much longer than 2
minutes with no traffic, expecting the connection to stay alive. The CDN silently closes the
socket after 120s of inactivity. Clients get a disconnect and may not reconnect, causing
subscription loss.

**Why it happens:**
Both nostr.pub and the test WebSocket handler explicitly set `idleTimeout: 120` — this is
documented as the maximum allowed by Bunny. Clients that do not implement keep-alive pings
(sending a PING frame or a `["PING"]` message) will hit this limit. Most nostr clients do not
send application-level pings on a predictable interval.

**How to avoid:**
- Document the 120s idle limit in the relay's NIP-11 document so clients are aware.
- Encourage clients to use keep-alive pings; do not advertise the relay as a "persistent"
  connection without qualification.
- The relay implementation itself cannot extend the timeout beyond 120s — this is a platform
  constraint, not a code issue.
- Do not design features (e.g. real-time event streaming) that require connections to stay idle
  for more than 90 seconds without traffic. Subscription-based use cases that produce regular
  events are fine; pure-subscribe-and-wait patterns are fragile.

**Warning signs:**
- Relay connection tests fail after exactly ~120 seconds.
- Client implementations report "connection dropped" without server error.
- Subscriptions disappear silently without a CLOSED message.

**Phase to address:** Relay implementation phase. Set `idleTimeout: 120` as the first line of
WebSocket handling and document it in NIP-11. Do not attempt to work around it.

---

### Pitfall 3: Progressive Caching Race Condition (Stale Cache Served After Background Update)

**What goes wrong:**
The gateway serves the cached file list while a background update check is running. The
background check finds a newer manifest and updates `fileListCache`, but the current request
has already committed to the old file data. On the next request, the update banner is injected
— but the new file data is served. This is correct behavior. The race condition that *is*
dangerous: two concurrent background update checks run simultaneously for the same site
because the `backgroundUpdateChecks` Map check uses an async function that can yield between
the `has()` check and the `set()`. If two requests arrive within a few milliseconds, both see
`!has(siteAddress)` as true, both start update checks, and the second may overwrite the
first's result with stale relay data (depending on which relay responds faster).

**Why it happens:**
nsyte/src/lib/gateway.ts uses `backgroundUpdateChecks.has(siteAddress)` as a non-atomic
deduplication gate. On a Bunny Edge Script, each edge node processes requests concurrently.
Because the Map check and the subsequent `set()` can be interleaved by async await points, two
simultaneous requests for the same site will both pass the gate.

**How to avoid:**
- Set the Map entry with a placeholder (e.g. a resolving Promise) synchronously before any
  `await` in the background update path. This is the standard "promise as mutex" pattern.
- The pattern to use: `backgroundUpdateChecks.set(siteAddress, promise)` before the first
  `await` within the promise body, not after.
- Alternatively, deduplicate using a synchronous flag set before the first await.
- Always remove the entry from the Map in a `finally` block (nsyte does this correctly).

**Warning signs:**
- Under concurrent load, the same site is resolved from relays more than once simultaneously.
- Cache entries flip between old and new versions when multiple users hit the site at once.
- Logs show duplicate background update checks for the same `siteAddress`.

**Phase to address:** Gateway progressive caching phase. Write a test that fires two
simultaneous requests for the same cold-cache site and verifies only one background relay
fetch occurs.

---

### Pitfall 4: HTML Injection of Update Banner Breaks Non-Standard HTML Structure

**What goes wrong:**
The update banner is injected into served HTML by inserting before `</body>`. Sites that:
(a) do not have a `</body>` tag (fragments, server-side templates, malformed HTML),
(b) have multiple `</body>` tags (common in some frameworks),
(c) serve binary content misidentified as text/html,
will either not show the banner or will corrupt the response body.

**Why it happens:**
String-matching HTML is fragile. Regex like `/(<\/body>)/i` inserts before the first `</body>`
match. If the HTML is minified, the tag may be absent. If the Content-Type is wrong, binary
data gets corrupted by the injection. The nsyte gateway.ts handles this only for the in-memory
local server context where all content is controlled; on the production edge gateway, content
comes from arbitrary user sites.

**How to avoid:**
- Only attempt injection if the response `Content-Type` is `text/html` (check before injecting).
- Use a case-insensitive search for `</body>` and inject before the last occurrence, not the
  first. Most malformed HTML puts the real `</body>` last.
- If `</body>` is not found, append the banner script at the very end of the HTML string as a
  fallback. A `<script>` tag at the end of the document (even outside `</body>`) is valid and
  rendered by all browsers.
- Never inject into non-HTML responses (images, fonts, JSON, etc.).
- Test against: no `</body>`, multiple `</body>`, `</BODY>` uppercase, gzipped content.

**Warning signs:**
- Update banner does not appear on minified HTML sites.
- Binary file downloads become corrupted when a path is misidentified as HTML.
- Sites using frameworks that emit HTML without explicit body close tags never show the banner.

**Phase to address:** Gateway progressive caching phase (banner injection). Treat this as a
hardened parser problem, not a simple string replacement.

---

### Pitfall 5: npub Subdomain Parsing Fails on Named-Site Subdomains

**What goes wrong:**
For `blog.npub1abc.nsite.run`, the subdomain structure is `[identifier].[npub].[domain]`.
A naive `host.split(".")[0]` extraction grabs `blog` and fails to find an npub. The gateway
returns 404 or routes incorrectly.

For `npub1abc.nsite.run`, the subdomain is just `npub1abc`. But if the npub contains lowercase
and is 63 characters (bech32 can be variable-length), a length check will incorrectly reject
valid npubs.

**Why it happens:**
nsyte/src/lib/gateway.ts demonstrates the correct pattern (checking if `parts[0]` starts with
`npub` vs checking if `parts[1]` starts with `npub` for named sites). The pitfall is
implementing a simpler version: `parts[0]` for everything. When `parts[0]` is an identifier
like `blog`, it does not start with `npub` and the parse fails.

**How to avoid:**
- Implement the two-step parse from nsyte's `extractNpubAndIdentifier`:
  1. If `parts[0]` starts with `npub1`: root site, npub = `parts[0]`
  2. If `parts[1]` starts with `npub1`: named site, identifier = `parts[0]`, npub = `parts[1]`
  3. Otherwise: not an nsite subdomain (route to SPA or 404)
- Use `normalizeToPubkey()` from applesauce-core/helpers to decode the npub — it handles
  invalid npubs by returning null rather than throwing.
- Validate the identifier against `/^[a-zA-Z0-9_-]+$/` before treating it as a d-tag.

**Warning signs:**
- Named sites (`blog.npub1.nsite.run`) return 404 while root sites work.
- Npubs with unusual lengths (63 or 65 chars) fail to parse.
- Identifiers containing dots (technically invalid, but possible) cause incorrect parsing.

**Phase to address:** Gateway routing phase. Write unit tests covering root site, named site,
invalid npub, and edge cases before wiring to the relay.

---

### Pitfall 6: Bunny DB / libSQL HTTP Transport — No Persistent Connections

**What goes wrong:**
`@libsql/client/web` uses HTTP transport (not WebSocket/hrana) for each query. Developers
familiar with connection-pooled databases expect a single client to reuse a connection. On
Bunny Edge Scripts, module-level state IS shared across requests on the same worker instance
(unlike AWS Lambda's per-request model), so the `createClient()` call at module level is
correct and reused. However, if code creates a new `createClient()` per request (a common
mistake when porting from Node.js patterns), each request opens a new HTTP connection, adding
latency and consuming connection quota.

Additionally, the HTTP transport does not support `BEGIN`/`COMMIT` transactions in the same
way as the native binary protocol. Use `db.batch()` for atomicity (as nostr.pub does
correctly) — raw transaction SQL over HTTP transport is unreliable.

**Why it happens:**
Developers port Node.js patterns where database clients are instantiated per-request in
serverless functions. The Bunny edge environment is closer to a long-running server, not a
serverless function.

**How to avoid:**
- Create the `Client` at module level (outside the request handler), exactly as nostr.pub's
  `main.ts` does: `const db = createDb(); const store = db ? new EventStore(db) : null;`
- Use `db.batch(statements, "write")` for multi-statement atomicity, not raw SQL transactions.
- Null-check the client at module initialization and degrade gracefully (serve health check
  without DB if credentials are missing).

**Warning signs:**
- DB query latency increases under load (new connection per request).
- Transaction failures under concurrent writes.
- `BUNNY_DB_URL` / `BUNNY_DB_TOKEN` missing from environment causes crashes instead of
  graceful degradation.

**Phase to address:** Relay phase (first DB user). Establish the pattern once, share it across
blossom and gateway if they also need DB.

---

### Pitfall 7: Cross-Script Communication Requires External HTTP Calls (Not In-Process)

**What goes wrong:**
The monorepo has three separate edge scripts: relay, blossom, gateway. A developer assumes
they can call a function in the relay from the gateway by importing the module. This is not
possible — each script is a separate process on different Bunny worker instances. There is no
shared memory, no in-process IPC.

The gateway routes WebSocket upgrades to the relay by accepting them itself and proxying — but
Bunny Edge Scripts cannot open WebSocket connections to themselves. Instead, routing must be
done via Bunny pull zone edge rules (routing certain paths to different pull zones) or the
gateway must forward via HTTP fetch to the relay's pull zone URL.

**Why it happens:**
In a local monorepo development environment, all three scripts are running locally and imports
work. The production environment has zero shared state between scripts.

**How to avoid:**
- All cross-script communication goes via the public URL: gateway forwards to
  `wss://nsite.run` (relay pull zone) or `https://nsite.run/upload` (blossom pull zone).
- Investigate Bunny pull zone edge rules for routing before defaulting to gateway-as-proxy —
  edge rules route at the CDN layer with zero code overhead.
- If using gateway-as-proxy: the gateway can pass WebSocket upgrades by doing a fetch with
  `Upgrade: websocket` header if Bunny's fetch supports it. Verify this in the feasibility
  research phase; it may not work on all edge runtimes.
- Document the routing architecture (which pull zone handles which path) before writing code.

**Warning signs:**
- Development tests pass but production routing fails silently.
- WebSocket connections upgrade on the gateway but events never reach the relay DB.
- Blossom uploads succeed at the gateway but blobs are missing from storage.

**Phase to address:** Infrastructure/routing phase. Resolve the routing strategy before
writing any cross-script feature code.

---

### Pitfall 8: Nostr Event Relay Protocol — AUTH Timing and Double-Send

**What goes wrong:**
On Bunny Edge Scripts, the WebSocket `open` event may fire after the socket is already
technically open. The nostr.pub implementation sends the NIP-42 `AUTH` challenge twice — once
in the `open` event handler and once immediately after `upgradeWebSocket()` — to handle this
edge case. Implementations that only send in the `open` handler may miss the window.

Additionally, the relay URL used in NIP-42 auth validation must match exactly what the client
sends in its `relay` tag. If the relay is behind a CDN and the `host` header shows an internal
hostname, the URL mismatch causes all clients to fail auth silently.

**Why it happens:**
Bunny Edge Script's Deno runtime may have already buffered the open event by the time the
`addEventListener("open", ...)` call is made. The nostr.pub implementation discovered this and
added the dual-send as a defensive measure. The relay URL issue comes from trusting
`request.headers.get("host")` directly without normalizing to the canonical domain.

**How to avoid:**
- Send AUTH challenge both in `open` handler and immediately after `upgradeWebSocket()`,
  wrapped in try/catch for each (the nostr.pub pattern).
- Set `RELAY_URL` as an environment variable and use that as the canonical relay URL, not the
  host header. Fall back to host header only as a last resort.
- In the URL comparison for NIP-42, compare hostnames only (not full URLs including path/port)
  to be tolerant of clients that strip the path.

**Warning signs:**
- Auth success rate is much lower than expected.
- Clients report auth failures on first connect but succeed on reconnect.
- Auth validation errors mentioning "relay URL mismatch" in logs.

**Phase to address:** Relay implementation phase. Test NIP-42 auth flows with actual nostr
clients (not just unit tests) before declaring the relay complete.

---

### Pitfall 9: Blossom Auth Event `x` Tag — Batch vs. Single-File Uploads

**What goes wrong:**
BUD-02 says the auth event's `x` tag should match the SHA-256 of the uploaded blob. nsyte
(and other batch upload clients) include multiple `x` tags in a single auth event to cover all
files in a batch upload. An implementation that only checks the first `x` tag will reject
valid batch uploads with an incorrect hash-mismatch error.

**Why it happens:**
The spec says "the `x` tag should match" — singular — but clients that do batch uploads
(uploading many files with one auth event) include multiple `x` tags. blssm.us handles this
correctly by checking all `x` tags with `xTags.some(t => t[1] === hash)`. A naive
implementation checking `xTags[0][1] === hash` breaks batch clients.

**How to avoid:**
- Use `Array.prototype.some()` to check if any `x` tag matches the uploaded blob's hash
  (exactly as blssm.us does).
- Write a test that simulates a batch upload auth event (multiple `x` tags) and verifies
  all blobs are accepted.

**Warning signs:**
- nsyte batch deploys succeed for the first file but fail for all subsequent files with
  "hash mismatch" errors.
- Integration tests pass for single-file uploads but batch deploys fail.

**Phase to address:** Blossom implementation phase. Write this test explicitly before
declaring BUD-02 compliance.

---

### Pitfall 10: SPA Secret Scanning — False Negatives on Binary and Archive Formats

**What goes wrong:**
The SPA scans uploaded ZIP/folder contents for secrets (nsec, hex private keys, etc.). The
scanner checks text-readable file content via regex. Binary files (images, compiled WASM,
minified JS) may contain byte sequences that happen to match a hex private key pattern (64
hex chars). Conversely, `.env` files inside nested ZIP archives are not scanned if the
scanner only checks the outer file list without recursively expanding archives.

**Why it happens:**
The nsyte `secret-detector.ts` detects secrets in string values (nsec, bunker URLs, hex),
which is appropriate for CLI config parsing. A web SPA scanner operating on arbitrary file
uploads must handle binary content and nested archives differently. A 64-char hex regex will
match hashes in compiled binaries (SHA-256 of image data, etc.) producing false positives.

**How to avoid:**
- Scan only text-readable files: check content-type or file extension before applying regex.
  Do not scan `.png`, `.jpg`, `.wasm`, `.woff`, etc.
- Specific dangerous filename patterns (`.env`, `id_rsa`, `id_ed25519`, `.pem`, `.key`) are
  higher-signal than content regex — prioritize filename-based detection.
- For ZIP archives, extract and scan the file list (filenames) even if not scanning content,
  to catch `.env` files nested inside.
- Accept false negatives on binary scanning rather than false positives that block legitimate
  uploads. Present warnings (not hard blocks) for content regex matches; use hard blocks only
  for specific dangerous filenames.

**Warning signs:**
- Image-heavy sites trigger false positive "secret detected" warnings on binary files.
- `.env` files inside ZIP subdirectories pass through without warning.
- Users report legitimate sites being blocked due to hash collisions in binary content.

**Phase to address:** SPA deployment phase. Write test cases with a ZIP containing a `.env`
file in a subdirectory and a WASM binary that contains a hex-pattern-like byte sequence.

---

## Technical Debt Patterns

| Shortcut | Immediate Benefit | Long-term Cost | When Acceptable |
|----------|-------------------|----------------|-----------------|
| Skip bundle size check in non-gateway scripts | Faster initial setup | Bunny deploy fails silently when a new dependency is added | Never — add size check to all three scripts from day one |
| Use `@libsql/client` instead of `@libsql/client/web` | Simpler import | Bundle bloat ~100-200KB from native binary polyfills | Never on Bunny Edge Scripts |
| Gateway proxies all traffic including relay/blossom | Simpler initial routing | Single script handles everything, harder to stay under 1MB | Acceptable in MVP if scripts stay separate and routing is purely HTTP-level |
| Hardcode relay URL in NIP-42 validation | No env var setup needed | Breaks when domain changes or behind different CDN hostname | Never — use env var from day one |
| String-replace HTML for banner injection | Simple implementation | Breaks on malformed HTML and binary files | Only acceptable if fallback (append-to-end) is also implemented |
| Single libSQL client shared across all scripts | Simple | Not applicable (correct pattern, not a shortcut) | Always do this |

---

## Integration Gotchas

| Integration | Common Mistake | Correct Approach |
|-------------|----------------|------------------|
| Bunny DB / libSQL | Calling `db.execute("BEGIN")` for transactions | Use `db.batch(statements, "write")` for atomic multi-statement writes |
| Bunny DB / libSQL | Creating `createClient()` per request | Create once at module level; reuse across requests |
| Bunny Storage API | Checking `resp.status === 200` for PUT success | Bunny Storage returns `201` for successful PUT, not `200` |
| Bunny Storage API | Listing files without trailing `/` on prefix | Directory listing requires path to end with `/` |
| Nostr relay clients | Expecting subscription state to persist across reconnects | Relay is fully stateless per NIP-01; clients must re-send REQ on reconnect |
| Blossom auth | Checking only the first `x` tag | Use `Array.some()` to check all `x` tags for batch upload compatibility |
| Blossom auth | Missing `expiration` tag handling | BUD-11: check for `expiration` tag and reject expired auth events |
| NIP-42 relay auth | Comparing full relay URL string | Compare hostnames only; clients strip paths and ports inconsistently |
| Nostr event validation | Trusting `event.id` directly from client | Always recompute `SHA-256(serialize(event))` and compare |
| esbuild + Deno | Using `https://deno.land/x/` URL imports | These are not cached by esbuild and add to startup time; use `jsr:` or npm specifiers |

---

## Performance Traps

| Trap | Symptoms | Prevention | When It Breaks |
|------|----------|------------|----------------|
| Relay query without tag-index JOIN | Slow REQ responses for tag filters (#p, #e, #d) | Index single-letter tags in a separate `event_tags` table and JOIN | At ~10K events |
| Background update check fires on every request | High relay query volume; relay rate-limits the gateway | Deduplicate with a Map of in-flight checks; only one per site at a time | At >10 concurrent users per site |
| Manifests fetched per file request | Each path request queries the relay for the manifest | Cache the full manifest (file list) keyed by `pubkey:identifier`; serve files from the cached list | At >5 req/s per site |
| Blob served directly from Bunny Storage API (not CDN URL) | High storage egress cost; slow response | Serve blob URLs via CDN pull zone, not the storage API origin | From the first request |
| libSQL query per event during REQ result iteration | Sequential queries per row | Batch-select all rows, then iterate in memory | At >100 events per filter |
| New `crypto.subtle.digest` call per served file | Minor CPU overhead | Cache SHA-256 verification result alongside file data; skip re-verify from trusted cache | At >100 req/s |

---

## Security Mistakes

| Mistake | Risk | Prevention |
|---------|------|------------|
| Not validating SHA-256 hash of downloaded blob against manifest | Serving tampered content from a compromised blossom server | Always recompute `SHA-256(blob)` and compare to manifest's path tag value before serving |
| Injecting user-controlled HTML (display name, profile picture URL) without escaping | XSS in loading page / update banner | Always escape with `escapeHtml()` on any user-controlled string in HTML context |
| Serving nsite content with permissive CORS (`Access-Control-Allow-Origin: *`) | Cross-origin attacks targeting nsite sessions | Use restrictive CORS; nsite content is served per-user on subdomain — each is a distinct origin |
| Blossom upload accepting any `Content-Type` without validation | MIME confusion attacks (serving malicious HTML as `text/html` via blob URL) | Normalize content-type; override browser sniffing with `X-Content-Type-Options: nosniff` |
| Admin endpoints without authentication | Unauthorized cache purge, content manipulation | Require `Authorization: Bearer <secret>` for all `/admin/*` routes; use env var secret |
| Not rejecting events with `created_at` far in the future | Relay polluted with phantom future events that appear in queries for years | Reject events with `created_at > now + 900` (15-minute grace is standard) |
| SPA accepts upload of `.htaccess`, `web.config`, or server config files | Server misconfiguration if gateway serves these | Block known server-config filenames by extension and name pattern |

---

## UX Pitfalls

| Pitfall | User Impact | Better Approach |
|---------|-------------|-----------------|
| Loading page with no profile information (cold cache) | Blank spinner with no context — user doesn't know whose site they're loading | Show profile (display name, avatar) fetched in parallel with manifest; fallback to npub-truncated display |
| Update banner blocks viewport or auto-navigates | Disruptive UX; breaks SPAs that manage their own routing | Banner is a subtle sticky notification with manual "click to refresh" link; never auto-navigate |
| 404 on non-HTML resources when no cache exists | Images/CSS/JS for a page that IS cached fail to load if requested before manifest resolves | Return 404 for non-HTML resources immediately (don't show loading page); show loading page only for HTML-like requests |
| No indication that the relay/blossom is nsite-only | Other nostr clients try to use the relay and get errors with no explanation | Publish a NIP-11 document that clearly states the relay only accepts kinds 15128, 35128, 10002, 10063 |
| Blossom server accepting all uploads without size limit | Storage fills up; abuse possible | Enforce `maxUploadSize` (e.g. 50MB) and return `413 Too Large` |

---

## "Looks Done But Isn't" Checklist

- [ ] **Relay NIP-11 document:** Often missing `supported_nips`, `limitation.kinds` and `limitation.auth_required` — verify these accurately reflect the nsite-only kind filter
- [ ] **Blossom BUD compliance:** BUD-06 HEAD /upload precheck and BUD-04 /mirror are easy to miss — verify server-info endpoint lists only BUDs that are actually implemented
- [ ] **Progressive caching update banner:** Appears to work in manual testing (single user) but race condition not caught — verify with concurrent requests hitting cold/warm cache
- [ ] **WebSocket relay broadcast:** New events are stored and OK returned, but not broadcast to existing subscriptions on the same connection — verify subscription matching fires after storeEvent
- [ ] **Blossom nsite-only enforcement:** Blossom accepts uploads — but does it reject blobs not referenced in any nsite manifest? The filtering logic requires a relay query per upload; easy to skip in MVP
- [ ] **SPA NIP-46 bunker auth flow:** NIP-07 integration is straightforward; NIP-46 requires a separate relay connection and signing flow — verify the bunker flow is tested end-to-end, not just the UI shell
- [ ] **Monorepo shared types:** Gateway, relay, blossom all define their own `NostrEvent` type — verify shared types package is actually imported by all three rather than duplicated
- [ ] **Cache invalidation on deleted files:** Update banner fires when files are added or changed, but may not fire when a file is deleted from the manifest — verify deletion is detected

---

## Recovery Strategies

| Pitfall | Recovery Cost | Recovery Steps |
|---------|---------------|----------------|
| Bundle exceeds 1MB | LOW | Remove offending dependency or switch to lighter alternative; CI catches on next push |
| Race condition causes stale cache served | LOW | Clear the gateway's in-memory cache; next request fetches fresh manifest |
| WebSocket relay loses connections after 120s | MEDIUM | Document the limitation; add keep-alive guidance to NIP-11; clients must reconnect |
| HTML injection corrupts binary responses | MEDIUM | Add Content-Type guard (ship as fix); cached broken responses expire naturally |
| Nostr event stored without signature verification | HIGH | Must delete and re-validate all stored events; rotate DB; announce relay reset |
| Blossom stores blob without hash verification | HIGH | Purge all blobs and re-verify from upload logs; source of truth is the SHA-256, not the stored file |
| SPA accepted and deployed a secret-containing file | HIGH | Cannot delete from blossom (content is public); contact user; revoke key; no automated recovery |

---

## Pitfall-to-Phase Mapping

| Pitfall | Prevention Phase | Verification |
|---------|------------------|--------------|
| Bundle size creep | Monorepo setup / build infrastructure | CI build fails if any package bundle > 1MB |
| WebSocket 120s idle timeout | Relay implementation | Integration test: hold open connection for 150s, verify behavior |
| Progressive caching race condition | Gateway progressive caching | Concurrent request test: 10 simultaneous hits on cold-cache site, one background fetch |
| HTML banner injection fails | Gateway progressive caching | Test suite: no-body-tag HTML, uppercase `</BODY>`, binary misidentified as HTML |
| npub subdomain parse fails | Gateway routing | Unit tests: root site, named site, invalid npub, identifier with hyphens |
| libSQL per-request client creation | Relay DB setup | Code review: `createClient()` must be at module level, not inside handler |
| Cross-script communication | Infrastructure / routing phase | End-to-end test: deploy via SPA, verify blob in blossom, event in relay, served by gateway |
| NIP-42 AUTH timing / double-send | Relay WebSocket implementation | Integration test with real nostr client (e.g. Amethyst or NDK) |
| Blossom batch `x` tag | Blossom implementation | Unit test: auth event with 3 `x` tags, verify all three blobs accepted |
| SPA secret scanner false negatives | SPA deployment phase | Test: ZIP with nested `.env`; PNG with hex-pattern bytes |

---

## Sources

- `/home/sandwich/Develop/nostr.pub/src/` — working Bunny Edge Script relay implementation;
  all Bunny platform constraints (120s WebSocket timeout, libSQL HTTP transport, bundle size
  guard) extracted from this codebase. HIGH confidence.
- `/home/sandwich/Develop/blssm.us/src/` — working Bunny Edge Script blossom implementation;
  storage API response codes, batch `x` tag handling, auth validation patterns extracted.
  HIGH confidence.
- `/home/sandwich/Develop/nsyte/src/lib/gateway.ts` — reference gateway implementation;
  progressive caching race condition, npub parsing, HTML injection, and file serving patterns
  extracted. HIGH confidence.
- Bunny Edge Scripting Limits documentation (https://docs.bunny.net/docs/edge-scripting-limits):
  CPU 30s, memory 128MB, 50 subrequests, 10MB script size, 500ms startup. MEDIUM confidence
  (script size listed as 10MB in current docs — the 1MB limit noted in the codebase comments
  may be a stricter self-imposed limit or an older constraint; the build gate at 1MB is
  retained as a conservative safety margin).
- Bunny WebSocket CDN docs (https://docs.bunny.net/docs/cdn-websockets): concurrent connection
  limits documented; idle timeout value sourced from nostr.pub code comments (`// max 120
  seconds (2-min hard limit per Bunny docs)`). HIGH confidence for the 120s limit.
- Blossom protocol BUD specifications (https://github.com/hzrd149/blossom): BUD-01 through
  BUD-11 surveyed; batch `x` tag behavior inferred from protocol and blssm.us implementation.
  HIGH confidence.

---
*Pitfalls research for: nsite gateway on Bunny Edge Scripting*
*Researched: 2026-03-13*
