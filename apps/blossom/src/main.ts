import { route } from "./router.ts";
import { StorageClient } from "./storage/client.ts";
import type { Config } from "./types.ts";

declare const Bunny: {
  v1: { serve: (handler: (req: Request) => Response | Promise<Response>) => void };
};

function parseSize(s: string): number | null {
  if (!s) return null;
  const match = s.trim().match(/^(\d+(?:\.\d+)?)\s*(B|KB|MB|GB|TB)?$/i);
  if (!match) return null;
  const num = parseFloat(match[1]);
  const unit = (match[2] ?? "B").toUpperCase();
  const multipliers: Record<string, number> = {
    B: 1,
    KB: 1024,
    MB: 1024 * 1024,
    GB: 1024 * 1024 * 1024,
    TB: 1024 * 1024 * 1024 * 1024,
  };
  return Math.floor(num * (multipliers[unit] ?? 1));
}

function getConfig(): Config {
  const env = (key: string): string => {
    const v = (globalThis as Record<string, unknown>).process
      ? (
        (globalThis as Record<string, unknown>).process as Record<
          string,
          Record<string, string>
        >
      ).env[key]
      : Deno.env.get(key);
    return v ?? "";
  };

  const storagePassword = env("BUNNY_STORAGE_PASSWORD");
  const storageHostname = env("BUNNY_STORAGE_HOSTNAME");
  const storageUsername = env("BUNNY_STORAGE_USERNAME");
  const cdnHostname = env("BUNNY_CDN_HOSTNAME");
  const serverUrl = env("SERVER_URL");

  if (!storagePassword) throw new Error("BUNNY_STORAGE_PASSWORD is required");
  if (!storageHostname) throw new Error("BUNNY_STORAGE_HOSTNAME is required");
  if (!storageUsername) throw new Error("BUNNY_STORAGE_USERNAME is required");
  if (!cdnHostname) throw new Error("BUNNY_CDN_HOSTNAME is required");
  if (!serverUrl) throw new Error("SERVER_URL is required");

  const maxUploadSize = parseSize(env("MAX_UPLOAD_SIZE")) ?? 104857600; // 100MB default

  return {
    storagePassword,
    storageHostname,
    storageUsername,
    cdnHostname,
    serverUrl,
    maxUploadSize,
  };
}

// Initialize config and storage at module level (singleton pattern)
const config = getConfig();
const storage = new StorageClient(config);

Bunny.v1.serve(async (request: Request): Promise<Response> => {
  return route(request, storage, config);
});
