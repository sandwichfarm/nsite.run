# Pitfalls Research

**Domain:** nsite gateway / nostr relay / blossom server on Bunny Edge Scripting
**Researched:** 2026-03-13 (infrastructure); 2026-03-24 (v1.4 deploy safety UX); 2026-03-25 (v1.5 deployer component extraction)
**Confidence:** HIGH — derived from reading actual working implementations (nostr.pub, blssm.us, nsyte/src/lib/gateway.ts) and official Bunny documentation; v1.4 additions derived from reading existing SPA source code and verified against MDN, Svelte issue tracker, and nostr spec; v1.5 additions derived from Svelte 4 official docs, Svelte GitHub issues, vite-plugin-svelte FAQ, and Web Component platform specs

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

## v1.4 Deploy Safety UX Pitfalls

These pitfalls are specific to adding deploy guards, optimistic delete animation, post-action
navigation, and leave confirmation to the existing Svelte 4 SPA.

---

### Pitfall 11: Deploy Guard Check Races Its Own Async Fetch

**What goes wrong:**
The deploy guard shows "this site already exists, are you sure?" only if `allSites.root` (or
the named site with matching dTag) is non-null. That data comes from `fetchSiteInfo()` which
runs after login and on mount. If the user drops files into the deploy zone before
`fetchSiteInfo()` resolves — a real scenario on slow relays — the guard shows no warning and
the user silently overwrites. The guard sees `null` (fetch still in flight) and permits the
deploy.

**Why it happens:**
`fetchSiteInfo` is fire-and-forget from `onMount`. The deploy action (`handleDeploy`) reads
`allSites` synchronously at the moment of the click. There is no wait or check for
`sitesLoading === true`. The existing code already has a `sitesLoading` boolean but it is not
consulted by the deploy path.

**How to avoid:**
- In the deploy guard check: if `sitesLoading === true`, block the deploy with a "checking
  your existing sites..." message and wait for the flag to become false before proceeding.
- Alternatively, re-run `fetchSiteInfo` on deploy button click if `allSites.root === null &&
  !sitesLoading` (to handle the edge case where the user is logged in but the fetch never ran).
- Make `sitesLoading` visible in the UI so users know a check is happening.

**Warning signs:**
- On a slow relay, the deploy proceeds with no guard warning even for an existing site.
- `sitesLoading` is true when `handleDeploy` is called.
- Console shows `[fetchSiteInfo]` completing after `[handleDeploy]` started.

**Phase to address:** Deploy guard phase. Add an explicit loading-state guard to `handleDeploy`
before reading `allSites`.

---

### Pitfall 12: Deploy Guard Shown for Wrong Site Type (Root vs. Named Mismatch)

**What goes wrong:**
A user who has a root site (kind 15128) selects "Named site" mode and enters a new dTag. The
guard incorrectly warns about overwriting the root site because `existingManifest` (which
tracks the root) is non-null. The root and named sites are independent; a new named-site deploy
should only warn if a named site with that exact dTag already exists.

**Why it happens:**
`existingManifest` is the root site manifest (backward-compat alias). A guard check against
`existingManifest !== null` fires for any existing root site regardless of whether the current
deploy is targeting a named site. The correct check is: for root deploys, check
`allSites.root !== null`; for named deploys, check `allSites.named.find(s => dTag matches)`.

**How to avoid:**
- Guard logic must branch on `siteType`:
  - `siteType === 'root'`: warn if `allSites.root !== null`
  - `siteType === 'named'`: warn only if `allSites.named.some(s => getManifestDTag(s) === dTag)`
- Never use `existingManifest` for the guard check — it is root-specific.
- Add a test: user with root site tries to deploy new named site — no guard should appear.

**Warning signs:**
- Users with a root site see an overwrite warning when deploying a brand-new named site.
- Named-site overwrite warnings do not appear when the named site already exists under a
  different dTag than the one being deployed.

**Phase to address:** Deploy guard phase. Write guard logic from scratch against `allSites`,
not `existingManifest`.

---

### Pitfall 13: Optimistic Delete Removes Item Before Relay Confirms — No Rollback Path

**What goes wrong:**
The manage view removes the site card from the list as soon as delete is confirmed, before the
kind 5 event is accepted by any relay. If all relays reject the deletion event (offline,
auth failure, rate limit), the site has been visually removed but still exists on the network.
The user has no feedback and no recovery path in the current state machine — `deleteState`
goes to `'done'` regardless of relay success.

**Why it happens:**
The existing `handleConfirmDelete` transitions to `deleteState = 'deleting'` and then
`deleteState = 'done'` regardless of relay response. The results are shown but the card is
already gone. There is no rollback to `'idle'` with the site restored on relay failure. The
`handleBackToDeploy` function dispatches `'deleted'` which triggers `fetchSiteInfo` —
eventually refetching the still-existing site — but only after the user clicks "Back to sites".

**How to avoid:**
- Do not optimistically remove the card. Instead: show a "deleting..." state on the card itself
  (spinner, disabled buttons, reduced opacity) while the operation runs. Only remove the card
  after at least one relay confirms the kind 5 event.
- If all relays fail, restore the card to full interactive state and show an inline error.
- The existing `handleBackToDeploy` → `fetchSiteInfo` path will correct the list, but users
  currently see a false empty state between completion and the re-fetch.
- Define "success" for delete the same way deploy defines it: ≥1 relay accepts the event.

**Warning signs:**
- All relay results show `success: false` but `deleteState` still goes to `'done'`.
- User sees empty manage list, then after clicking "Back to sites" the site reappears.
- Users report "I deleted my site but it still shows up" after relay connectivity issues.

**Phase to address:** Delete animation phase. Fix the success/failure logic in
`handleConfirmDelete` before adding any animation.

---

### Pitfall 14: Svelte `out:` Transition Fires Before Deletion Completes

**What goes wrong:**
Adding `out:fade` to the site card in the `{#each siteList}` block causes the card to fade out
immediately when the item is removed from `siteList`. If delete is triggered optimistically
(item removed from the array before relay confirms), the transition fires too early. If the
deletion fails and the item must be re-added, Svelte's keyed each block may not play the `in:`
transition correctly for the restored item — it treats the key as already present (from the
same render cycle).

