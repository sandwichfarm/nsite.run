/**
 * nsite gateway live resolver.
 *
 * Replaces handleResolverStub — handles all nsite subdomain requests.
 * Implements the three-state cache machine:
 *   - cold: show loading page → start resolution pipeline → serve file
 *   - warm-outdated: serve cached content + banner, background check running
 *   - warm-current: serve immediately from cache
 *
 * Resolution pipeline is streaming/opportunistic: parallel own-DB + seed relay queries,
 * relay list arrivals trigger outbox manifest queries, manifest arrivals trigger blob fetch.
 *
 * Per RESEARCH.md:
 * - Own relay queries via direct libSQL (no WebSocket hop)
 * - External relays via raw NIP-01 WebSocket (queryMultipleRelays)
 * - Promise-as-mutex for background check deduplication (Pitfall 1)
 * - Loading page only for HTML-like paths (Pitfall 2)
 * - Banner injection only for text/html (Pitfall 3)
 * - Manifest update: different ID AND newer created_at (Pitfall 4)
 */

import type { SitePointer } from "./hostname.ts";
import {
  createDb,
  initSchema,
  insertParameterizedReplaceableEvent,
  insertReplaceableEvent,
  queryEvents,
} from "./db.ts";
import type { Client } from "./db.ts";
import { npubToHex, queryMultipleRelays } from "./nostr-ws.ts";
import { detectCompression, detectContentType, resolveIndexPath } from "./content-type.ts";
import { securityHeaders } from "./security-headers.ts";
import {
  escapeHtml,
  injectBanner,
  renderDefault404,
  renderLoadingPage,
  renderNotFoundPage,
} from "./pages.ts";
import {
  backgroundChecks,
  type CacheEntry,
  cacheKey,
  createStorageClient,
  getManifestFiles,
  getManifestServers,
  getRelayUrls,
  siteCache,
  type StorageClient,
} from "./cache.ts";
import type { NostrEvent } from "@nsite/shared/types";
import { NsiteKind } from "@nsite/shared/types";
import { EMPTY_SHA256, sha256Hex } from "@nsite/shared/sha256";

// --- Module-level initialization (lazy — runs once per edge worker on first request) ---
// Lazy initialization avoids createDb() throwing at import time when env vars are not set
// (important for unit tests that import this module without a live DB).

let _db: Client | null = null;
let _storageClient: StorageClient | null | undefined = undefined;
let _storageInit = false;

let _seedRelays: string[] | null = null;

function getDb(): Client {
  if (!_db) {
    _db = createDb();
  }
  return _db;
}

/** Inject a pre-created DB client (used by dev.ts for local SQLite). */
export function setDevDb(client: Client): void {
  _db = client;
}

function getStorage(): StorageClient | null {
  if (!_storageInit) {
    _storageClient = createStorageClient();
    _storageInit = true;
  }
  return _storageClient ?? null;
}

function getSeedRelays(): string[] {
  if (!_seedRelays) {
    _seedRelays = (
      Deno.env.get("SEED_RELAYS") ??
        "wss://purplepag.es,wss://user.kindpag.es,wss://relay.damus.io,wss://relay.nostr.band"
    )
      .split(",")
      .map((s) => s.trim())
      .filter((s) => s.length > 0);
  }
  return _seedRelays;
}

// Lazy schema init — only run once per edge worker cold start
let schemaReady = false;

async function ensureSchema(): Promise<void> {
  if (schemaReady) return;
  await initSchema(getDb());
  schemaReady = true;
}

// --- Timeouts (per RESEARCH.md recommendations) ---
const TIMEOUT_OWN_RELAY_MS = 2000;
const TIMEOUT_EXTERNAL_RELAY_MS = 3000;
const TIMEOUT_SEED_RELAYS_MS = 5000;
const TIMEOUT_MANIFEST_MS = 8000;
const TIMEOUT_BLOB_MS = 10000;
const TIMEOUT_TOTAL_MS = 30000;

// --- Public exports ---

/**
 * Exported helper: determine if a pathname is HTML-like (should show loading page).
 * Per Pitfall 2: only show loading page for paths that could be HTML.
 * Non-HTML paths (assets) return 404 immediately on cold cache.
 */
export function isHtmlLikePath(pathname: string): boolean {
  return (
    pathname === "/" ||
    pathname.endsWith(".html") ||
    !pathname.includes(".")
  );
}

/**
 * Main resolver handler. Replaces handleResolverStub.
 * Handles all three cache states and the streaming resolution pipeline.
 */
