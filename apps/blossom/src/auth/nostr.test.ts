/// <reference lib="deno.ns" />
import { assertEquals } from "@std/assert";
import { finalizeEvent, generateSecretKey, getPublicKey } from "@nostr/tools/pure";
import { validateAuth } from "./nostr.ts";

// Helper to create Authorization header from any event object
function makeAuthHeader(event: object): string {
  return "Nostr " + btoa(JSON.stringify(event));
}

// Helper to build a valid kind 24242 signed auth event
function makeValidAuthEvent(
  secretKey: Uint8Array,
  verb: string,
  sha256?: string,
): object {
  const _pubkey = getPublicKey(secretKey);
  const tags: string[][] = [
    ["t", verb],
    ["expiration", String(Math.floor(Date.now() / 1000) + 600)],
  ];
  if (sha256 !== undefined) {
    tags.push(["x", sha256]);
  }
  return finalizeEvent(
    {
      kind: 24242,
      created_at: Math.floor(Date.now() / 1000),
      tags,
      content: `${verb} blob`,
    },
    secretKey,
  );
}

Deno.test("validateAuth: missing Authorization header returns unauthorized", async () => {
  const request = new Request("https://blossom.test/upload", { method: "PUT" });
  const result = await validateAuth(request, { verb: "upload" });
  assertEquals(result.authorized, false);
});

Deno.test("validateAuth: wrong kind returns unauthorized", async () => {
  const secretKey = generateSecretKey();
  const badEvent = finalizeEvent(
    {
      kind: 1, // not 24242
      created_at: Math.floor(Date.now() / 1000),
      tags: [["t", "upload"]],
      content: "not a blossom event",
    },
    secretKey,
  );
  const request = new Request("https://blossom.test/upload", {
    method: "PUT",
    headers: { "Authorization": makeAuthHeader(badEvent) },
  });
  const result = await validateAuth(request, { verb: "upload" });
  assertEquals(result.authorized, false);
});

Deno.test("validateAuth: expired created_at returns unauthorized", async () => {
  const secretKey = generateSecretKey();
  // 5 minutes ago — outside the 120-second window
  const expiredEvent = finalizeEvent(
    {
      kind: 24242,
      created_at: Math.floor(Date.now() / 1000) - 300,
      tags: [["t", "upload"], ["expiration", String(Math.floor(Date.now() / 1000) + 600)]],
      content: "upload blob",
    },
    secretKey,
  );
  const request = new Request("https://blossom.test/upload", {
    method: "PUT",
    headers: { "Authorization": makeAuthHeader(expiredEvent) },
  });
  const result = await validateAuth(request, { verb: "upload" });
  assertEquals(result.authorized, false);
});

Deno.test("validateAuth: within 120s window returns authorized", async () => {
  const secretKey = generateSecretKey();
  const pubkey = getPublicKey(secretKey);
  const testHash = "a".repeat(64);
  const event = makeValidAuthEvent(secretKey, "upload", testHash);
  const request = new Request("https://blossom.test/upload", {
    method: "PUT",
    headers: { "Authorization": makeAuthHeader(event) },
  });
  const result = await validateAuth(request, { verb: "upload", sha256: testHash });
  assertEquals(result.authorized, true);
  if (result.authorized) {
    assertEquals(result.pubkey, pubkey);
  }
});

Deno.test("validateAuth: missing t tag returns unauthorized", async () => {
  const secretKey = generateSecretKey();
  const noTTagEvent = finalizeEvent(
    {
      kind: 24242,
      created_at: Math.floor(Date.now() / 1000),
      tags: [["expiration", String(Math.floor(Date.now() / 1000) + 600)]],
      content: "upload blob",
    },
    secretKey,
  );
  const request = new Request("https://blossom.test/upload", {
    method: "PUT",
    headers: { "Authorization": makeAuthHeader(noTTagEvent) },
  });
  const result = await validateAuth(request, { verb: "upload" });
  assertEquals(result.authorized, false);
});

Deno.test("validateAuth: t tag verb mismatch returns unauthorized", async () => {
  const secretKey = generateSecretKey();
  // t tag says "delete" but we validate for "upload"
  const mismatchEvent = makeValidAuthEvent(secretKey, "delete");
  const request = new Request("https://blossom.test/upload", {
    method: "PUT",
    headers: { "Authorization": makeAuthHeader(mismatchEvent) },
  });
  const result = await validateAuth(request, { verb: "upload" });
  assertEquals(result.authorized, false);
});

Deno.test("validateAuth: missing x tag on upload verb returns unauthorized", async () => {
  const secretKey = generateSecretKey();
  // LOCKED decision: x tag required for upload; absent x tag must be rejected
  const noXTagEvent = makeValidAuthEvent(secretKey, "upload"); // no sha256 arg = no x tag
  const request = new Request("https://blossom.test/upload", {
    method: "PUT",
    headers: { "Authorization": makeAuthHeader(noXTagEvent) },
  });
  const result = await validateAuth(request, { verb: "upload", sha256: "a".repeat(64) });
  assertEquals(result.authorized, false);
});

Deno.test("validateAuth: x tag hash mismatch returns unauthorized", async () => {
  const secretKey = generateSecretKey();
  const wrongHash = "b".repeat(64);
  const correctHash = "a".repeat(64);
  // Event says x=wrongHash but we validate against correctHash
  const mismatchXEvent = makeValidAuthEvent(secretKey, "upload", wrongHash);
  const request = new Request("https://blossom.test/upload", {
    method: "PUT",
    headers: { "Authorization": makeAuthHeader(mismatchXEvent) },
  });
  const result = await validateAuth(request, { verb: "upload", sha256: correctHash });
  assertEquals(result.authorized, false);
});

Deno.test("validateAuth: valid event with matching x tag returns authorized", async () => {
  const secretKey = generateSecretKey();
  const pubkey = getPublicKey(secretKey);
  const testHash = "c".repeat(64);
  const event = makeValidAuthEvent(secretKey, "upload", testHash);
  const request = new Request("https://blossom.test/upload", {
    method: "PUT",
    headers: { "Authorization": makeAuthHeader(event) },
  });
  const result = await validateAuth(request, { verb: "upload", sha256: testHash });
  assertEquals(result.authorized, true);
  if (result.authorized) {
    assertEquals(result.pubkey, pubkey);
  }
});
