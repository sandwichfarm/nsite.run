/**
 * Cache types and state for the nsite gateway resolver.
 *
 * Provides:
 * - CacheEntry type for per-site cache state
 * - Module-level Maps for site cache and background check deduplication
 * - Helper functions for cache key computation, manifest parsing, and relay URL extraction
 * - Minimal StorageClient for Bunny Storage blob persistence (gateway subset)
 *
 * StorageClient is copied inline (not imported from apps/blossom) per RESEARCH.md Pitfall 6:
 * Edge Scripts have independent module graphs; cross-package imports break the build.
 */

import type { NostrEvent } from "@nsite/shared/types";

// --- Types ---

/**
 * Cache entry for a single nsite (root or named).
 * State machine: loading → ready | not-found
 */
export interface CacheEntry {
  /** Hex pubkey (64 chars) */
  pubkey: string;
  /** For named sites (kind 35128), the site identifier (e.g., "blog") */
  identifier?: string;
  /** The resolved manifest event, or null while loading */
  manifestEvent: NostrEvent | null;
  /** Files map: normalized path → sha256 hash */
  files: Map<string, string>;
  /** Blossom server URLs from manifest "server" tags, then kind 10063 */
  blossomServers: string[];
  /** Date.now() when manifest was cached (0 if not yet cached) */
  cachedAt: number;
  /** Cache state */
  state: "loading" | "ready" | "not-found";
  /** Set by background check when a newer manifest was found */
  updateAvailable?: boolean;
  /** Promise that resolves when loading → ready/not-found. Allows asset requests to wait. */
  ready?: Promise<void>;
  /** Resolve function for the ready promise */
  resolveReady?: () => void;
}

// --- Module-level state (shared across requests on same edge worker instance) ---

/** Site cache: cacheKey → CacheEntry */
export const siteCache = new Map<string, CacheEntry>();

/** Background check deduplication gate: cacheKey → in-flight Promise */
export const backgroundChecks = new Map<string, Promise<void>>();

// --- Helper functions ---

/**
 * Compute a cache key from a pubkey and optional identifier.
 * Returns "pubkey" for root sites, "pubkey:identifier" for named sites.
 */
export function cacheKey(pubkey: string, identifier?: string): string {
  if (identifier) return `${pubkey}:${identifier}`;
  return pubkey;
}

/**
 * Parse path tags from a manifest event.
 * Tags with format ["path", "/some/path", "sha256hash"] → Map<path, sha256>
 * Tags with fewer than 3 elements or non-"path" tag names are skipped.
 */
export function getManifestFiles(manifest: NostrEvent): Map<string, string> {
  const files = new Map<string, string>();
  for (const tag of manifest.tags) {
    if (tag[0] === "path" && tag.length >= 3 && tag[1] && tag[2]) {
      files.set(tag[1], tag[2]);
    }
  }
  return files;
}

/**
 * Parse server tags from a manifest or blossom-list event.
 * Tags with format ["server", "https://blossom.example.com"] → [url, ...]
 */
export function getManifestServers(manifest: NostrEvent): string[] {
  return manifest.tags
    .filter((t) => t[0] === "server" && t.length >= 2 && t[1])
    .map((t) => t[1]);
}

/**
 * Parse relay URLs from a NIP-65 relay list event (kind 10002).
 * Tags with format ["r", "wss://relay.example.com"] or
 * ["r", "wss://relay.example.com", "read"|"write"] → [url, ...]
 * Only "r" tags are considered; all relays are returned (read, write, and unlabeled).
 */
export function getRelayUrls(relayListEvent: NostrEvent): string[] {
  return relayListEvent.tags
    .filter((t) => t[0] === "r" && t.length >= 2 && t[1])
    .map((t) => t[1]);
}

// --- Minimal StorageClient for Bunny Storage blob persistence ---

/**
 * Minimal Bunny Storage REST API client for the gateway.
 *
 * Only includes methods needed by the resolver: put, get, head, blobPath.
 * Copied inline (not imported from apps/blossom/src/storage/client.ts) per Pitfall 6.
 * The blossom StorageClient has TOML parsing and other blossom-specific methods
 * the gateway does not need.
 */
export class StorageClient {
  private baseUrl: string;
  private accessKey: string;

  constructor(
    storageHostname: string,
    storageUsername: string,
    storagePassword: string,
  ) {
    this.baseUrl = `https://${storageHostname}/${storageUsername}`;
    this.accessKey = storagePassword;
  }

  private headers(): Record<string, string> {
    return { AccessKey: this.accessKey };
  }

  /** Upload a blob to storage. Returns true on success (HTTP 201). */
  async put(
    path: string,
    body: BodyInit,
    contentType?: string,
  ): Promise<boolean> {
    const headers: Record<string, string> = {
      ...this.headers(),
      "Content-Type": contentType ?? "application/octet-stream",
    };
    try {
      const resp = await fetch(`${this.baseUrl}/${path}`, {
        method: "PUT",
        headers,
        body,
      });
      return resp.status === 201;
    } catch {
      return false;
    }
  }

  /** Download a blob from storage. Returns null if not found (HTTP 404). */
  async get(path: string): Promise<Response | null> {
    try {
      const resp = await fetch(`${this.baseUrl}/${path}`, {
        method: "GET",
        headers: this.headers(),
      });
      if (resp.status === 404) return null;
      return resp;
    } catch {
      return null;
    }
  }

  /** HEAD check — returns null if not found (HTTP 404). */
  async head(path: string): Promise<Response | null> {
    try {
      const resp = await fetch(`${this.baseUrl}/${path}`, {
        method: "HEAD",
        headers: this.headers(),
      });
      if (resp.status === 404) return null;
      return resp;
    } catch {
      return null;
    }
  }

  /** Get the storage path for a blob (used for put and get). */
  blobPath(sha256: string): string {
    const pre = sha256.substring(0, 2);
    return `blobs/${pre}/${sha256}`;
  }
}

/**
 * Create a StorageClient from environment variables.
 * Returns null if any required env var is missing — blob persistence is disabled gracefully.
 *
 * Required env vars:
 * - BUNNY_STORAGE_HOSTNAME (e.g., "storage.bunnycdn.com")
 * - BUNNY_STORAGE_USERNAME (e.g., "my-storage-zone")
 * - BUNNY_STORAGE_PASSWORD (access key)
 * - BUNNY_CDN_HOSTNAME (not required by gateway, but checked for completeness)
 */
export function createStorageClient(): StorageClient | null {
  const hostname = Deno.env.get("BUNNY_STORAGE_HOSTNAME");
  const username = Deno.env.get("BUNNY_STORAGE_USERNAME");
  const password = Deno.env.get("BUNNY_STORAGE_PASSWORD");

  if (!hostname || !username || !password) return null;

  return new StorageClient(hostname, username, password);
}