export async function handleResolver(
  request: Request,
  pointer: SitePointer,
): Promise<Response> {
  const url = new URL(request.url);

  // Step 1: Get hex pubkey — named sites provide it directly, root sites decode from npub
  const pubkeyHex = pointer.pubkeyHex || npubToHex(pointer.npub);
  if (!pubkeyHex) {
    return new Response("Invalid npub", { status: 400 });
  }

  // Step 2: Compute cache key
  const key = cacheKey(pubkeyHex, pointer.identifier);

  // Step 3: Handle /_nsite/ready polling endpoint — no DB needed, pure cache state check
  if (url.pathname === "/_nsite/ready") {
    return handleReadyEndpoint(key, url);
  }

  // For all other requests, ensure schema is ready before any DB access
  await ensureSchema();

  // Step 4: Check cache and dispatch
  const entry = siteCache.get(key);

  if (!entry) {
    // Cache miss — start resolution
    return await handleColdCache(request, url, pubkeyHex, pointer, key);
  }

  if (entry.state === "loading") {
    // Another request is already resolving — assets wait, HTML gets loading page
    return await handleLoadingState(url, pubkeyHex, pointer, key, null);
  }

  if (entry.state === "not-found") {
    // Site doesn't exist (or hasn't been found) — serve not-found page
    // Optionally trigger background re-check if cached >5 minutes ago
    const fiveMinutesAgo = Date.now() - 5 * 60 * 1000;
    if (entry.cachedAt < fiveMinutesAgo) {
      triggerBackgroundCheck(pubkeyHex, pointer, key);
    }
    return new Response(renderNotFoundPage(), {
      status: 404,
      headers: {
        "Content-Type": "text/html; charset=utf-8",
        ...securityHeaders(),
      },
    });
  }

  // Cache hit, state "ready" — serve file, trigger background update check
  triggerBackgroundCheck(pubkeyHex, pointer, key);
  return await serveFile(url, entry, false);
}

// --- Ready endpoint ---

function handleReadyEndpoint(key: string, _url: URL): Response {
  const entry = siteCache.get(key);

  // Also check "k" query param — loading page passes cacheKey as ?k=
  const ready = entry ? entry.state === "ready" || entry.state === "not-found" : false;

  return new Response(JSON.stringify({ ready }), {
    status: 200,
    headers: {
      "Content-Type": "application/json",
      ...securityHeaders(),
    },
  });
}

// --- Cold cache: show loading page and start resolution ---

async function handleColdCache(
  _request: Request,
  url: URL,
  pubkeyHex: string,
  pointer: SitePointer,
  key: string,
): Promise<Response> {
  // Create cache entry in "loading" state with a ready promise.
  // Asset requests that arrive during resolution will await this promise
  // instead of returning 404 — eliminates the CDN-caching-404 bug entirely.
  let resolveReady!: () => void;
  const ready = new Promise<void>((resolve) => {
    resolveReady = resolve;
  });

  const loadingEntry: CacheEntry = {
    pubkey: pubkeyHex,
    identifier: pointer.identifier,
    manifestEvent: null,
    files: new Map(),
    blossomServers: [],
    cachedAt: 0,
    state: "loading",
    ready,
    resolveReady,
  };
  siteCache.set(key, loadingEntry);

  // On edge runtimes, in-memory cache doesn't persist across requests.
  // Await the pipeline synchronously — no loading page polling.
  try {
    await startResolutionPipeline(pubkeyHex, pointer, key);
  } finally {
    // Signal all waiting asset requests that resolution is complete (or failed)
    resolveReady();
  }

  // Check result
  const entry = siteCache.get(key);
  if (!entry || entry.state === "not-found" || entry.state === "loading") {
    return new Response(renderNotFoundPage(), {
      status: 404,
      headers: {
        "Content-Type": "text/html; charset=utf-8",
        ...securityHeaders(),
      },
    });
  }

  return await serveFile(url, entry, false);
}

interface ProfileData {
  displayName: string;
  avatarUrl: string;
}

async function fetchProfile(pubkeyHex: string): Promise<ProfileData | null> {
  try {
    const events = await queryMultipleRelays(
      getSeedRelays(),
      { kinds: [0], authors: [pubkeyHex], limit: 1 },
      TIMEOUT_EXTERNAL_RELAY_MS,
    );
    if (events.length === 0) return null;

    const meta = JSON.parse(events[0].content) as Record<string, unknown>;
    const displayName = typeof meta["display_name"] === "string"
      ? meta["display_name"]
      : typeof meta["name"] === "string"
      ? meta["name"]
      : "";
    const avatarUrl = typeof meta["picture"] === "string" ? meta["picture"] : "";

    return {
      displayName: escapeHtml(displayName),
      avatarUrl: escapeHtml(avatarUrl),
    };
  } catch {
    return null;
  }
}

