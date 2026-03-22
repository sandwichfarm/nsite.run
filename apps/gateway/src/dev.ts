/**
 * Gateway local dev entrypoint.
 * Sets env vars pointing at local services, injects Bunny.v1.serve polyfill,
 * and recreates the routing logic from router.ts with the dev blossom stub.
 *
 * Must NOT import router.ts — that file statically imports stubs/blossom.ts
 * which throws on missing BUNNY_STORAGE_* env vars during init.
 */

// --- 1. Set environment variables for local routing ---
const GATEWAY_PORT = parseInt(Deno.env.get("GATEWAY_PORT") ?? "8080");
Deno.env.set("RELAY_URL", `http://localhost:${Deno.env.get("RELAY_PORT") ?? "8081"}`);
Deno.env.set("BLOSSOM_URL", `http://localhost:${Deno.env.get("BLOSSOM_PORT") ?? "8082"}`);
Deno.env.set("SPA_ASSETS_URL", `http://localhost:${Deno.env.get("SPA_PORT") ?? "5173"}`);
Deno.env.set("SERVER_URL", `http://localhost:${Deno.env.get("BLOSSOM_PORT") ?? "8082"}`);
Deno.env.set("BASE_DOMAIN", "localhost");

// --- 2. Inject Bunny.v1.serve polyfill ---
(globalThis as Record<string, unknown>).Bunny = {
  v1: {
    serve: (handler: (req: Request) => Response | Promise<Response>) => {
      Deno.serve({ port: GATEWAY_PORT, hostname: "0.0.0.0" }, handler);
    },
  },
};

// --- 3. Patch Request.prototype.upgradeWebSocket (used by relay stub) ---
if (!(Request.prototype as unknown as Record<string, unknown>).upgradeWebSocket) {
  (Request.prototype as unknown as Record<string, unknown>).upgradeWebSocket = function (
    this: Request,
  ) {
    return Deno.upgradeWebSocket(this);
  };
}

// --- 4. Import routing dependencies (after env vars set) ---
import { extractNpubAndIdentifier } from "./hostname.ts";
import { handleRelay } from "./stubs/relay.ts";
import { handleBlossom } from "./stubs/blossom-dev.ts"; // DEV: uses LocalStorageClient
import { handleResolver } from "./resolver.ts";
import { handleSpa } from "./stubs/spa.ts";

/** Pre-compiled blossom blob path regex (mirrors router.ts) */
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

// --- 5. Dev route handler (mirrors router.ts with blossom-dev substitution) ---
async function route(request: Request): Promise<Response> {
  const url = new URL(request.url);
  const host = request.headers.get("host") || url.hostname;

  // 1. WebSocket upgrade → relay (highest priority, any host)
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
  const baseDomain = Deno.env.get("BASE_DOMAIN") || "localhost";
  const baseDomainParts = baseDomain.split(".");
  if (hostParts.length > baseDomainParts.length) {
    return new Response(null, {
      status: 302,
      headers: {
        Location: `http://${baseDomain}/`,
      },
    });
  }

  // 6. Root domain (no subdomain) → SPA
  return handleSpa(request);
}

// --- 6. Start Deno.serve ---
Deno.serve({ port: GATEWAY_PORT, hostname: "0.0.0.0" }, async (request: Request) => {
  try {
    return await route(request);
  } catch (err) {
    console.error("Gateway dev error:", err);
    return new Response("Internal Server Error", { status: 500 });
  }
});

console.log(`[gateway] Dev server running on http://localhost:${GATEWAY_PORT}`);
console.log(`[gateway] Routes: relay=8081 blossom=8082 spa=5173`);
