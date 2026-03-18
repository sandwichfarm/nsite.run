/**
 * NIP-01 WebSocket client for querying external Nostr relays.
 * Provides npub bech32 decoding and lightweight relay query functions.
 *
 * Design decisions:
 * - Never rejects — always resolves with collected events (or empty array on failure)
 * - Timeout resolves gracefully with whatever events were collected
 * - queryMultipleRelays fans out in parallel and deduplicates by event id
 */

import type { NostrEvent, NostrFilter } from "@nsite/shared/types";

// --- Inline bech32 npub decoder (replaces @nostr/tools dependency) ---
// The full @nostr/tools package pulls in ~280KB of crypto libraries (secp256k1,
// AES, ChaCha, etc.) that blow Bunny Edge Scripting's cold-start timeout.
// npub decoding is just bech32 → 32 bytes → hex, so we inline it.

const BECH32_ALPHABET = "qpzry9x8gf2tvdw0s3jn54khce6mua7l";
const ALPHABET_MAP = new Map<string, number>();
for (let i = 0; i < BECH32_ALPHABET.length; i++) {
  ALPHABET_MAP.set(BECH32_ALPHABET[i], i);
}

function bech32Decode(str: string): { prefix: string; words: number[] } | null {
  if (str.length < 8 || str.length > 90) return null;
  const lowered = str.toLowerCase();
  if (lowered !== str && str.toUpperCase() !== str) return null;

  const sepIdx = lowered.lastIndexOf("1");
  if (sepIdx < 1 || sepIdx + 7 > lowered.length) return null;

  const prefix = lowered.slice(0, sepIdx);
  const dataPart = lowered.slice(sepIdx + 1);

  const words: number[] = [];
  for (let i = 0; i < dataPart.length; i++) {
    const v = ALPHABET_MAP.get(dataPart[i]);
    if (v === undefined) return null;
    words.push(v);
  }

  // Verify checksum (BIP-173 bech32)
  if (!verifyChecksum(prefix, words)) return null;

  // Strip 6-character checksum
  return { prefix, words: words.slice(0, -6) };
}

function verifyChecksum(prefix: string, words: number[]): boolean {
  let chk = 1;
  for (let i = 0; i < prefix.length; i++) {
    const c = prefix.charCodeAt(i);
    chk = polymodStep(chk) ^ (c >> 5);
  }
  chk = polymodStep(chk);
  for (let i = 0; i < prefix.length; i++) {
    const c = prefix.charCodeAt(i);
    chk = polymodStep(chk) ^ (c & 31);
  }
  for (const w of words) {
    chk = polymodStep(chk) ^ w;
  }
  return chk === 1;
}

function polymodStep(pre: number): number {
  const b = pre >>> 25;
  return (
    ((pre & 0x1ffffff) << 5) ^
    (b & 1 ? 0x3b6a57b2 : 0) ^
    (b & 2 ? 0x26508e6d : 0) ^
    (b & 4 ? 0x1ea119fa : 0) ^
    (b & 8 ? 0x3d4233dd : 0) ^
    (b & 16 ? 0x2a1462b3 : 0)
  );
}

function convertBits(
  data: number[],
  fromBits: number,
  toBits: number,
  pad: boolean,
): number[] | null {
  let acc = 0;
  let bits = 0;
  const result: number[] = [];
  const maxV = (1 << toBits) - 1;

  for (const value of data) {
    if (value < 0 || value >> fromBits !== 0) return null;
    acc = (acc << fromBits) | value;
    bits += fromBits;
    while (bits >= toBits) {
      bits -= toBits;
      result.push((acc >> bits) & maxV);
    }
  }

  if (pad) {
    if (bits > 0) result.push((acc << (toBits - bits)) & maxV);
  } else if (bits >= fromBits || ((acc << (toBits - bits)) & maxV) !== 0) {
    return null;
  }

  return result;
}

/**
 * Decode a bech32 npub string to a 64-character hex pubkey.
 * Returns null if the input is not a valid npub (wrong type, invalid bech32, etc.).
 */