async function handleLoadingState(
  url: URL,
  _pubkeyHex: string,
  _pointer: SitePointer,
  key: string,
  profile: ProfileData | null,
): Promise<Response> {
  const pathname = url.pathname;
  const entry = siteCache.get(key);

  // For assets (JS, CSS, images): wait for resolution to complete, then serve.
  // This avoids returning 404 for assets that will exist momentarily.
  if (!isHtmlLikePath(pathname) && entry?.ready) {
    await entry.ready;
    const resolved = siteCache.get(key);
    if (resolved && resolved.state === "ready") {
      return await serveFile(url, resolved, false);
    }
    // Resolution failed — site not found
    return new Response("Not found", {
      status: 404,
      headers: {
        "Content-Type": "text/plain",
        "Cache-Control": "no-store",
        ...securityHeaders(),
      },
    });
  }

  // HTML requests: show loading page (with polling to reload once ready)
  const html = renderLoadingPage({
    displayName: profile?.displayName ?? "",
    avatarUrl: profile?.avatarUrl ?? "",
    cacheKey: key,
  });

  return new Response(html, {
    status: 200,
    headers: {
      "Content-Type": "text/html; charset=utf-8",
      "Cache-Control": "no-store",
      ...securityHeaders(),
    },
  });
}

// --- Resolution pipeline ---

async function startResolutionPipeline(
  pubkeyHex: string,
  pointer: SitePointer,
  key: string,
): Promise<void> {
  const totalTimeout = new Promise<never>((_, reject) =>
    setTimeout(() => reject(new Error("timeout")), TIMEOUT_TOTAL_MS)
  );

  try {
    await Promise.race([
      runResolutionPipeline(pubkeyHex, pointer, key),
      totalTimeout,
    ]);
  } catch {
    // Total timeout or unexpected error — mark as not-found if still loading
    const entry = siteCache.get(key);
    if (entry && entry.state === "loading") {
      siteCache.set(key, { ...entry, state: "not-found", cachedAt: Date.now() });
    }
  }
}

