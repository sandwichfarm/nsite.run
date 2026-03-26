/**
 * Gateway request router.
 * Dispatches incoming requests to the correct backend based on:
 * 1. WebSocket upgrade header (→ relay proxy)
 * 2. Blossom URL path (→ blossom proxy)
 * 3. npub/named-site subdomain (→ resolver)
 * 4. Root domain fallback (→ SPA)
 *
 * Priority order is critical — see RESEARCH.md Pitfall 2.
 * Host header is read from request.headers.get("host") per Pitfall 4.
 */
import { extractNpubAndIdentifier } from "./hostname.ts";
import { handleRelay } from "./stubs/relay.ts";
import { handleBlossom } from "./stubs/blossom.ts";
import { handleResolver } from "./resolver.ts";
import { handleSpa } from "./stubs/spa.ts";

/** Pre-compiled blossom blob path regex (from apps/blossom/src/router.ts) */
const BLOSSOM_PATH_RE = /^\/[0-9a-f]{64}/;

function isBlossomPath(pathname: string): boolean {
  return (
    pathname === "/upload" ||
    pathname.startsWith("/list/") ||
    pathname === "/mirror" ||
    pathname === "/report" ||
    pathname === "/server-info" ||
    BLOSSOM_PATH_RE.test(pathname)
  );
}

/**
 * Route an incoming request to the appropriate handler.
 */
export async function route(request: Request): Promise<Response> {
  const url = new URL(request.url);
  const host = request.headers.get("host") || url.hostname;

  // 1. WebSocket upgrade → relay (highest priority, any host)
  // Bunny CDN strips the Upgrade header but passes sec-websocket-key
  if (
    request.headers.get("upgrade")?.toLowerCase() === "websocket" ||
    request.headers.has("sec-websocket-key")
  ) {
    return handleRelay(request);
  }

  // 2. NIP-11 on root domain → relay
  if (
    request.method === "GET" &&
    request.headers.get("accept")?.includes("application/nostr+json") &&
    !extractNpubAndIdentifier(host)
  ) {
    return handleRelay(request);
  }

  // Debug: /_debug/ws-check — check WebSocket support
  if (url.pathname === "/_debug/ws-check") {
    // deno-lint-ignore no-explicit-any
    const d = Deno as any;
    return new Response(
      JSON.stringify(
        {
          hasUpgradeWebSocket: typeof d.upgradeWebSocket === "function",
          denoVersion: typeof Deno.version === "object" ? Deno.version : "unknown",
          requestHeaders: Object.fromEntries(request.headers.entries()),
        },
        null,
        2,
      ),
      { headers: { "Content-Type": "application/json" } },
    );
  }

  // Debug: /_debug/blob?sha=<hash> — test blob fetch path from edge
  if (url.pathname === "/_debug/blob") {
    const sha = url.searchParams.get("sha") ?? "";
    const blossomBackend = Deno.env.get("BLOSSOM_URL")?.replace(/\/$/, "") ?? "";
    const serverUrl = Deno.env.get("SERVER_URL")?.replace(/\/$/, "") ?? "";
    // deno-lint-ignore no-explicit-any
    const results: Record<string, any> = { sha: sha || "(missing)", blossomBackend, serverUrl };

    if (sha) {
      // Test own storage
      try {
        const storageHost = Deno.env.get("BUNNY_STORAGE_HOSTNAME");
        const storageUser = Deno.env.get("BUNNY_STORAGE_USERNAME");
        const storagePass = Deno.env.get("BUNNY_STORAGE_PASSWORD");
        if (storageHost && storageUser && storagePass) {
          const pre = sha.substring(0, 2);
          const storageUrl = `https://${storageHost}/${storageUser}/blobs/${pre}/${sha}`;
          const r = await fetch(storageUrl, { headers: { AccessKey: storagePass } });
          results.ownStorage = {
            url: storageUrl,
            status: r.status,
            size: (await r.arrayBuffer()).byteLength,
          };
        } else {
          results.ownStorage = "not configured";
        }
      } catch (e) {
        results.ownStorage = { error: String(e) };
      }

      // Test blossom backend
      try {
        const blobUrl = `${blossomBackend}/${sha}`;
        const r = await fetch(blobUrl);
        results.blossomBackend = {
          url: blobUrl,
          status: r.status,
          size: (await r.arrayBuffer()).byteLength,
        };
      } catch (e) {
        results.blossomBackend = { error: String(e) };
      }
    }
    return new Response(JSON.stringify(results, null, 2), {
      headers: { "Content-Type": "application/json" },
    });
  }

  // 3. Blossom endpoints
  if (isBlossomPath(url.pathname)) {
    return handleBlossom(request);
  }

  // 4. npub / named-site subdomain → nsite resolver
  const sitePointer = extractNpubAndIdentifier(host);
  if (sitePointer) {
    return await handleResolver(request, sitePointer);
  }

  // 5. Check for invalid subdomains — redirect to base domain
  const hostParts = host.split(":")[0].split(".");
  const baseDomain = Deno.env.get("BASE_DOMAIN") || "nsite.run";
  const baseDomainParts = baseDomain.split(".");
  if (hostParts.length > baseDomainParts.length) {
    return new Response(null, {
      status: 302,
      headers: {
        Location: `https://${baseDomain}/`,
      },
    });
  }

  // 6. Root domain (no subdomain) → SPA
  return handleSpa(request);
}
