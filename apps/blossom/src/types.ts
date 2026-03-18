export type { NostrEvent } from "@nsite/shared/types";

/** Blossom BlobDescriptor as defined in BUD-01 */
export interface BlobDescriptor {
  url: string;
  sha256: string;
  size: number;
  type?: string;
  uploaded: number;
  /** NIP-94 metadata fields (BUD-08) — array of [key, value] pairs */
  nip94?: string[][];
}

/** Stored blob metadata */
export interface BlobMeta {
  sha256: string;
  size: number;
  type: string;
  uploaded: number;
  owners: string[];
  /** NIP-94 metadata from uploader — array of [key, value] pairs */
  nip94?: string[][];
}

/** Per-pubkey blob index entry */
export interface BlobIndexEntry {
  sha256: string;
  size: number;
  type: string;
  uploaded: number;
}

/** Report stored for BUD-09 */
export interface StoredReport {
  reports: import("@nsite/shared/types").NostrEvent[];
}

/** Blocked content config */
export interface BlockedConfig {
  hashes: string[];
}

/** Server configuration from environment */
export interface Config {
  /** Storage zone password (FTP & API Access → Password) */
  storagePassword: string;
  /** Storage zone hostname (FTP & API Access → Hostname, e.g. storage.bunnycdn.com) */
  storageHostname: string;
  /** Storage zone username (FTP & API Access → Username) */
  storageUsername: string;
  /** Public CDN hostname for blob URLs (e.g. myzone.b-cdn.net) */
  cdnHostname: string;
  /** Public Blossom server URL for auth server tag validation */
  serverUrl: string;
  /** Maximum upload size in bytes (default: 100 MiB) */
  maxUploadSize: number;
}

/** Auth result from Nostr event validation */
export interface AuthResult {
  authorized: boolean;
  pubkey?: string;
  error?: string;
  event?: import("@nsite/shared/types").NostrEvent;
}
