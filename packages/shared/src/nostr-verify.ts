/**
 * Lightweight Nostr event verification.
 * Replaces @nostr/tools/pure which pulls in ~280KB of unnecessary code
 * (ciphers, relay pools, etc.) causing Bunny Edge Scripting startup timeouts.
 *
 * Uses @noble/curves for schnorr signature verification and
 * @noble/hashes for SHA-256 (synchronous, no Web Crypto async).
 */

import { schnorr } from "@noble/curves/secp256k1";
import { sha256 } from "@noble/hashes/sha256";

interface NostrEventMinimal {
  id: string;
  pubkey: string;
  created_at: number;
  kind: number;
  tags: string[][];
  content: string;
  sig: string;
}

function bytesToHex(bytes: Uint8Array): string {
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

function hexToBytes(hex: string): Uint8Array {
  const bytes = new Uint8Array(hex.length / 2);
  for (let i = 0; i < hex.length; i += 2) {
    bytes[i / 2] = parseInt(hex.substring(i, i + 2), 16);
  }
  return bytes;
}

/**
 * Compute the NIP-01 event hash (SHA-256 of the serialized event).
 * Returns lowercase hex string.
 */
export function getEventHash(event: NostrEventMinimal): string {
  const serialized = JSON.stringify([
    0,
    event.pubkey,
    event.created_at,
    event.kind,
    event.tags,
    event.content,
  ]);
  const hash = sha256(new TextEncoder().encode(serialized));
  return bytesToHex(hash);
}

/**
 * Verify a Nostr event: check id matches hash AND schnorr signature is valid.
 */
export function verifyEvent(event: NostrEventMinimal): boolean {
  try {
    const hash = getEventHash(event);
    if (hash !== event.id) return false;
    return schnorr.verify(hexToBytes(event.sig), hexToBytes(hash), hexToBytes(event.pubkey));
  } catch {
    return false;
  }
}
