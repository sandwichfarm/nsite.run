import { assertEquals } from "@std/assert";
import { isAllowedKind, validateEventKind } from "./validation.ts";
import type { NostrEvent } from "./types.ts";

function makeEvent(kind: number): NostrEvent {
  return {
    id: "abc123",
    pubkey: "pubkey123",
    created_at: 1700000000,
    kind,
    tags: [],
    content: "",
    sig: "sig123",
  };
}

Deno.test("isAllowedKind returns true for kind 15128 (ROOT_SITE)", () => {
  assertEquals(isAllowedKind(15128), true);
});

Deno.test("isAllowedKind returns true for kind 35128 (NAMED_SITE)", () => {
  assertEquals(isAllowedKind(35128), true);
});

Deno.test("isAllowedKind returns true for kind 10002 (RELAY_LIST)", () => {
  assertEquals(isAllowedKind(10002), true);
});

Deno.test("isAllowedKind returns true for kind 10063 (BLOSSOM_LIST)", () => {
  assertEquals(isAllowedKind(10063), true);
});

Deno.test("isAllowedKind returns false for kind 1 (text note)", () => {
  assertEquals(isAllowedKind(1), false);
});

Deno.test("isAllowedKind returns false for kind 0 (profile)", () => {
  assertEquals(isAllowedKind(0), false);
});

Deno.test("isAllowedKind returns false for kind 30023 (long-form)", () => {
  assertEquals(isAllowedKind(30023), false);
});

Deno.test("validateEventKind returns valid for kind 15128", () => {
  const result = validateEventKind(makeEvent(15128));
  assertEquals(result.valid, true);
});

Deno.test("validateEventKind returns valid for kind 35128", () => {
  const result = validateEventKind(makeEvent(35128));
  assertEquals(result.valid, true);
});

Deno.test("validateEventKind returns invalid with reason for kind 1", () => {
  const result = validateEventKind(makeEvent(1));
  assertEquals(result.valid, false);
  if (!result.valid) {
    assertEquals(typeof result.reason, "string");
    assertEquals(result.reason.length > 0, true);
  }
});

Deno.test("validateEventKind returns invalid with reason for kind 0", () => {
  const result = validateEventKind(makeEvent(0));
  assertEquals(result.valid, false);
  if (!result.valid) {
    assertEquals(typeof result.reason, "string");
  }
});

Deno.test("isAllowedKind returns true for kind 5 (DELETION)", () => {
  assertEquals(isAllowedKind(5), true);
});

Deno.test("validateEventKind returns valid for kind 5", () => {
  const result = validateEventKind(makeEvent(5));
  assertEquals(result.valid, true);
});