A second issue: `animate:flip` combined with `transition:fade` on list items in Svelte 4 has a
known glitch (GitHub issue #4910) where flip positions are calculated before the fade-out
completes, causing items to "jump" to wrong positions if other items are removed concurrently.

**Why it happens:**
Svelte transitions are tied to DOM removal. When an item leaves `{#each}`, the `out:`
transition runs. There is no built-in "animate this item without removing it" for in-progress
states. The flip+fade race condition is a known Svelte 4 limitation.

**How to avoid:**
- Do not remove the item from `siteList` during deletion. Instead, track deletion state in a
  separate Map keyed by site id: `deletingIds = new Set([site.id])`. Use CSS classes to show
  "deleting" state (opacity, spinner) without triggering the Svelte transition.
- Only remove the item from `siteList` after relay confirms success — this triggers `out:fade`
  at the correct moment and gives the user accurate visual feedback.
- Avoid `animate:flip` on the same elements as `out:fade` — use one or the other, not both.
  A simple `out:fade` on removal is sufficient; flip-repositioning of remaining cards is a
  secondary concern.

**Warning signs:**
- Cards fade out before deletion is confirmed, then reappear if deletion fails.
- Remaining cards "jump" to wrong positions when one card is deleted.
- `out:` transition plays for items that were removed and re-added in the same tick.

**Phase to address:** Delete animation phase. Add a `deletingIds` Set to the component state
before touching any transition directives.

---

### Pitfall 15: `beforeunload` Dialog Silently Fails — No User Warning Shown

**What goes wrong:**
Adding `window.addEventListener('beforeunload', handler)` to warn users during in-progress
operations may silently produce no dialog, leaving users free to navigate away mid-deploy
without any warning.

Four distinct failure modes:

1. **Chrome 119+ sticky activation requirement.** The `beforeunload` handler only shows the
   dialog if the page has received prior user interaction (a click, keypress, etc.). A user
   who lands on the page and immediately drops files via drag-and-drop (drag events are not
   user activation gestures) will not trigger the dialog. Dropping a folder is a gesture, but
   whether it counts as sticky activation depends on browser version.

2. **Listener added at mount, not at trigger time.** If the `beforeunload` listener is always
   attached (from `onMount`), Chrome treats the page as permanently "dirty" and the dialog may
   fire even when no operation is in progress. If attached only when `step !== 'idle'`, the
   conditional reactive logic must be correct — a missed update leaves the listener attached
   after completion, or detaches it before the operation finishes.

3. **Custom message strings are silently ignored.** No browser since ~2016 shows custom text.
   Setting `event.returnValue = "Deploying in progress..."` has no visible effect. The user
   sees a generic browser dialog (or nothing). Do not design UX around custom message content.

4. **Mobile browsers routinely ignore `beforeunload`.** On iOS Safari and Android Chrome, the
   dialog is suppressed in many scenarios (tab switching, home button). Do not treat mobile
   `beforeunload` as reliable.

**Why it happens:**
`beforeunload` behavior has changed significantly across browser versions. Many implementations
copy older patterns that assume custom messages work or that the event always fires.

**How to avoid:**
- Attach the listener reactively: add when operation starts, remove when it ends. Use
  `onDestroy` as a safety net cleanup. Pattern: `$: if (operationInProgress) { window.addEventListener('beforeunload', handler); } else { window.removeEventListener('beforeunload', handler); }`
- In the handler, call `event.preventDefault()` AND set `event.returnValue = true` (for legacy
  support) — this is the current MDN-recommended pattern.
- Accept that the dialog is a best-effort browser feature, not a reliable safety net. Build
  a Svelte-layer in-app guard (modal dialog before the operation is fully lost) as the primary
  protection.
- Do not attach the listener before the first user interaction if possible. File drop is likely
  sufficient sticky activation, but test on actual Chrome 119+.

**Warning signs:**
- Manual test: start a deploy, try to close the tab — no dialog appears.
- Listener is attached unconditionally in `onMount` rather than conditionally.
- `event.returnValue` set to a string (custom message) instead of `true`.

**Phase to address:** Leave confirmation phase. Test the `beforeunload` listener manually in
Chrome and Firefox before considering the feature complete.

---

### Pitfall 16: Leave Confirmation Fires on Deploy/Manage Tab Switch

**What goes wrong:**
The app uses `currentPage = 'deploy' | 'manage'` tab switching via a button click. If a
`beforeunload` listener or an in-app "are you sure?" guard is attached whenever
`step !== 'idle'`, clicking "Manage" tab during the reviewing/hashing phase triggers the guard
unnecessarily. Switching tabs within the same SPA is not a destructive navigation.

Similarly, clicking "Update Site" from the success panel dispatches `'update'` which calls
`resetForUpdate()` and sets `currentPage = 'deploy'`. If a guard is watching
`deployState.step`, the step is `'success'` when the user clicks "Update Site" — not `'idle'`
— and the guard fires on what should be a harmless navigation.

**Why it happens:**
The guard condition checks `step !== 'idle'` which is true during `'reviewing'`, `'hashing'`,
`'uploading'`, `'publishing'`, `'success'`, and `'error'`. All of these states should behave
differently with respect to leave confirmation: only the in-flight states (`hashing`,
`uploading`, `publishing`) should trigger a warning.

**How to avoid:**
- Define "dangerous to leave" as a subset of states: `['hashing', 'checking', 'uploading',
  'publishing']`. Do not include `'reviewing'`, `'success'`, or `'error'`.
- For in-app tab switching: check `isDangerousStep` before showing the in-app guard. The
  `beforeunload` listener is only for actual page unloads.
- After `resetForUpdate()` resets the step to `'idle'`, the guard condition becomes false
  automatically — no special-case needed if the condition is written correctly.

**Warning signs:**
- Clicking the "Manage" tab shows a "leave confirmation" dialog during file review.
- Clicking "Update Site" from success panel shows a confirmation prompt.
- Guard fires after successful deploy when user tries to navigate away.

**Phase to address:** Leave confirmation phase. Document the exact set of steps that are
"dangerous" before writing the guard condition.

---

### Pitfall 17: Post-Action Navigation Loses Signer After `resetDeploy()`

**What goes wrong:**
After a successful deploy, the user sees the success panel with "Update Site" button. Clicking
it calls `resetForUpdate()` which intentionally does NOT clear `currentSigner` and `deployNsec`
(as noted in the code comment). However, `resetDeploy()` — the full reset path — clears
`currentSigner = null`. If post-action navigation is implemented by calling `resetDeploy()`
instead of `resetForUpdate()`, the signer is lost. The next deploy attempt then creates a new
anonymous signer, generating a new keypair and a new pubkey — the user's site identity changes.

**Why it happens:**
Two reset functions exist with different semantics. New code wiring up "back to deploy" from
the manage tab or the error state might reach for `resetDeploy()` without knowing that it
clears the signer. The existing `handleBackToDeploy` in ManageSite dispatches `'deleted'` and
the parent calls `fetchSiteInfo` — it does not reset the deploy state at all.

**How to avoid:**
- Audit every "back to deploy" / "start over" / "navigate to deploy" path and determine
  whether it should call `resetForUpdate()` or `resetDeploy()`.
- After a successful deploy: use `resetForUpdate()` — signer preserved, deploy state cleared.
- After a full logout or explicit "start fresh" action: use `resetDeploy()` — signer cleared.
- After a delete: do not reset deploy state at all, only refresh site list.
- Document this distinction in a code comment at both functions.

**Warning signs:**
- After clicking "Update Site", the user's pubkey changes on the next deploy.
- A new nsec appears in the success panel for a user who was previously authenticated via NIP-07.
- `currentSigner` is null when `handleDeploy` runs after navigating from success panel.

**Phase to address:** Post-action navigation phase. Add a test: deploy as NIP-07 user, click
"Update Site", verify `$session.pubkey` is unchanged and `currentSigner` is non-null.

---

### Pitfall 18: Relay List Staleness Causes Deploy Guard to Miss Existing Sites

**What goes wrong:**
The deploy guard uses `allSites` which is populated by `fetchSiteInfo`, which queries relays
from `[NSITE_RELAY, ...userRelays, ...DEFAULT_RELAYS]`. If the user's NIP-65 relay list
(kind 10002) hasn't been fetched yet (the `fetchUserServers` call is also async and races with
`fetchSiteInfo`), the guard queries only the default relay. If the user's existing site manifest
was published to a different relay (e.g., from the nsyte CLI), the guard does not find it and
shows no warning.

