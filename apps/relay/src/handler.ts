import { getEventHash, verifyEvent } from "@nsite/shared/nostr-verify";
import type { Client } from "@libsql/client/web";
import { isAllowedKind } from "@nsite/shared/validation";
import { NsiteKind } from "@nsite/shared/types";
import type { NostrEvent, NostrFilter } from "@nsite/shared/types";
import {
  checkDuplicate,
  deleteEvents,
  insertEvent,
  insertParameterizedReplaceableEvent,
  insertReplaceableEvent,
  queryEvents,
} from "./db.ts";
import type { ConnectionState } from "./types.ts";

/** Check whether a NIP-01 filter matches the given event. */
function matchesFilter(event: NostrEvent, filter: NostrFilter): boolean {
  if (filter.ids?.length && !filter.ids.some((id) => event.id.startsWith(id))) {
    return false;
  }
  if (filter.authors?.length && !filter.authors.some((a) => event.pubkey.startsWith(a))) {
    return false;
  }
  if (filter.kinds?.length && !filter.kinds.includes(event.kind)) {
    return false;
  }
  if (filter.since !== undefined && event.created_at < filter.since) {
    return false;
  }
  if (filter.until !== undefined && event.created_at > filter.until) {
    return false;
  }
  // Single-letter tag filters: "#d", "#e", "#p", etc.
  for (const key of Object.keys(filter)) {
    if (key.startsWith("#") && key.length === 2) {
      const tagName = key[1];
      const values = filter[key] as string[];
      if (values?.length) {
        const hasMatch = event.tags.some(
          ([t, v]) => t === tagName && values.includes(v),
        );
        if (!hasMatch) return false;
      }
    }
  }
  return true;
}

/** Send a relay message to a WebSocket client. */
function send(socket: WebSocket, message: unknown[]): void {
  if (socket.readyState === WebSocket.OPEN) {
    socket.send(JSON.stringify(message));
  }
}

/**
 * Handle a NIP-01 EVENT message.
 *
 * Verification chain: missing fields → blocked kind → duplicate → bad id hash →
 * bad signature → future timestamp → kind-specific storage → broadcast to matching subscriptions.
 */
export async function handleEvent(
  socket: WebSocket,
  db: Client,
  event: NostrEvent,
  state: ConnectionState,
): Promise<void> {
  // a. Validate required fields
  if (
    event.id === undefined ||
    event.pubkey === undefined ||
    event.sig === undefined ||
    event.kind === undefined
  ) {
    send(socket, ["OK", event.id ?? "", false, "invalid: missing fields"]);
    return;
  }

  // b. Validate kind is allowed
  if (!isAllowedKind(event.kind)) {
    send(socket, [
      "OK",
      event.id,
      false,
      `blocked: kind ${event.kind} not allowed on this relay`,
    ]);
    return;
  }

  // c. Check for duplicate
  const isDuplicate = await checkDuplicate(db, event.id);
  if (isDuplicate) {
    send(socket, [
      "OK",
      event.id,
      true,
      "duplicate: already have this event",
    ]);
    return;
  }

  // d. Verify event id
  const computedHash = getEventHash(event);
  if (computedHash !== event.id) {
    send(socket, ["OK", event.id, false, "invalid: bad event id"]);
    return;
  }

  // e. Verify signature
  const sigValid = verifyEvent(event);
  if (!sigValid) {
    send(socket, ["OK", event.id, false, "invalid: bad signature"]);
    return;
  }

  // f. Check created_at — reject events more than 10 minutes in the future
  const nowSeconds = Math.floor(Date.now() / 1000);
  if (event.created_at > nowSeconds + 600) {
    send(socket, [
      "OK",
      event.id,
      false,
      "invalid: event created_at too far in the future",
    ]);
    return;
  }

  // g. Handle by kind
  switch (event.kind) {
    case NsiteKind.DELETION:
      await deleteEvents(db, event);
      break;
    case NsiteKind.RELAY_LIST:
    case NsiteKind.BLOSSOM_LIST:
      await insertReplaceableEvent(db, event);
      break;
    case NsiteKind.NAMED_SITE:
      await insertParameterizedReplaceableEvent(db, event);
      break;
    case NsiteKind.ROOT_SITE:
    default:
      await insertEvent(db, event);
      break;
  }

  send(socket, ["OK", event.id, true, ""]);

  // h. Broadcast to matching subscriptions on this connection
  for (const [subId, sub] of state.subscriptions) {
    const matches = sub.filters.some((filter) => matchesFilter(event, filter));
    if (matches) {
      send(socket, ["EVENT", subId, event]);
    }
  }
}

/**
 * Handle a NIP-01 REQ message.
 *
 * Validates subscription id and filters, queries matching events, sends each as EVENT,
 * sends EOSE, then stores the subscription in connection state.
 */
export async function handleReq(
  socket: WebSocket,
  db: Client,
  subscriptionId: string,
  filters: NostrFilter[],
  state: ConnectionState,
): Promise<void> {
  // a. Validate subscriptionId
  if (typeof subscriptionId !== "string" || subscriptionId.length === 0) {
    send(socket, [
      "NOTICE",
      "error: invalid subscription id",
    ]);
    return;
  }

  // b. Validate filters
  if (
    !Array.isArray(filters) ||
    filters.length === 0 ||
    !filters.every((f) => typeof f === "object" && f !== null && !Array.isArray(f))
  ) {
    send(socket, ["NOTICE", "error: filters must be a non-empty array of objects"]);
    return;
  }

  // c. Cap filters count at 10 (NIP-11 max_filters)
  if (filters.length > 10) {
    send(socket, ["NOTICE", "error: too many filters (max 10)"]);
    return;
  }

  // d. Query events
  const events = await queryEvents(db, filters);

  // e. Send each matched event
  for (const event of events) {
    send(socket, ["EVENT", subscriptionId, event]);
  }

  // f. Send EOSE
  send(socket, ["EOSE", subscriptionId]);

  // g. Store/replace subscription in connection state
  state.subscriptions.set(subscriptionId, { id: subscriptionId, filters });
}

/**
 * Handle a NIP-01 CLOSE message.
 *
 * Removes the subscription from connection state. No response is sent
 * (NIP-01 does not require a server response for CLOSE).
 */
export function handleClose(
  _socket: WebSocket,
  state: ConnectionState,
  subscriptionId: string,
): void {
  state.subscriptions.delete(subscriptionId);
}