async function runResolutionPipeline(
  pubkeyHex: string,
  pointer: SitePointer,
  key: string,
): Promise<void> {
  const isNamedSite = pointer.kind === "named";
  const identifier = pointer.identifier ?? "";

  // Build manifest filter
  const manifestFilter = isNamedSite
    ? {
      kinds: [NsiteKind.NAMED_SITE],
      authors: [pubkeyHex],
      "#d": [identifier],
      limit: 1,
    }
    : {
      kinds: [NsiteKind.ROOT_SITE],
      authors: [pubkeyHex],
      limit: 1,
    };

  // Step 5a: Fire all initial queries in parallel
  const ownRelayManifestPromise = withTimeout(
    queryEvents(getDb(), [manifestFilter]),
    TIMEOUT_OWN_RELAY_MS,
  );

  const ownRelayRelayListPromise = withTimeout(
    queryEvents(getDb(), [
      { kinds: [NsiteKind.RELAY_LIST], authors: [pubkeyHex], limit: 1 },
    ]),
    TIMEOUT_OWN_RELAY_MS,
  );

  const ownRelayBlossomListPromise = withTimeout(
    queryEvents(getDb(), [
      { kinds: [NsiteKind.BLOSSOM_LIST], authors: [pubkeyHex], limit: 1 },
    ]),
    TIMEOUT_OWN_RELAY_MS,
  );

  const seedRelayListPromise = withTimeout(
    queryMultipleRelays(
      getSeedRelays(),
      { kinds: [NsiteKind.RELAY_LIST], authors: [pubkeyHex], limit: 1 },
      TIMEOUT_EXTERNAL_RELAY_MS,
    ),
    TIMEOUT_SEED_RELAYS_MS,
  );

  // Note: seed relays are only for kind 0/10002 — they don't store nsite manifests.

  // Step 5b: Collect relay lists from all sources, then query user's outbox relays
  const outboxManifestPromise = Promise.all([
    ownRelayRelayListPromise.catch(() => [] as NostrEvent[]),
    seedRelayListPromise.catch(() => [] as NostrEvent[]),
  ])
    .then(([ownRelayListEvents, seedRelayListEvents]) => {
      const allRelayListUrls: string[] = [];
      for (const event of [...ownRelayListEvents, ...seedRelayListEvents]) {
        allRelayListUrls.push(...getRelayUrls(event));
      }
      const uniqueUrls = [...new Set(allRelayListUrls)];
      if (uniqueUrls.length === 0) return [];
      return withTimeout(
        queryMultipleRelays(uniqueUrls, manifestFilter, TIMEOUT_EXTERNAL_RELAY_MS),
        TIMEOUT_MANIFEST_MS,
      );
    })
    .catch(() => [] as NostrEvent[]);

  // Step 5c: Collect manifest from all sources, pick newest
  const [
    ownManifestResults,
    outboxManifestResults,
    ownBlossomListResults,
  ] = await Promise.all([
    ownRelayManifestPromise.catch(() => [] as NostrEvent[]),
    outboxManifestPromise,
    ownRelayBlossomListPromise.catch(() => [] as NostrEvent[]),
  ]);

  // Pick the manifest with the highest created_at
  const allManifests = [
    ...ownManifestResults,
    ...outboxManifestResults,
  ];

  const bestManifest = allManifests.reduce<NostrEvent | null>((best, event) => {
    if (!best || event.created_at > best.created_at) return event;
    return best;
  }, null);

  if (!bestManifest) {
    // No manifest found — mark as not-found
    const entry = siteCache.get(key);
    if (entry && entry.state === "loading") {
      siteCache.set(key, { ...entry, state: "not-found", cachedAt: Date.now() });
    }
    return;
  }

  // Step 5d: Parse manifest
  const files = getManifestFiles(bestManifest);
  const manifestServers = getManifestServers(bestManifest);

  // Collect blossom servers from kind 10063 as well
  const blossomListServers: string[] = [];
  for (const event of ownBlossomListResults) {
    blossomListServers.push(...getManifestServers(event));
  }

  const allBlossomServers = [...new Set([...manifestServers, ...blossomListServers])];

  // Step 5e: Update cache entry to ready state
  const updatedEntry: CacheEntry = {
    pubkey: pubkeyHex,
    identifier: pointer.identifier,
    manifestEvent: bestManifest,
    files,
    blossomServers: allBlossomServers,
    cachedAt: Date.now(),
    state: "ready",
  };
  siteCache.set(key, updatedEntry);

  // Step 5f: Persist manifest to own relay (fire-and-forget)
  persistManifest(bestManifest);
}

function persistManifest(manifest: NostrEvent): void {
  // Fire-and-forget — don't block response
  if (manifest.kind === NsiteKind.ROOT_SITE) {
    insertReplaceableEvent(getDb(), manifest).catch(() => {});
  } else if (manifest.kind === NsiteKind.NAMED_SITE) {
    insertParameterizedReplaceableEvent(getDb(), manifest).catch(() => {});
  }
}

// --- Background update check ---

function triggerBackgroundCheck(
  pubkeyHex: string,
  pointer: SitePointer,
  key: string,
): void {
  // Deduplication: if a check is already running, skip
  if (backgroundChecks.has(key)) return;

  // CRITICAL: Set the Map entry SYNCHRONOUSLY before any await (Pitfall 1)
  const promise = (async () => {
    try {
      await runBackgroundCheck(pubkeyHex, pointer, key);
    } finally {
      backgroundChecks.delete(key);
    }
  })();

  backgroundChecks.set(key, promise);
}