**Why it happens:**
`fetchUserServers(pubkey)` and `fetchSiteInfo(pubkey)` are both called from the same `onMount`
block. `fetchUserServers` populates `userRelays`; `fetchSiteInfo` reads `userRelays`. Both are
fire-and-forget. If `fetchSiteInfo` runs first (likely, since it does not await relay list
discovery), it uses an empty `userRelays` array and may miss the authoritative relay.

**Why this matters specifically for v1.4:**
The deploy guard in v1.3 and earlier did not need to be accurate because there was no guard. In
v1.4, a false-negative guard (no warning shown) means the user accidentally overwrites a site
published via CLI. This is the opposite of what the guard is supposed to prevent.

**How to avoid:**
- Sequence `fetchSiteInfo` after `fetchUserServers` completes (or at least attempt both and
  re-run `fetchSiteInfo` after the relay list resolves).
- Use a wide relay list for guard checks: always include NSITE_RELAY and DEFAULT_RELAYS in
  addition to user-specific relays, since NSITE_RELAY caches manifests from all deployed sites.
- Since `NSITE_RELAY` mirrors all manifests published through nsite.run, checking it first
  should catch most cases. Add a note that CLI-deployed sites on private relays only will not
  be detected.

**Warning signs:**
- `userRelays` is empty when `fetchSiteInfo` runs.
- User has a site published via nsyte CLI to a private relay — guard does not warn.
- `fetchSiteInfo` called before `userRelays` is populated.

**Phase to address:** Deploy guard phase. Verify that `fetchSiteInfo` uses at minimum
`[NSITE_RELAY, ...DEFAULT_RELAYS]` even before the user's relay list resolves.

---

### Pitfall 19: `deleteState === 'done'` Matches Both Success and Error in Template

**What goes wrong:**
The ManageSite template has a condition `{:else if deleteState === 'done' || (deleteState === 'deleting' && deleteStep === 'done')}` which renders the results panel. If an error was thrown and caught, the code transitions to `deleteState = 'done'` with a fake error entry in `deleteResults.relayResults`. The user sees "Deletion complete" in the header with a red failure entry in the list — a contradictory UI.

More importantly, when `deleteState === 'done'` and all relay results show failure, the
"Back to sites" button dispatches `'deleted'` which triggers `fetchSiteInfo`. This is correct
(it refreshes the list). However, the label "Deletion complete" is misleading when nothing was
deleted.

**Why it happens:**
The state machine collapses partial success and total failure into the same `'done'` state.
There is no `'failed'` state distinct from `'done'`. The catch block in `handleConfirmDelete`
uses the same `deleteState = 'done'` transition as the success path.

**How to avoid:**
- Add a `deleteSuccess` boolean (or separate `deleteError` message) to distinguish total
  failure from success in the done state.
- Change the header text: "Deletion complete" when ≥1 relay accepted; "Deletion failed" (or
  "Partial deletion") when all relays rejected.
- The "Back to sites" button should be present in both cases — it triggers the re-fetch which
  corrects the list either way.

**Warning signs:**
- All relay results show failure but header says "Deletion complete".
- User sees green checkmark header over a list of red X results.

**Phase to address:** Delete animation / state machine polish phase. Address before adding
visual animations — animations on top of incorrect state are harder to debug.

---

## v1.5 Deployer Component Extraction Pitfalls

These pitfalls are specific to extracting the deployer into a standalone Svelte component
package (`packages/deployer`) and wrapping it as a Web Component / custom element bundle.

---

### Pitfall 20: Svelte Module-Level Stores Become Singletons Shared Across All Instances

**What goes wrong:**
The current SPA uses module-level stores (`session`, `deployState`, `serverConfig`) imported
from `./lib/store.js`. When the deployer is extracted into a package and two instances of the
component are mounted on the same page (or the same bundle is loaded twice), all instances
share the same store objects. One instance's state bleeds into another. For the Web Component
use case — where the component may appear multiple times on a nostr site — this is a
correctness failure: user A's session visible to user B's deployer instance.

**Why it happens:**
ES module semantics: a module is evaluated once per module graph. The store singleton is
intentional within a single SPA context, but breaks when the same module is consumed by
multiple independent component instances. The Svelte 4 issue tracker confirms this is a
known multi-instance problem with no built-in solution.

**How to avoid:**
- Do not use module-level global stores inside `packages/deployer`. Instead, create stores
  inside the component itself or use Svelte context (`setContext`/`getContext`) to scope them
  to the component tree.
- For the Svelte component consumer: accept state via props and emit changes via events.
  The consumer owns the stores; the deployer component is stateless by default.
- For the Web Component consumer: instantiate fresh state in the custom element's class
  constructor, not at module scope. Each custom element instance gets its own state.
- Pattern: `const deployState = writable({ step: 'idle', ... })` inside `<script>` of the
  component, not in an imported module.

**Warning signs:**
- Two deployer instances on the same page share authentication state.
- Logging in on one deployer instance logs in the other.
- `session` store is imported from a shared module path, not created per-component.

**Phase to address:** Core lib extraction phase. Audit all module-level state before extracting
any code to `packages/deployer`. Stores must move inside components or be scoped via context.

---

### Pitfall 21: `createEventDispatcher` Events Do Not Cross Shadow DOM Boundaries

**What goes wrong:**
The existing SPA components use `createEventDispatcher()` to emit events: `DeployZone` emits
`'files-selected'`; `ManageSite` emits `'deleted'` and `'back-to-deploy'`. When the deployer
is compiled as a custom element with a shadow root, these dispatched events are created without
`composed: true`. Shadow DOM events without `composed: true` stop at the shadow root boundary
and are invisible to the host document. Any parent component listening with `on:files-selected`
or JavaScript `addEventListener('files-selected', ...)` on the custom element will receive
nothing.

