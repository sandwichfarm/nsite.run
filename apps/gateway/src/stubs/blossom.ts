/**
 * Blossom handler — runs blossom directly in the gateway (no proxy).
 * Initializes storage client and config from env vars, then routes
 * blossom requests through the blossom router.
 */
import { route as blossomRoute } from "../../../blossom/src/router.ts";
import { StorageClient } from "../../../blossom/src/storage/client.ts";
import type { Config } from "../../../blossom/src/types.ts";

let _storage: StorageClient | null = null;
let _config: Config | null = null;

function init(): { storage: StorageClient; config: Config } {
  if (!_storage || !_config) {
    const env = (key: string) => Deno.env.get(key) ?? "";
    _config = {
      storagePassword: env("BUNNY_STORAGE_PASSWORD"),
      storageHostname: env("BUNNY_STORAGE_HOSTNAME"),
      storageUsername: env("BUNNY_STORAGE_USERNAME"),
      cdnHostname: env("BUNNY_CDN_HOSTNAME"),
      serverUrl: env("SERVER_URL"),
      maxUploadSize: 104857600, // 100MB
    };
    _storage = new StorageClient(_config);
  }
  return { storage: _storage, config: _config };
}

export function handleBlossom(request: Request): Promise<Response> {
  const { storage, config } = init();
  return blossomRoute(request, storage, config);
}
