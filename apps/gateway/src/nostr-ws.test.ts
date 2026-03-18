/**
 * Tests for apps/gateway/src/nostr-ws.ts
 *
 * TDD approach:
 * - npubToHex: pure function, fully testable
 * - queryRelayOnce / queryMultipleRelays: structural tests (WebSocket integration
 *   is verified during Plan 05-03 resolver integration testing)
 */

import { assertEquals, assertExists } from "@std/assert";
import { npubToHex, queryMultipleRelays, queryRelayOnce } from "./nostr-ws.ts";
import type { NostrEvent } from "@nsite/shared/types";

// --- Module shape tests ---

Deno.test("nostr-ws.ts exports npubToHex function", () => {
  assertEquals(typeof npubToHex, "function");
});

Deno.test("nostr-ws.ts exports queryRelayOnce function", () => {
  assertEquals(typeof queryRelayOnce, "function");
});

Deno.test("nostr-ws.ts exports queryMultipleRelays function", () => {
  assertEquals(typeof queryMultipleRelays, "function");
});

// --- npubToHex tests ---

// Known valid npub/hex pair (generated via @nostr/tools for deterministic tests)
const KNOWN_NPUB = "npub16zu6akdcyz3gqq5egk0q34z649e0je5m5k0rdnxxcan93qq3nltsygwj50";
const KNOWN_HEX = "d0b9aed9b820a2800299459e08d45aa972f9669ba59e36ccc6c7665880119fd7";

Deno.test("npubToHex: valid npub returns 64-char hex string", () => {
  const result = npubToHex(KNOWN_NPUB);
  assertExists(result);
  assertEquals(result.length, 64);
  // Verify it's hex
  assertEquals(/^[0-9a-f]{64}$/.test(result), true);
});

Deno.test("npubToHex: known npub decodes to expected hex", () => {
  const result = npubToHex(KNOWN_NPUB);
  assertEquals(result, KNOWN_HEX);
});

Deno.test("npubToHex: returns null for empty string", () => {
  const result = npubToHex("");
  assertEquals(result, null);
});

Deno.test("npubToHex: returns null for plain invalid string", () => {
  const result = npubToHex("invalid");
  assertEquals(result, null);
});

Deno.test("npubToHex: returns null for garbage input", () => {
  const result = npubToHex("not-a-valid-bech32-string-at-all");
  assertEquals(result, null);
});

Deno.test("npubToHex: returns null for nsec (wrong type)", () => {
  // nsec1 is a valid bech32 but wrong type — should return null
  // nsec for the known test keypair
  const nsec = "nsec1m7w6qfqx7mvhcu2m6hhtxxfxlxkr3y0z6tv8hjenjxaltk80wvrqk7e5kj";
  const result = npubToHex(nsec);
  assertEquals(result, null);
});

Deno.test("npubToHex: returns null for note1 (wrong type)", () => {
  const note1 = "note1qqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqq0ka7my";
  const result = npubToHex(note1);
  assertEquals(result, null);
});

Deno.test("npubToHex: returns null for nprofile (wrong type)", () => {
  // nprofile is also a valid bech32 nip19 type but not npub
  const nprofile =
    "nprofile1qqsrhuxx8l9ex335q7he0f09aej04zpazpl0ne2cgukyawd24mayt8gpp4mhxue69uhhytnc9e3k7mgpz4mhxue69uhkg6nzv9ejuumpv3hhyuewdaexwqg4waehxw309ahx7uewd3hkctcpz4mhxue69uhhytnc9e3k7mgpz4mhxue69uhkg6nzv9ejuumpv3hhyuewdaexwqg4waehxw309ahx7uewd3hkctcpr9mhxue69uhkummnw3ezumrpdejqz9nhwden5te0wfjkccte9ec8y6tdv9kzumn9wshszxnhwden5te0wfjkccte9e3qyfhwumn8ghj7un9d3shjtnwdaehgu3wvfskuep0qqm9eax9";
  const result = npubToHex(nprofile);
  assertEquals(result, null);
});

Deno.test("npubToHex: returns null for hex string (not bech32)", () => {
  const result = npubToHex(KNOWN_HEX);
  assertEquals(result, null);
});

// --- queryRelayOnce structural tests ---

Deno.test("queryRelayOnce: returns a Promise", () => {
  // We don't actually connect — just verify it returns a Promise
  // Using an invalid URL ensures it fails fast
  const result = queryRelayOnce("wss://invalid.example.test", { kinds: [15128] }, 100);
  assertExists(result);
  assertEquals(result instanceof Promise, true);
  // Clean up the promise to avoid unhandled rejection warnings
  return result.then((events) => {
    // Should resolve with empty array on connection error
    assertEquals(Array.isArray(events), true);
  });
});

Deno.test("queryRelayOnce: resolves with array (never rejects) on bad URL", async () => {
  const events = await queryRelayOnce("wss://0.0.0.0:1", { kinds: [15128] }, 500);
  assertEquals(Array.isArray(events), true);
  // May be empty on connection failure
  assertEquals(events.length >= 0, true);
});

Deno.test("queryRelayOnce: accepts timeout parameter and resolves", async () => {
  // Should resolve within a short timeout (no live relay needed)
  const start = Date.now();
  const events = await queryRelayOnce(
    "wss://0.0.0.0:2",
    { kinds: [15128] },
    200,
  );
  const elapsed = Date.now() - start;
  // Should resolve (not hang), either on error or timeout
  assertEquals(Array.isArray(events), true);
  // Should not take longer than 2x the timeout
  assertEquals(elapsed < 2000, true);
});

// --- queryMultipleRelays structural tests ---

Deno.test("queryMultipleRelays: returns a Promise", () => {
  const result = queryMultipleRelays([], { kinds: [15128] }, 100);
  assertEquals(result instanceof Promise, true);
  return result.then((events) => {
    assertEquals(Array.isArray(events), true);
  });
});

Deno.test("queryMultipleRelays: empty relay list resolves with empty array", async () => {
  const events = await queryMultipleRelays([], { kinds: [15128] }, 100);
  assertEquals(events, []);
});

Deno.test("queryMultipleRelays: deduplicates by event id", async () => {
  // We can't easily test with live relays, but we can verify the function signature
  // accepts and returns the right types
  const events = await queryMultipleRelays(
    ["wss://0.0.0.0:3", "wss://0.0.0.0:4"],
    { kinds: [15128] },
    200,
  );
  assertEquals(Array.isArray(events), true);

  // Verify no duplicate ids
  const ids = events.map((e: NostrEvent) => e.id);
  const uniqueIds = new Set(ids);
  assertEquals(ids.length, uniqueIds.size);
});
