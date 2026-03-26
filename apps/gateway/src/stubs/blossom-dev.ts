/**
 * Dev-only blossom handler — runs blossom directly in the gateway using LocalStorageClient.
 * Replaces stubs/blossom.ts for local development, avoiding the need for BUNNY_STORAGE_* env vars.
 * Uses LocalStorageClient backed by the local filesystem instead of Bunny Storage.
 */
import { route as blossomRoute } from "../../../blossom/src/router.ts";
import { LocalStorageClient } from "../../../blossom/src/storage/local.ts";
import type { Config } from "../../../blossom/src/types.ts";

let _storage: LocalStorageClient | null = null;
let _config: Config | null = null;

function init(): { storage: LocalStorageClient; config: Config } {
  if (!_storage || !_config) {
    const port = Deno.env.get("BLOSSOM_PORT") ?? "8082";
    const storageDir = Deno.env.get("BLOSSOM_STORAGE_DIR") ?? ".dev-blossom-storage";
    const serverUrl = `http://localhost:${port}`;
    _config = {
      storagePassword: "dev",
      storageHostname: "localhost",
      storageUsername: "dev",
      cdnHostname: `localhost:${port}`,
      serverUrl,
      maxUploadSize: 104857600, // 100MB
    };
    _storage = new LocalStorageClient(storageDir, serverUrl);
  }
  return { storage: _storage as LocalStorageClient, config: _config };
}

export function handleBlossom(request: Request): Promise<Response> {
  const { storage, config } = init();
  // LocalStorageClient is structurally compatible with StorageClient — dev-only cast
  // deno-lint-ignore no-explicit-any
  return blossomRoute(request, storage as any, config);
}
