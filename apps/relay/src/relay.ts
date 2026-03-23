import type { Client } from "@libsql/client/web";
import type { NostrEvent, NostrFilter } from "@nsite/shared/types";
import { handleClose, handleEvent, handleReq } from "./handler.ts";
import { checkRateLimit, createRateLimitBucket } from "./ratelimit.ts";
import type { ConnectionState } from "./types.ts";

/** Send a relay message to a WebSocket client. */
function send(socket: WebSocket, message: unknown[]): void {
  if (socket.readyState === WebSocket.OPEN) {
    socket.send(JSON.stringify(message));
  }
}

/**
 * Upgrade an HTTP request to a WebSocket connection and handle NIP-01 messages.
 *
 * Sets up per-connection state, rate limiting, and dispatches parsed messages
 * to handleEvent / handleReq / handleClose.
 *
 * MUST return the response from Deno.upgradeWebSocket to complete the upgrade.
 */
export function handleWebSocketUpgrade(
  socket: WebSocket,
  db: Client,
  schemaReady?: Promise<void> | null,
): void {
  const state: ConnectionState = {
    subscriptions: new Map(),
    rateLimitBucket: createRateLimitBucket(),
  };

  // Bunny WebSocket API uses addEventListener, not on* properties
  socket.addEventListener("open", () => {});

  socket.addEventListener("message", (event: MessageEvent) => {
    // Wrap in async IIFE — Bunny may not support async event listeners
    (async () => {
      // Ensure DB schema is ready before processing any message
      if (schemaReady) await schemaReady;

      // Parse JSON
      let parsed: unknown;
      try {
        parsed = JSON.parse(event.data as string);
      } catch {
        send(socket, ["NOTICE", "error: invalid JSON"]);
        socket.close();
        return;
      }

      // Must be a non-empty array
      if (!Array.isArray(parsed) || parsed.length === 0) {
        send(socket, ["NOTICE", "error: expected JSON array"]);
        socket.close();
        return;
      }

      const [type, ...args] = parsed as [string, ...unknown[]];

      try {
        switch (type) {
          case "EVENT": {
            // Rate-limit check
            if (!checkRateLimit(state.rateLimitBucket, "event")) {
              const eventArg = args[0] as Record<string, unknown> | undefined;
              const eventId = typeof eventArg?.id === "string" ? eventArg.id : "";
              send(socket, [
                "OK",
                eventId,
                false,
                "rate-limited: too many events",
              ]);
              return;
            }
            if (typeof args[0] !== "object" || args[0] === null || Array.isArray(args[0])) {
              send(socket, ["NOTICE", "error: EVENT payload must be an object"]);
              return;
            }
            const nostrEvent = args[0] as NostrEvent;
            console.info(
              `[relay] received EVENT id=${nostrEvent.id} kind=${nostrEvent.kind} pubkey=${nostrEvent.pubkey}`,
            );
            await handleEvent(socket, db, nostrEvent, state);
            break;
          }

          case "REQ": {
            // Rate-limit check
            if (!checkRateLimit(state.rateLimitBucket, "req")) {
              send(socket, ["NOTICE", "rate-limited: too many subscriptions"]);
              return;
            }
            if (typeof args[0] !== "string") {
              send(socket, ["NOTICE", "error: REQ subscription id must be a string"]);
              return;
            }
            await handleReq(
              socket,
              db,
              args[0],
              args.slice(1) as NostrFilter[],
              state,
            );
            break;
          }

          case "CLOSE": {
            if (typeof args[0] !== "string") {
              send(socket, ["NOTICE", "error: CLOSE subscription id must be a string"]);
              return;
            }
            handleClose(socket, state, args[0]);
            break;
          }

          default:
            send(socket, ["NOTICE", `error: unknown message type ${type}`]);
            break;
        }
      } catch (err) {
        console.error("[relay] error handling message:", err);
        send(socket, ["NOTICE", "error: " + String(err)]);
      }
    })();
  });

  socket.addEventListener("close", () => {
    state.subscriptions.clear();
  });

  socket.addEventListener("error", (err: Event) => {
    const msg = (err as ErrorEvent).message ?? "";
    if (msg !== "Unexpected EOF") {
      console.error("[relay] WebSocket error:", msg);
    }
  });
}
