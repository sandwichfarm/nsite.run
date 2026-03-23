/**
 * Relay local development entrypoint.
 *
 * This file is the local-dev replacement for main.ts. It:
 *  1. Sets env vars for local SQLite DB (must come BEFORE any DB client creation)
 *  2. Injects a Bunny.v1.serve polyfill into globalThis
 *  3. Patches Request.prototype.upgradeWebSocket to use Deno.upgradeWebSocket
 *  4. Starts the relay handler using @libsql/client/node (supports file: URLs)
 *
 * DO NOT import main.ts — it hardcodes @libsql/client/web which rejects file: URLs
 * and creates the DB client at module evaluation time before env vars can be set.
 */

// Step 1: Set local DB env vars FIRST — before any DB client is created
Deno.env.set("BUNNY_DB_URL", "file:./dev-relay.db");
Deno.env.set("BUNNY_DB_AUTH_TOKEN", "");

// Step 2: Inject Bunny.v1.serve polyfill into globalThis
const PORT = parseInt(Deno.env.get("RELAY_PORT") ?? "8081");
(globalThis as Record<string, unknown>).Bunny = {
  v1: {
    serve: (handler: (req: Request) => Response | Promise<Response>) => {
      Deno.serve({ port: PORT, hostname: "0.0.0.0" }, handler);
    },
  },
};

// Step 3: Patch Request.prototype.upgradeWebSocket — relay main.ts calls
// (request as any).upgradeWebSocket() which is a Bunny platform API.
// Under Deno, delegate to the native Deno.upgradeWebSocket().
(Request.prototype as unknown as Record<string, unknown>).upgradeWebSocket = function (
  this: Request,
) {
  return Deno.upgradeWebSocket(this);
};

// Step 4: Import the relay logic using @libsql/client/node which supports file: URLs.
// We duplicate ~25 lines from main.ts to avoid the import map conflict where
// main.ts uses "@libsql/client/web" (mapped in deno.json) which rejects file: URLs.
import { createClient } from "npm:@libsql/client/node";
import { initSchema } from "./db.ts";
import { buildNip11Response } from "./nip11.ts";
import { handleWebSocketUpgrade } from "./relay.ts";

// Create the local SQLite DB client
const db = createClient({ url: "file:./dev-relay.db" });

// Initialize schema eagerly so it's ready before first WebSocket message
const schemaReady = initSchema(db);

Deno.serve({ port: PORT, hostname: "0.0.0.0" }, async (request: Request): Promise<Response> => {
  // WebSocket upgrade
  if (
    request.headers.get("upgrade")?.toLowerCase() === "websocket" ||
    request.headers.has("sec-websocket-key")
  ) {
    // deno-lint-ignore no-explicit-any
    const { response, socket } = (request as any).upgradeWebSocket();
    handleWebSocketUpgrade(socket, db, schemaReady);
    return response;
  }

  // Schema init on HTTP requests (idempotent — safe to await here too)
  await schemaReady;

  // NIP-11: HTTP GET with Accept: application/nostr+json
  if (
    request.method === "GET" &&
    request.headers.get("accept")?.includes("application/nostr+json")
  ) {
    return buildNip11Response();
  }

  // Fallback for plain HTTP requests
  return new Response("nsite relay - connect via WebSocket", {
    status: 200,
    headers: {
      "Content-Type": "text/plain",
      "Access-Control-Allow-Origin": "*",
    },
  });
});

console.log(`[relay] listening on http://localhost:${PORT}`);