async function runBackgroundCheck(
  pubkeyHex: string,
  pointer: SitePointer,
  key: string,
): Promise<void> {
  const isNamedSite = pointer.kind === "named";
  const identifier = pointer.identifier ?? "";

  const manifestFilter = isNamedSite
    ? {
      kinds: [NsiteKind.NAMED_SITE],
      authors: [pubkeyHex],
      "#d": [identifier],
      limit: 1,
    }
    : {
      kinds: [NsiteKind.ROOT_SITE],
      authors: [pubkeyHex],
      limit: 1,
    };

  // Query own relay + seed relays (skip profile fetch for background check)
  const [ownResults, seedResults] = await Promise.all([
    withTimeout(
      queryEvents(getDb(), [manifestFilter]),
      TIMEOUT_OWN_RELAY_MS,
    ).catch(() => [] as NostrEvent[]),
    withTimeout(
      queryMultipleRelays(getSeedRelays(), manifestFilter, TIMEOUT_EXTERNAL_RELAY_MS),
      TIMEOUT_MANIFEST_MS,
    ).catch(() => [] as NostrEvent[]),
  ]);

  const allManifests = [...ownResults, ...seedResults];
  const bestManifest = allManifests.reduce<NostrEvent | null>((best, event) => {
    if (!best || event.created_at > best.created_at) return event;
    return best;
  }, null);

  if (!bestManifest) return;

  const cachedEntry = siteCache.get(key);
  if (!cachedEntry || cachedEntry.state !== "ready" || !cachedEntry.manifestEvent) return;

  // Per Pitfall 4: both conditions must be true — different ID AND newer timestamp
  if (
    bestManifest.id !== cachedEntry.manifestEvent.id &&
    bestManifest.created_at > cachedEntry.manifestEvent.created_at
  ) {
    // Update is available — update cache with new manifest
    const files = getManifestFiles(bestManifest);
    const blossomServers = getManifestServers(bestManifest);

    siteCache.set(key, {
      ...cachedEntry,
      manifestEvent: bestManifest,
      files,
      blossomServers,
      cachedAt: Date.now(),
      state: "ready",
      updateAvailable: true,
    });

    // Persist new manifest to own relay
    persistManifest(bestManifest);
  }
}

// --- File serving ---

async function serveFile(
  url: URL,
  entry: CacheEntry,
  _isUpdate: boolean,
): Promise<Response> {
  const pathname = url.pathname;

  // Step 7a: Resolve directory paths (/ → /index.html, /about/ → /about/index.html)
  const resolvedPath = resolveIndexPath(pathname);

  // Step 7b: Look up path in files Map
  // Check exact match first, then compressed variants
  let filePath = resolvedPath;
  let compressionEncoding: string | null = null;

  if (entry.files.has(resolvedPath)) {
    // Exact match
    filePath = resolvedPath;
  } else if (entry.files.has(resolvedPath + ".br")) {
    // Brotli-compressed variant available
    filePath = resolvedPath + ".br";
    compressionEncoding = "br";
  } else if (entry.files.has(resolvedPath + ".gz")) {
    // Gzip-compressed variant available
    filePath = resolvedPath + ".gz";
    compressionEncoding = "gzip";
  } else {
    // Step 7c: Path not found — try /404.html, then default
    return serve404(entry);
  }

  const sha256 = entry.files.get(filePath)!;

  // Content type is based on the resolved (non-compressed) path
  const contentTypePath = compressionEncoding
    ? (detectCompression(filePath)?.basePath ?? filePath)
    : filePath;
  const contentType = detectContentType(contentTypePath);

  // Step 7e: Fetch blob (try own blossom first, then manifest servers)
  // Empty files (0 bytes) have a well-known hash — serve directly without fetching
  if (sha256 === EMPTY_SHA256) {
    const responseHeaders: Record<string, string> = {
      "Content-Type": contentType,
      ...securityHeaders(),
    };
    if (compressionEncoding) {
      responseHeaders["Content-Encoding"] = compressionEncoding;
    }
    return new Response(new ArrayBuffer(0), { status: 200, headers: responseHeaders });
  }

  const blobResult = await fetchBlob(sha256, entry.blossomServers);
  if (!blobResult) {
    return new Response("Bad Gateway: blob unavailable", {
      status: 502,
      headers: { "Content-Type": "text/plain", ...securityHeaders() },
    });
  }

  const { data: blobData } = blobResult;

  // Build response headers
  // Immutable hashed assets get long cache; HTML is short-cached for updates
  const isImmutable = filePath.includes("/immutable/") || filePath.includes("/_app/");
  const cacheControl = contentType.startsWith("text/html")
    ? "public, max-age=300"
    : isImmutable
    ? "public, max-age=31536000, immutable"
    : "public, max-age=3600";

  const responseHeaders: Record<string, string> = {
    "Content-Type": contentType,
    "Cache-Control": cacheControl,
    ...securityHeaders(),
  };

  if (compressionEncoding) {
    responseHeaders["Content-Encoding"] = compressionEncoding;
  }

  // Step 7j: Banner injection — inject into HTML responses when an update was found.
  // The background check sets updateAvailable=true when a newer manifest exists.
  // Show banner only when we KNOW there's an update, not while checking.
  // Per Pitfall 3: only inject into text/html.
  let responseBody: string | ArrayBuffer;

  if (entry.updateAvailable && contentType.startsWith("text/html")) {
    // Clear the flag so the next request (with fresh content) won't show the banner
    entry.updateAvailable = false;
    try {
      const text = new TextDecoder().decode(blobData);
      responseBody = injectBanner(text);
    } catch {
      // If decoding fails, serve without banner
      responseBody = blobData;
    }
  } else {
    responseBody = blobData;
  }

  // Step 7g: Persist blob to own blossom (fire-and-forget)
  const storageClient = getStorage();
  if (storageClient) {
    storageClient.put(storageClient.blobPath(sha256), blobData, contentType).catch(() => {});
  }

  return new Response(responseBody, {
    status: 200,
    headers: responseHeaders,
  });
}

