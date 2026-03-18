/** A Nostr event */
export interface NostrEvent {
  id: string;
  pubkey: string;
  created_at: number;
  kind: number;
  tags: string[][];
  content: string;
  sig: string;
}

/** A Nostr subscription filter */
export interface NostrFilter {
  ids?: string[];
  authors?: string[];
  kinds?: number[];
  "#e"?: string[];
  "#p"?: string[];
  since?: number;
  until?: number;
  limit?: number;
  [key: string]: unknown;
}

/** nsite-specific Nostr event kinds */
export const NsiteKind = {
  DELETION: 5,
  ROOT_SITE: 15128,
  NAMED_SITE: 35128,
  RELAY_LIST: 10002,
  BLOSSOM_LIST: 10063,
} as const;

/** Result of an event validation check */
export type ValidationResult = { valid: true } | { valid: false; reason: string };
