import type { BlobMeta, BlobIndexEntry, StoredReport, BlockedConfig, NostrEvent } from "../types.ts";
import type { StorageClient } from "./client.ts";

/** Read blob metadata, returns null if not found */
export async function getMeta(storage: StorageClient, sha256: string): Promise<BlobMeta | null> {
  return storage.getJson<BlobMeta>(storage.metaPath(sha256));
}

/** Write blob metadata */
export async function putMeta(storage: StorageClient, meta: BlobMeta): Promise<boolean> {
  return storage.putJson(storage.metaPath(meta.sha256), meta);
}

/** Add a pubkey as owner of a blob (creates meta if needed) */
export async function addOwner(
  storage: StorageClient,
  sha256: string,
  pubkey: string,
  size: number,
  type: string,
  nip94?: string[][],
): Promise<BlobMeta> {
  let meta = await getMeta(storage, sha256);
  const now = Math.floor(Date.now() / 1000);

  if (meta) {
    if (!meta.owners.includes(pubkey)) {
      meta.owners.push(pubkey);
    }
    // Update NIP-94 if provided (replace entirely)
    if (nip94) {
      meta.nip94 = nip94;
    }
  } else {
    meta = {
      sha256,
      size,
      type,
      uploaded: now,
      owners: [pubkey],
      nip94,
    };
  }

  await putMeta(storage, meta);
  return meta;
}

/** Remove a pubkey as owner. Returns true if blob should be deleted (no owners left) */
export async function removeOwner(
  storage: StorageClient,
  sha256: string,
  pubkey: string,
): Promise<{ deleted: boolean; meta: BlobMeta | null }> {
  const meta = await getMeta(storage, sha256);
  if (!meta) return { deleted: false, meta: null };

  meta.owners = meta.owners.filter((o) => o !== pubkey);
  if (meta.owners.length === 0) {
    // No owners left — delete blob and metadata
    await Promise.all([
      storage.delete(storage.blobPath(sha256)),
      storage.delete(storage.metaPath(sha256)),
    ]);
    return { deleted: true, meta };
  }

  await putMeta(storage, meta);
  return { deleted: false, meta };
}

/** Get the blob index for a pubkey */
export async function getIndex(storage: StorageClient, pubkey: string): Promise<BlobIndexEntry[]> {
  const result = await storage.getJson<BlobIndexEntry[]>(storage.listPath(pubkey));
  return Array.isArray(result) ? result : [];
}

/** Add an entry to a pubkey's blob index */
export async function addToIndex(
  storage: StorageClient,
  pubkey: string,
  entry: BlobIndexEntry,
): Promise<void> {
  const index = await getIndex(storage, pubkey);
  // Deduplicate by sha256
  const exists = index.some((e) => e.sha256 === entry.sha256);
  if (!exists) {
    index.push(entry);
    await storage.putJson(storage.listPath(pubkey), index);
  }
}

/** Remove an entry from a pubkey's blob index */
export async function removeFromIndex(
  storage: StorageClient,
  pubkey: string,
  sha256: string,
): Promise<void> {
  const index = await getIndex(storage, pubkey);
  const filtered = index.filter((e) => e.sha256 !== sha256);
  if (filtered.length !== index.length) {
    await storage.putJson(storage.listPath(pubkey), filtered);
  }
}

/** Get reports for a blob */
export async function getReports(storage: StorageClient, sha256: string): Promise<StoredReport> {
  return (await storage.getJson<StoredReport>(storage.reportPath(sha256))) || { reports: [] };
}

/** Add a report event for a blob */
export async function addReport(
  storage: StorageClient,
  sha256: string,
  event: NostrEvent,
): Promise<void> {
  const stored = await getReports(storage, sha256);
  stored.reports.push(event);
  await storage.putJson(storage.reportPath(sha256), stored);
}

/** Get the blocked hashes list */
export async function getBlocked(storage: StorageClient): Promise<BlockedConfig> {
  return (await storage.getToml<BlockedConfig>("config/blocked.toml")) || { hashes: [] };
}

/** In-memory cache for blocked hashes (persists within edge instance lifetime) */
let blockedCache: { hashes: Set<string>; expires: number } | null = null;
const BLOCKED_CACHE_TTL_MS = 60_000;

/** Check if a hash is blocked (cached with 60s TTL by default) */
export async function isBlocked(
  storage: StorageClient,
  sha256: string,
  ttlMs: number = BLOCKED_CACHE_TTL_MS,
): Promise<boolean> {
  const now = Date.now();
  if (blockedCache && now < blockedCache.expires) {
    return blockedCache.hashes.has(sha256);
  }
  const config = (await storage.getToml<BlockedConfig>("config/blocked.toml")) || { hashes: [] };
  blockedCache = { hashes: new Set(config.hashes), expires: now + ttlMs };
  return blockedCache.hashes.has(sha256);
}

/** Reset the module-level blocked cache — for use in tests only */
export function _resetBlockedCacheForTesting(): void {
  blockedCache = null;
}