export function npubToHex(npub: string): string | null {
  try {
    const decoded = bech32Decode(npub);
    if (!decoded || decoded.prefix !== "npub") return null;

    const bytes = convertBits(decoded.words, 5, 8, false);
    if (!bytes || bytes.length !== 32) return null;

    return bytes.map((b) => b.toString(16).padStart(2, "0")).join("");
  } catch {
    return null;
  }
}

/**
 * Query a single relay using raw NIP-01 WebSocket protocol.
 * Collects EVENT messages until EOSE or timeout, then resolves.
 * Never rejects — resolves with empty array on connection error or timeout.
 *
 * @param relayUrl - WebSocket URL of the relay (wss://...)
 * @param filter - NIP-01 subscription filter
 * @param timeoutMs - Maximum time to wait for EOSE before resolving
 */
export function queryRelayOnce(
  relayUrl: string,
  filter: NostrFilter,
  timeoutMs: number,
): Promise<NostrEvent[]> {
  return new Promise<NostrEvent[]>((resolve) => {
    const events: NostrEvent[] = [];
    const subId = crypto.randomUUID().slice(0, 8);
    let settled = false;
    // state holds mutable timer/ws refs so settle() can access them via closure
    const state: {
      timerId: ReturnType<typeof setTimeout> | undefined;
      ws: WebSocket | undefined;
    } = { timerId: undefined, ws: undefined };

    function settle(result: NostrEvent[]) {
      if (settled) return;
      settled = true;
      if (state.timerId !== undefined) clearTimeout(state.timerId);
      if (state.ws !== undefined && state.ws.readyState === WebSocket.OPEN) {
        state.ws.close();
      }
      resolve(result);
    }

    try {
      state.ws = new WebSocket(relayUrl);
    } catch {
      // WebSocket constructor can throw synchronously for invalid URLs
      resolve([]);
      return;
    }

    // Set timeout to resolve with collected events so far
    state.timerId = setTimeout(() => {
      settle(events);
    }, timeoutMs);

    const ws = state.ws;

    ws.addEventListener("open", () => {
      try {
        ws.send(JSON.stringify(["REQ", subId, filter]));
      } catch {
        settle(events);
      }
    });

    ws.addEventListener("message", (event: MessageEvent) => {
      try {
        const msg = JSON.parse(event.data as string) as unknown[];
        if (!Array.isArray(msg)) return;

        if (msg[0] === "EVENT" && msg[1] === subId && msg[2]) {
          events.push(msg[2] as NostrEvent);
        } else if (msg[0] === "EOSE" && msg[1] === subId) {
          settle(events);
        }
      } catch {
        // Ignore malformed messages
      }
    });

    ws.addEventListener("error", () => {
      settle(events);
    });

    ws.addEventListener("close", () => {
      settle(events);
    });
  });
}

/**
 * Query multiple relays in parallel and return deduplicated results.
 * Fans out queryRelayOnce to all relayUrls, collects all events,
 * deduplicates by event.id, and returns sorted by created_at DESC.
 *
 * @param relayUrls - Array of relay WebSocket URLs
 * @param filter - NIP-01 subscription filter
 * @param timeoutMs - Per-relay timeout
 */
export async function queryMultipleRelays(
  relayUrls: string[],
  filter: NostrFilter,
  timeoutMs: number,
): Promise<NostrEvent[]> {
  if (relayUrls.length === 0) return [];

  const results = await Promise.allSettled(
    relayUrls.map((url) => queryRelayOnce(url, filter, timeoutMs)),
  );

  const seen = new Set<string>();
  const deduplicated: NostrEvent[] = [];

  for (const result of results) {
    if (result.status === "fulfilled") {
      for (const event of result.value) {
        if (!seen.has(event.id)) {
          seen.add(event.id);
          deduplicated.push(event);
        }
      }
    }
  }

  // Sort by created_at descending (newest first)
  return deduplicated.sort((a, b) => b.created_at - a.created_at);
}
