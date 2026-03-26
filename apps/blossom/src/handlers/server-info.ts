import type { Config } from "../types.ts";
import type { StorageClient } from "../storage/client.ts";
import { jsonResponse } from "../util.ts";

/**
 * GET /server-info — nsite-specific server information
 *
 * Returns simplified server config for nsite blossom (no payment/access aggregation).
 */
export function handleServerInfo(
  _storage: StorageClient,
  config: Config,
): Response {
  const info = {
    name: "nsite.run blossom",
    description: "nsite-only blossom server for nsite manifests",
    public: true,
    paymentsEnabled: false,
    serverUrl: config.serverUrl,
    maxUploadSize: config.maxUploadSize,
  };

  return jsonResponse(info, 200, {
    "Cache-Control": "public, max-age=60",
  });
}