async function serve404(entry: CacheEntry): Promise<Response> {
  // Try fallback candidates in order:
  // 1. /404.html — nsyte --fallback maps the SPA shell here explicitly
  // 2. /index.html — standard SPA convention, serves app shell for client-side routing
  // Serve with HTTP 200 so client-side routers (React Router, SvelteKit, etc.) activate.
  const fallbackPaths = ["/404.html", "/index.html"];

  for (const fallbackPath of fallbackPaths) {
    const sha256 = entry.files.get(fallbackPath);
    if (sha256) {
      const blobResult = await fetchBlob(sha256, entry.blossomServers);
      if (blobResult) {
        const html = new TextDecoder().decode(blobResult.data);
        return new Response(html, {
          status: 200,
          headers: {
            "Content-Type": "text/html; charset=utf-8",
            ...securityHeaders(),
          },
        });
      }
    }
  }

  // Fall back to gateway default 404
  return new Response(renderDefault404(), {
    status: 404,
    headers: {
      "Content-Type": "text/html; charset=utf-8",
      ...securityHeaders(),
    },
  });
}

interface BlobResult {
  data: ArrayBuffer;
}

async function fetchBlob(
  sha256: string,
  blossomServers: string[],
): Promise<BlobResult | null> {
  // Try own blossom first (if storage client available)
  const storageClient = getStorage();
  if (storageClient) {
    try {
      const resp = await storageClient.get(storageClient.blobPath(sha256));
      if (resp) {
        const data = await resp.arrayBuffer();
        const verified = await verifySha256(data, sha256);
        if (verified) return { data };
        // Hash mismatch — try external servers
      }
    } catch {
      // Continue to external servers
    }
  }

  // Resolve blossom servers — replace self-referencing URLs with the backend BLOSSOM_URL
  const blossomBackend = Deno.env.get("BLOSSOM_URL")?.replace(/\/$/, "") ?? "";
  const selfHostnames = [
    Deno.env.get("SERVER_URL") ?? "",
    Deno.env.get("GATEWAY_URL") ?? "",
  ].filter(Boolean).map((u) => u.replace(/\/$/, ""));

  const resolvedServers = blossomServers.map((s) => {
    const normalized = s.replace(/\/$/, "");
    if (blossomBackend && selfHostnames.some((h) => normalized === h)) {
      return blossomBackend;
    }
    return normalized;
  });

  // Try each blossom server in order
  for (const serverUrl of resolvedServers) {
    try {
      const blobUrl = `${serverUrl.replace(/\/$/, "")}/${sha256}`;
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), TIMEOUT_BLOB_MS);

      const resp = await fetch(blobUrl, { signal: controller.signal });
      clearTimeout(timer);

      if (!resp.ok) continue;

      const data = await resp.arrayBuffer();

      // Step 7f: Verify SHA-256 (GATE-07)
      const verified = await verifySha256(data, sha256);
      if (!verified) continue; // Try next server

      return { data };
    } catch {
      // Connection error or timeout — try next server
    }
  }

  return null;
}

async function verifySha256(data: ArrayBuffer, expectedSha256: string): Promise<boolean> {
  try {
    const actual = sha256Hex(new Uint8Array(data));
    return actual === expectedSha256;
  } catch {
    return false;
  }
}

// --- Utility ---

/**
 * Wrap a promise with a timeout that resolves to a default value.
 * The original promise is still running but its result is discarded on timeout.
 */
function withTimeout<T>(
  promise: Promise<T>,
  timeoutMs: number,
  defaultValue?: T,
): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => {
      if (defaultValue !== undefined) {
        resolve(defaultValue);
      } else {
        reject(new Error(`Timeout after ${timeoutMs}ms`));
      }
    }, timeoutMs);

    promise.then(
      (value) => {
        clearTimeout(timer);
        resolve(value);
      },
      (err) => {
        clearTimeout(timer);
        reject(err);
      },
    );
  });
}