**Why it happens:**
`createEventDispatcher` creates a CustomEvent with `bubbles: false` and `composed: false` by
default. The Web Platform spec requires `composed: true` for events to cross shadow DOM
boundaries. This is documented in Svelte GitHub issue #3327 and confirmed as a known
limitation of the Svelte 4 API.

**How to avoid:**
- For events that must cross shadow DOM boundaries (the deployer's top-level custom element),
  do not use `createEventDispatcher`. Instead, dispatch native CustomEvents with
  `{ bubbles: true, composed: true }` directly on `this` (the custom element host).
- Internal component-to-component communication within the deployer (between `DeployZone` and
  the parent deployer component) can continue using `createEventDispatcher` — these events
  never cross the shadow boundary.
- For the prop-based API: consider replacing event emission with callback props
  (`on:deploy={handler}` → `export let onDeploy = undefined`) for top-level events.

**Warning signs:**
- Custom element mounted on a host page: no events received by the host even when deploy completes.
- `element.addEventListener('deploy-complete', ...)` fires nothing.
- Events work fine inside the Svelte app but stop working after Web Component compilation.

**Phase to address:** Web Component wrapper phase. Test shadow DOM event propagation with a
minimal harness before wiring up the full deploy flow.

---

### Pitfall 22: Tailwind CSS Classes Are Invisible Inside Shadow DOM

**What goes wrong:**
The SPA uses Tailwind CSS 3 with a global stylesheet (`app.css` containing `@tailwind base/components/utilities`). When the deployer is compiled as a custom element with shadow DOM, the shadow root gets a fresh, isolated CSS scope. The global Tailwind stylesheet is in `document.head` — outside the shadow root — and has no effect on elements inside the shadow root. Every Tailwind class in every deployer component renders unstyled.

**Why it happens:**
Shadow DOM's CSS encapsulation is absolute: external stylesheets do not penetrate into shadow
roots. Svelte's custom element compiler inlines component-scoped styles into the shadow root,
but Tailwind utilities are generated globally, not per-component. The Svelte compiler cannot
inline a utility it does not know is used by that specific component.

**How to avoid:**
Two strategies, each with trade-offs:

1. **Shadow: none.** Set `shadow: 'none'` in `<svelte:options customElement={{ shadow: 'none' }}>` to forgo shadow DOM. Global Tailwind styles apply. CSS encapsulation is lost (host page styles can bleed in), but for a deployer modal with a well-defined DOM structure this is acceptable. Slots do NOT work with `shadow: 'none'` — design accordingly.

2. **Inject Tailwind into shadow root.** In the root deployer component, inject the full compiled Tailwind CSS as a `<style>` tag inside the shadow root. This adds ~20-30KB of CSS per instance and requires a two-step build: compile Tailwind first, then inline the result.

**Recommendation:** Use `shadow: 'none'` for the Web Component wrapper. The deployer will be
embedded in nsites that nsite.run controls (like @nsite/stealthis patterns), where CSS bleed is
acceptable. Document that consumers must not have conflicting Tailwind utility names.

**Warning signs:**
- Custom element appears in the browser with no styling, just raw HTML structure.
- DevTools shows the shadow root has no stylesheet other than Svelte's component-scoped rules.
- `bg-blue-500`, `flex`, `rounded` etc. have no visual effect inside the component.

**Phase to address:** Web Component wrapper phase. Validate CSS strategy in a throwaway harness
before building out the full modal UI.

---

### Pitfall 23: Svelte Component Lifecycle (`connectedCallback`) Delays Prop Availability

**What goes wrong:**
When a custom element is used as `<nsite-deployer signer="...">` and the host page sets
properties before inserting the element into the DOM, the Svelte inner component does not yet
exist. Svelte defers inner component creation until the next microtask tick after
`connectedCallback` fires. Properties set before DOM insertion are queued internally, but
functions exported by the component (`$set`, etc.) cannot be called until after mount.

This also affects prop reactivity: if the host page script sets `element.signer = signerObject`
immediately after `document.createElement('nsite-deployer')` but before `document.body.appendChild(element)`, the prop is buffered. If the host page then immediately calls an exported method expecting the signer to be available, the inner component has not yet initialized.

**Why it happens:**
The Svelte 4 custom element wrapper explicitly defers inner component instantiation to the
next tick after `connectedCallback`. This is documented in the official Svelte 4 custom
elements API docs. Developers copy patterns from React/Vue where props passed in constructor
are immediately available.

**How to avoid:**
- Never call exported methods on a custom element in the same synchronous task as element
  creation. Use `await Promise.resolve()` or `requestAnimationFrame` to yield to the microtask
  queue first.
- Design the deployer API to not require method calls after creation. Props set before DOM
  insertion are preserved; use props for all initial configuration.
- For the `signer` prop: accept it reactively and re-initialize auth state whenever it changes,
  not just on mount. Use a reactive declaration `$: if (signer) { initAuth(signer); }`.

**Warning signs:**
- Exported methods return `undefined` when called immediately after creating the element.
- `signer` prop appears to be ignored on first render but works after user interaction.
- console.error "Cannot call method on unmounted component" in Web Component context.

**Phase to address:** Core lib extraction phase. Design the component API around props and
reactive declarations, not imperative method calls.

---

### Pitfall 24: Vite Library Build Does Not Externalize Svelte Automatically

**What goes wrong:**
When building `packages/deployer` as a Vite library (for the Svelte component output), Svelte
itself must be externalized — the consuming SPA already has Svelte in its `node_modules` and
bundling a second copy causes version conflicts, double-registration of stores, and incorrect
lifecycle behavior. The symptom is subtle: the deployer component appears to work but reactivity
breaks intermittently or the component cannot be destroyed.

For the IIFE / Web Component bundle, the opposite is true: Svelte internals MUST be bundled in,
because the bundle is self-contained and loaded on arbitrary pages without a Svelte environment.

**Why it happens:**
Vite library mode does not automatically externalize peer dependencies. Without explicit
`rollupOptions.external: ['svelte', 'svelte/internal', 'svelte/store']`, the entire Svelte
runtime is bundled into the distributable. The community plugin `vite-plugin-externalize-deps`
exists specifically to address this gap, but is not included in default Svelte setups.

**How to avoid:**
- For the ESM Svelte component output: set `rollupOptions.external` to include `svelte`,
  `svelte/store`, `svelte/transition`, `svelte/animate`, `svelte/easing`, and all direct
  dependencies already present in the SPA. Generate two separate Vite configs: one for the
  ESM library (external Svelte) and one for the IIFE Web Component (bundled Svelte).
- Verify externalization by checking the ESM output: `import { ... } from 'svelte'` should
  appear in the dist file, not inlined Svelte internals.
- Check bundle output with: `vite build --reporter=verbose` and inspect the dist size. If the
  ESM output is >200KB, Svelte is being bundled.

**Warning signs:**
- ESM deployer import causes "Invalid hook call" equivalent — two Svelte runtimes active.
- `$session` store updates in the deployer do not propagate to the SPA, or vice versa.
- ESM dist file is >300KB (should be <50KB for the component code alone).
- `Cannot read properties of undefined (reading 'ctx')` errors in the component.

**Phase to address:** Package extraction phase. Write and validate both vite configs (ESM
library + IIFE Web Component) before writing any component code.

---

### Pitfall 25: `package.json` `exports` Field Missing `svelte` Condition Breaks Consumer Config

**What goes wrong:**
When a Svelte component library is published, consumers using `@sveltejs/vite-plugin-svelte`
expect the package to declare a `svelte` export condition in `package.json`. Without it, the
plugin falls back to the `main` or `module` fields which point to pre-compiled JS — the
consumer cannot process the `.svelte` source files, losing HMR, type checking, and
pre-process pipeline integration.

The `svelte` field at top level of `package.json` (the old format) is deprecated and triggers
a warning in `vite-plugin-svelte` 3.x. Failing to migrate causes downstream consumers to see
a noisy warning and may break in a future major.

**Why it happens:**
There are two distinct `exports` targets for a Svelte component library:
1. The `.svelte` source files (for Svelte consumers who want to compile themselves)
2. The pre-compiled JS output (for non-Svelte consumers or bundlers that can't handle `.svelte`)

Getting the conditional exports structure right — with `"svelte"` condition mapping to
`.svelte` files and a `"default"` mapping to compiled output — is non-obvious and not shown
in basic Vite library templates.

**How to avoid:**
- Use the current official pattern from the SvelteKit packaging docs:
  ```json
  {
    "exports": {
      ".": {
        "types": "./dist/index.d.ts",
        "svelte": "./src/lib/index.js",
        "default": "./dist/index.js"
      }
    }
  }
  ```
- Remove the legacy `"svelte": "src/lib/index.js"` top-level field once the `exports` condition
  is in place. Keep it temporarily for backwards compatibility if needed.
- Run `publint` (https://publint.dev) on the built package before use — it catches common
  `exports` field mistakes.

**Warning signs:**
- `vite-plugin-svelte` emits "WARNING: The following packages have a svelte field in their
  package.json but no exports condition for svelte" when the SPA builds.
- Importing `@nsite/deployer` in the SPA resolves to `.js` (pre-compiled) instead of `.svelte`
  (source), breaking HMR and Svelte-specific processing.
- TypeScript cannot find component types.

**Phase to address:** Package extraction phase. Set up `package.json` exports before writing
any component code, and validate with `publint` as part of the build.

---

### Pitfall 26: NIP-07 `window.nostr` Is a Global — Available Everywhere, Not Shadow-DOM-Scoped

**What goes wrong:**
This is a non-pitfall that is often treated as one: `window.nostr` is a property of the
global `window` object, not the document or shadow DOM. It is accessible from inside a shadow
root's JavaScript the same as from anywhere else. NIP-07 extension injection works identically
in Web Component contexts.

The actual pitfall is assuming `window.nostr` is available synchronously at component init
time. Browser extensions inject `window.nostr` via `document_end` script injection, which runs
after the page DOM is parsed but potentially before or after custom element constructors run,
depending on when the element is defined and appended. Code that checks `window.nostr` in the
component's module initialization (before `connectedCallback`) may see `undefined` if the
component is defined and instantiated via JS before the extension has injected.

**How to avoid:**
- Check `window.nostr` lazily at the time the user clicks "Login with Extension", not at
  component init time. The current `createExtensionSigner()` pattern already does this correctly.
- For the optional `signer` prop: if `signer` is provided externally, skip the `window.nostr`
  check entirely. The prop-based API is the primary path for Web Component embedding.
- Do not attempt to detect NIP-07 availability at custom element constructor time.

**Warning signs:**
- `window.nostr` appears `undefined` at component startup but is available after a delay.
- NIP-07 login works in the SPA but not in the Web Component — likely a timing issue,
  not a shadow DOM issue.

**Phase to address:** Core lib extraction phase. Document that `window.nostr` is checked at
login action time, never at initialization.

---

### Pitfall 27: `WebCrypto` (`crypto.subtle`) Is Only Available in Secure Contexts

**What goes wrong:**
The deployer uses `crypto.subtle.digest` for SHA-256 hashing in `hashFile()`. When the Web
Component bundle is embedded in an nsite served over HTTP (not HTTPS), `crypto.subtle` is
`undefined`. The component silently fails to hash files, and the deploy produces 0-byte uploads
or throws `TypeError: Cannot read properties of undefined (reading 'digest')`.

**Why it happens:**
The Web Cryptography API is restricted to secure contexts (HTTPS or localhost) per the
W3C spec. nsite.run itself is always HTTPS, but nsites deployed via the Web Component could
be embedded in non-HTTPS contexts (local dev servers, plain HTTP mirrors).

**How to avoid:**
- Add a startup check in the deployer: if `typeof crypto === 'undefined' || !crypto.subtle`,
  show an error state ("This component requires a secure context (HTTPS)") rather than
  attempting to deploy.
- The error should be surfaced at the file-selection step, before hashing begins, not as an
  uncaught exception mid-deploy.
- For local dev harness: always use `https://localhost` or the `localhost` exception (which
  qualifies as a secure context per spec).

**Warning signs:**
- `hashFile()` throws `TypeError` on first use.
- `crypto.subtle` is `undefined` in the console.
- Only fails when component is embedded in HTTP (not HTTPS) page.

**Phase to address:** Core lib extraction phase. Add secure context guard to the component
initialization path. Test in HTTP context explicitly.

---

### Pitfall 28: RelayPool Is a Long-Lived Singleton — Leaks Across Web Component Remounts

**What goes wrong:**
The current SPA initializes `RelayPool` lazily as a module-level singleton via `getRelayPool()`
in `nostr.js`. When the deployer Web Component is mounted, used, then removed from the DOM and
re-mounted (common in single-page embed patterns), the RelayPool accumulates open WebSocket
connections that are never closed. After 3-4 mount/unmount cycles, the page has multiple stale
relay connections, some of which may still fire events into the unmounted component's callbacks.

**Why it happens:**
Module-level singletons persist for the lifetime of the JavaScript module, not the lifetime of
the component. When the component is destroyed (`onDestroy`), the RelayPool is not cleaned up
because it lives outside the component. Svelte's `onDestroy` cleanup does not automatically
reach module-scope resources.

**How to avoid:**
- For the Web Component: do not use a module-level RelayPool singleton. Create the pool inside
  the custom element class and close all connections in `disconnectedCallback`.
- For the Svelte component (used inside the SPA): a single long-lived pool is fine since the
  SPA never unmounts the component. The pool should still be closed in `onDestroy` if the
  component can be conditionally rendered.
- Pattern: `onDestroy(() => { pool.close(); })` — ensure all relay connections are closed when
  the deployer unmounts.

**Warning signs:**
- Browser DevTools Network tab shows WebSocket connections accumulating after component remounts.
- Events fire from "destroyed" component instances (callbacks still attached to relay subscriptions).
- Memory grows steadily with each mount/unmount cycle.

**Phase to address:** Web Component wrapper phase. Add `disconnectedCallback` cleanup to the
custom element wrapper before shipping.

---

### Pitfall 29: Dual Build Configs Have Divergent Compiler Options — Unexpected Behavior Differences

**What goes wrong:**
The deployer requires two Vite build configs: one for the ESM Svelte component output (with
`customElement: false`) and one for the IIFE Web Component output (with `customElement: true`).
If the ESM build accidentally gets `customElement: true`, the component compiles as a custom
element class instead of a standard Svelte component — breaking imports in the SPA. If the
IIFE build accidentally gets `customElement: false`, the bundle exports a Svelte component
that requires the Svelte runtime to mount, defeating the self-contained Web Component goal.

The Svelte compiler also changes behavior in `customElement` mode for slots: slot content
renders eagerly (not lazily), and `$$slots` detection at the component root does not work as
expected. Code that conditionally renders based on `$$slots` will behave differently in custom
element mode versus component mode.

**Why it happens:**
Two different build configurations for the same source files is inherently fragile. A change
to one config that should apply to both can be missed. The Svelte `customElement` option is
global per build — there is no per-file override in Vite plugin config (though `<svelte:options
customElement="...">` per-file annotation does work if `customElement: true` is set globally).

**How to avoid:**
- Name the build configs explicitly: `vite.config.lib.js` (ESM, no customElement) and
  `vite.config.wc.js` (IIFE, customElement).
- Add a build script that runs both configs in sequence and verifies outputs: ESM should
  contain `import { ... } from 'svelte'`; IIFE should not.
- Write a brief integration test for each output format: import the ESM into a test Svelte
  component; load the IIFE via `<script>` in an HTML file; verify both render correctly.
- Avoid `$$slots`-based conditional rendering in components that will be compiled as custom
  elements. Use explicit props (`showFooter: boolean`) instead.

**Warning signs:**
- SPA build fails after importing ESM deployer: "Expected Svelte component but got custom element class".
- IIFE bundle throws "SvelteComponent is not a constructor" when loaded standalone.
- Component renders differently when imported as ESM vs. loaded as Web Component (slot vs.
  non-slot rendering).

**Phase to address:** Package extraction phase. Validate both build outputs before writing
component code that relies on build-specific behavior.

---

### Pitfall 30: Anonymous Signer `sessionStorage` Key Collides When Multiple Deployer Instances Run

**What goes wrong:**
The current anonymous signer persists the private key to `sessionStorage` under the hardcoded
key `'nsite_anon_key'`. When multiple deployer instances are on the same page (or when the
deployer Web Component is embedded alongside the SPA), they share the same sessionStorage key.
Instance B reads and overwrites instance A's private key. The user's anonymous identity — and
their deployed site's pubkey — silently changes between page visits.

**Why it happens:**
`sessionStorage` is origin-scoped (same as `localStorage`), not component-scoped. The key
`'nsite_anon_key'` is a module-level constant that all instances share. This is fine in a
single-SPA context where only one deployer exists, but breaks in multi-instance embedding.

**How to avoid:**
- Accept an `instanceId` prop on the deployer component. Use it to namespace the sessionStorage
  key: `'nsite_anon_key_' + instanceId`.
- Default to a single default ID (e.g. `'default'`) for the SPA case (backwards compatible).
- Document that callers deploying multiple instances must provide distinct IDs.
- For the Web Component: generate the instanceId from the element's position or a provided
  `id` attribute.

**Warning signs:**
- Two deployer components on the same page show the same anonymous pubkey.
- After one deployer generates a new key, the other's active session pubkey changes.
- Deployed site URL changes unexpectedly between sessions when two instances have been used.

**Phase to address:** Core lib extraction phase. Parameterize the sessionStorage key before
extracting the signer utilities into the package.

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
| Using `existingManifest` for deploy guard check | Re-uses existing variable | Fires for wrong site type; breaks named-site deploy flow | Never — use `allSites` directly |
| Attaching `beforeunload` in `onMount` unconditionally | Simple setup | Fires on every tab close even when no operation is running; Chrome may suppress it | Never — attach/detach reactively |
| Calling `resetDeploy()` for all back-to-deploy paths | Simple, one function | Clears signer, causing new anonymous keypair on next deploy | Never — use `resetForUpdate()` when signer should persist |
| Module-level stores in deployer package | Simplest refactor (copy existing pattern) | All instances on same page share state; multi-instance embed is broken by design | Never in library code — stores must be component-scoped or context-scoped |
| Single `customElement: true` vite config for all outputs | One config to maintain | ESM output is wrong type for Svelte consumers; breaks SPA import | Never — maintain separate ESM and IIFE configs |
| Hardcoded `'nsite_anon_key'` sessionStorage key | No code change needed | Multi-instance collision; second deployer overwrites first's key | Never in library — always parameterize storage keys |
| Shadow DOM with Tailwind (no injection) | No Tailwind CSS setup needed | All Tailwind classes invisible inside shadow root | Never if component uses Tailwind — must either inject CSS or use `shadow: 'none'` |
| Not externalizing Svelte in ESM library build | Simpler build config | Double Svelte runtime in consuming app; subtle reactivity breakage | Never — always externalize Svelte in ESM library build |

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
| NIP-09 kind 5 deletion | Assuming all relays honor deletion requests | NIP-09 is advisory — relays SHOULD delete but are not required to. Treat as best-effort. |
| Blossom DELETE | Creating auth event and waiting before sending | NIP-98 auth events have a ~60-120s validity window; create and send immediately |
| Svelte `{#each}` transitions | Using `animate:flip` and `out:fade` together | They conflict; use one or the other; for item deletion, `out:fade` alone is sufficient |
| Svelte custom element events | Using `createEventDispatcher` for top-level events | Use native `new CustomEvent(name, { bubbles: true, composed: true })` for events that must cross shadow root |
| Svelte custom element + Tailwind | Default shadow DOM config with global stylesheet | Use `shadow: 'none'` or inject compiled CSS into the shadow root as a `<style>` tag |
| Vite library build | Not listing `svelte` in `rollupOptions.external` | Always externalize Svelte (and its subpackages) for ESM library output; never for IIFE output |
| package.json exports | Top-level `"svelte"` field (legacy) | Use `"svelte"` export condition inside the `"exports"` map — validate with publint |
| NIP-07 in Web Component | Checking `window.nostr` at constructor/module init time | Check lazily at login action time; extension injects after page parse, not before |
| RelayPool in Web Component | Module-level singleton that outlives the element | Create pool inside the custom element class; close in `disconnectedCallback` |
| sessionStorage in multi-instance | Hardcoded storage key shared by all instances | Parameterize key with `instanceId` prop; default to `'default'` for single-instance SPA |

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
| `fetchSiteInfo` called on every deploy/manage tab switch | Unnecessary relay queries on tab click | Call once on login/mount; only re-call after deploy or delete operations complete | From first user interaction |
| IIFE Web Component bundle too large for embedding | Slow page load on nsite-hosted pages (no CDN for the bundle) | Tree-shake aggressively; externalize common nostr deps if consumer page already loads them | If bundle > 150KB gzipped |
| Tailwind CSS fully injected into shadow root per instance | Multiple deployer instances each load ~25KB of CSS | Use `shadow: 'none'` (one global stylesheet shared); or inject once into document.head and ref from shadow | With >1 instance on the page |

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
| Anonymous nsec in sessionStorage not cleared after Web Component unmount | Private key outlives component, visible to other page scripts | On `disconnectedCallback`, clear `sessionStorage.removeItem(anonKeyStorageKey)` unless `persistKey` prop is set |
| Web Component iframe-embedded in HTTP context accesses `crypto.subtle` | Fails silently or throws; also violates mixed-content if component makes HTTPS fetches | Detect non-secure context at startup and refuse to operate; show explicit error |

---

## UX Pitfalls

| Pitfall | User Impact | Better Approach |
|---------|-------------|-----------------|
| Loading page with no profile information (cold cache) | Blank spinner with no context — user doesn't know whose site they're loading | Show profile (display name, avatar) fetched in parallel with manifest; fallback to npub-truncated display |
| Update banner blocks viewport or auto-navigates | Disruptive UX; breaks SPAs that manage their own routing | Banner is a subtle sticky notification with manual "click to refresh" link; never auto-navigate |
| 404 on non-HTML resources when no cache exists | Images/CSS/JS for a page that IS cached fail to load if requested before manifest resolves | Return 404 for non-HTML resources immediately (don't show loading page); show loading page only for HTML-like requests |
| No indication that the relay/blossom is nsite-only | Other nostr clients try to use the relay and get errors with no explanation | Publish a NIP-11 document that clearly states the relay only accepts kinds 15128, 35128, 10002, 10063 |
| Blossom server accepting all uploads without size limit | Storage fills up; abuse possible | Enforce `maxUploadSize` (e.g. 50MB) and return `413 Too Large` |
| Deploy guard shown for every deploy (even fresh) | Unnecessary friction for new users | Only show guard when the target site type + identifier already exists in `allSites` |
| Deploy guard check blocks indefinitely while relay is slow | User cannot deploy | Show guard only after `sitesLoading` resolves; use a timeout (e.g., 5s) and proceed with a warning if relays don't respond |
| "Deletion complete" shown when all relays rejected | Misleads user into thinking site was deleted when it wasn't | Check relay results before setting header text; use distinct states for success vs. failure |
| Web Component with no `signer` prop showing full auth flow | Embedding site's UX interrupted by login modal for a feature the user didn't explicitly invoke | Default to showing a "Deploy your nsite" button; only show auth flow after explicit user interaction |
| Web Component showing unstyled content flash before CSS loads | Layout shift and jarring visual on embed | Bundle all necessary CSS into the component; avoid external CSS dependencies |

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
- [ ] **Deploy guard for named sites:** Guard fires correctly when overwriting existing named site with same dTag — verify with a user who has both root AND named sites
- [ ] **Deploy guard skips correctly when no existing site:** New user with no sites should never see the guard — verify with freshly created anonymous keypair
- [ ] **Leave confirmation cleanup:** `beforeunload` listener removed after deploy completes — verify no listener leak by deploying, completing, then closing tab normally
- [ ] **Delete state machine success/failure:** "Deletion complete" header only shown when ≥1 relay accepted kind 5 — verify with relays set to reject
- [ ] **Post-action navigation signer preservation:** Clicking "Update Site" from success panel keeps `currentSigner` and same pubkey — verify `$session.pubkey` unchanged
- [ ] **`beforeunload` dialog appears:** Manual test in Chrome and Firefox — start upload, immediately try to close tab — generic browser dialog must appear
- [ ] **ESM library does not bundle Svelte:** Import `@nsite/deployer` in a test Svelte project — check that only one copy of Svelte is loaded (DevTools Sources, search for duplicate svelte/internal)
- [ ] **IIFE Web Component is self-contained:** Load only the IIFE script in a plain HTML file with no other dependencies — component must mount and function without any additional imports
- [ ] **Shadow DOM event propagation:** Custom element events fired from inside the deployer reach `addEventListener` on the element reference in the host page — test with `composed: true` events
- [ ] **Web Component CSS visible:** Deployer renders with correct Tailwind styles when embedded via `<script>` tag on a page that has no Tailwind — verify `shadow: 'none'` or CSS injection strategy
- [ ] **RelayPool cleanup on unmount:** Remove `<nsite-deployer>` from DOM, re-append it — verify DevTools Network shows no accumulating WebSocket connections
- [ ] **Secure context guard visible:** Load IIFE bundle on HTTP page — verify component shows error state, does not crash with `crypto.subtle` TypeError
- [ ] **sessionStorage key isolation:** Mount two deployer instances with different `instanceId` — verify separate anonymous keys, no cross-contamination
- [ ] **SPA still works after extraction:** After `packages/deployer` extraction and SPA refactored to use it — all existing SPA features (deploy, manage, delete, NIP-07, NIP-46) work identically

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
| Deploy guard check missed site (relay timeout) | LOW | User over-wrote their site; re-deploy correct version; no data lost beyond previous version |
| Signer cleared by wrong reset function | MEDIUM | User must re-authenticate; anonymous users must re-import their nsec |
| Delete succeeded but UI shows wrong state | LOW | User clicks "Back to sites" → `fetchSiteInfo` re-queries relay and corrects list |
| Module-level store singleton in deployed package | HIGH | Requires package refactor; all consumers must update; state isolation cannot be patched at runtime |
| Svelte bundled twice (ESM library build) | MEDIUM | Rebuild with correct external config; no runtime data loss but reactivity may have corrupted state |
| RelayPool connections leaked across remounts | MEDIUM | Reload the page (clears module singletons); ship fix adding `disconnectedCallback` cleanup |
| Shadow DOM CSS invisible | LOW | Switch to `shadow: 'none'` in `<svelte:options>`; rebuild; no data loss |
| Web Component events not reaching host | MEDIUM | Re-implement top-level events as native CustomEvents with `composed: true`; rebuild |

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
| Deploy guard races fetchSiteInfo | Deploy guard phase | Test: drop files immediately after login; verify guard blocks until `sitesLoading` clears |
| Deploy guard wrong site type | Deploy guard phase | Test: user with root site deploys new named site — no warning; same dTag — warning shown |
| Optimistic delete no rollback | Delete animation phase | Test: all relays reject kind 5; verify card restored and error shown |
| Svelte transition fires too early | Delete animation phase | Test: delete fails; card must not have faded out |
| `beforeunload` dialog silent | Leave confirmation phase | Manual test in Chrome and Firefox: start upload, try to close tab |
| Leave confirmation fires on tab switch | Leave confirmation phase | Test: during file review, click Manage tab — no dialog should appear |
| Post-action nav clears signer | Post-action navigation phase | Test: NIP-07 deploy → "Update Site" click → verify pubkey unchanged, currentSigner non-null |
| Relay staleness misses existing site | Deploy guard phase | Test: deploy site via CLI to non-default relay; SPA guard should still warn via NSITE_RELAY cache |
| Delete done state misleads on failure | Delete animation / state machine phase | Test: relays reject kind 5; header must read "Deletion failed" not "Deletion complete" |
| Module-level store singleton (v1.5) | Core lib extraction phase | Mount two deployer instances; verify independent session state per instance |
| Shadow DOM event propagation (v1.5) | Web Component wrapper phase | Test: `element.addEventListener('deploy-complete', fn)`; verify fn fires on deploy success |
| Tailwind invisible in shadow DOM (v1.5) | Web Component wrapper phase | Visual smoke test: IIFE bundle on blank HTML page — verify component is styled |
| Lifecycle delay for prop availability (v1.5) | Core lib extraction phase | Test: set `signer` prop pre-mount; verify it is read correctly on first render |
| Svelte not externalized in ESM build (v1.5) | Package extraction phase | Check ESM dist for inline Svelte internals; dist should be <100KB |
| package.json exports missing svelte condition (v1.5) | Package extraction phase | Run `publint` on built package; import into test Svelte project and verify HMR works |
| NIP-07 check at init time (v1.5) | Core lib extraction phase | Load page without NIP-07 extension; verify no error at startup; verify login works after extension enabled |
| WebCrypto unavailable in non-secure context (v1.5) | Core lib extraction phase | Load IIFE on HTTP page; verify error state shown, no TypeError thrown |
| RelayPool leaks across remounts (v1.5) | Web Component wrapper phase | Mount/unmount 5 times; verify 0 open WebSocket connections after final unmount |
| Dual build config divergence (v1.5) | Package extraction phase | CI runs both build configs; integration test validates each output format separately |
| sessionStorage key collision multi-instance (v1.5) | Core lib extraction phase | Two instances with different instanceId; verify no key collision in sessionStorage |

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
- `/home/sandwich/Develop/nsite.run/apps/spa/src/App.svelte` — full SPA application source;
  existing state machine, reset paths, relay fetch logic, and deploy flow read directly.
  HIGH confidence.
- `/home/sandwich/Develop/nsite.run/apps/spa/src/components/ManageSite.svelte` — delete state
  machine, confirmation flow, and results rendering read directly. HIGH confidence.
- `/home/sandwich/Develop/nsite.run/apps/spa/src/lib/publish.js` — relay publishing and
  deletion event logic read directly. HIGH confidence.
- MDN: Window: beforeunload event (https://developer.mozilla.org/en-US/docs/Web/API/Window/beforeunload_event)
  — sticky activation requirement, Chrome 119+ behavior, correct handler pattern. HIGH confidence.
- Chris Coyier: Chrome 119 and beforeunload (https://chriscoyier.net/2023/11/15/careful-about-chrome-119-and-beforeunload-event-listeners/)
  — Chrome 119 sticky activation behavior change documented. MEDIUM confidence (single author
  with confirming Chrome Dev Rel comment).
- Svelte GitHub issue #4910 (https://github.com/sveltejs/svelte/issues/4910) — `animate:flip`
  + `transition:fade` overlap glitch in keyed each blocks. MEDIUM confidence (issue confirmed,
  workaround not officially documented).
- nostr-protocol/nips NIP-09 (https://github.com/nostr-protocol/nips/blob/master/09.md) —
  kind 5 deletion is advisory; relays SHOULD but need not honor it. HIGH confidence.
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
- Svelte 4 Custom Elements API docs (https://v4.svelte.dev/docs/custom-elements-api) —
  lifecycle timing (next tick after connectedCallback), CSS encapsulation, slots behavior,
  property/attribute bridging, `shadow: 'none'` trade-offs. HIGH confidence.
- Svelte GitHub issue #3327 (https://github.com/sveltejs/svelte/issues/3327) —
  `createEventDispatcher` events do not have `composed: true`; do not cross shadow DOM
  boundaries without manual workaround. HIGH confidence (confirmed in issue thread and
  Web Platform spec).
- Svelte GitHub issue #8690 (https://github.com/sveltejs/svelte/issues/8690) —
  cross-shadow-DOM context propagation fails; `getContext` returns undefined across custom
  element boundaries. MEDIUM confidence (issue open, workaround via `getRootNode().host`).
- Svelte GitHub issue #8963 (https://github.com/sveltejs/svelte/issues/8963) —
  slots do not work with `shadow: 'none'`. HIGH confidence (documented limitation).
- vite-plugin-svelte FAQ (https://github.com/sveltejs/vite-plugin-svelte/blob/main/docs/faq.md)
  — library packaging, `svelte` export condition, peer dependency externalization. HIGH confidence.
- Vite GitHub issue #6780 (https://github.com/vitejs/vite/issues/6780) —
  peer dependencies of peer dependencies included in library build unexpectedly. MEDIUM confidence
  (issue confirmed; solution is explicit `rollupOptions.external`).
- Svelte multi-instance store issue (https://github.com/sveltejs/svelte/issues/4504) —
  module-level stores shared across all instances in same bundle. HIGH confidence (core ES module
  semantics; confirmed in Svelte issue tracker).
- Web Cryptography API MDN (https://developer.mozilla.org/en-US/docs/Web/API/Crypto/subtle) —
  `crypto.subtle` only available in secure contexts. HIGH confidence (W3C spec requirement).
- Nostr Web Components docs (https://web.nostr.technology/guide/installation) — `window.nostr`
  is global scope, not shadow-DOM-scoped. HIGH confidence (global property, standard JS scoping).

---
*Pitfalls research for: nsite.run — infrastructure, v1.4 deploy safety UX, and v1.5 deployer component extraction*
*Originally researched: 2026-03-13*
*v1.4 additions: 2026-03-24*
*v1.5 additions: 2026-03-25*
