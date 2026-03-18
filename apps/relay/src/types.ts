import type { NostrEvent, NostrFilter } from "@nsite/shared/types";

/** Parsed client-to-relay messages (NIP-01) */
export type ClientMessage =
  | ["EVENT", NostrEvent]
  | ["REQ", string, ...NostrFilter[]]
  | ["CLOSE", string];

/** Relay-to-client messages (NIP-01) */
export type RelayMessage =
  | ["EVENT", string, NostrEvent] // subscription_id, event
  | ["OK", string, boolean, string] // event_id, accepted, message
  | ["EOSE", string] // subscription_id
  | ["NOTICE", string]; // message

/** Active subscription for a WebSocket connection */
export interface Subscription {
  id: string;
  filters: NostrFilter[];
}

/** Per-connection state managed during WebSocket lifetime */
export interface ConnectionState {
  subscriptions: Map<string, Subscription>;
  rateLimitBucket: RateLimitBucket;
}

/** Rate limit tracking for a single connection */
export interface RateLimitBucket {
  eventCount: number;
  reqCount: number;
  windowStart: number;
}
