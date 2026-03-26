/**
 * Blossom local development entrypoint.
 *
 * This file is the local-dev replacement for main.ts. It:
 *  1. Uses LocalStorageClient for filesystem-backed blob storage
 *  2. Wires the router directly with a local Config (no Bunny Storage credentials needed)
 *  3. Serves on port 8082 via Deno.serve
 *
 * DO NOT import main.ts — it calls getConfig() which validates BUNNY_STORAGE_* env vars
 * and throws if they are missing.
 */

import { LocalStorageClient } from "./storage/local.ts";
import { route } from "./router.ts";
import type { Config } from "./types.ts";
import type { StorageClient } from "./storage/client.ts";

// Step 1: Configure local server settings
const PORT = parseInt(Deno.env.get("BLOSSOM_PORT") ?? "8082");
const STORAGE_DIR = Deno.env.get("BLOSSOM_STORAGE_DIR") ?? ".dev-blossom-storage";
const SERVER_URL = `http://localhost:${PORT}`;

// Step 2: Ensure storage directory exists
await Deno.mkdir(STORAGE_DIR, { recursive: true });

// Step 3: Create LocalStorageClient backed by local filesystem.
// Cast to StorageClient — LocalStorageClient implements the same interface structurally.
const storage = new LocalStorageClient(STORAGE_DIR, SERVER_URL) as unknown as StorageClient;

// Step 4: Build a dev Config — no real credentials needed for local dev
const config: Config = {
  storagePassword: "dev",
  storageHostname: "localhost",
  storageUsername: "dev",
  cdnHostname: `localhost:${PORT}`,
  serverUrl: SERVER_URL,
  maxUploadSize: 104857600, // 100MB
};

// Step 5: Inject Bunny.v1.serve polyfill (not used to start, but present for compatibility)
(globalThis as Record<string, unknown>).Bunny = {
  v1: {
    serve: (handler: (req: Request) => Response | Promise<Response>) => {
      Deno.serve({ port: PORT, hostname: "0.0.0.0" }, handler);
    },
  },
};

// Step 6: Start the server using the existing blossom router
Deno.serve({ port: PORT, hostname: "0.0.0.0" }, (request: Request) => {
  return route(request, storage, config);
});

console.log(`[blossom] listening on ${SERVER_URL}`);
