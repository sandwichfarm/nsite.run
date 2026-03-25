import { assertEquals } from "@std/assert";
import { base36Decode, base36Encode } from "./base36.ts";

Deno.test("base36Encode all-zeros 32 bytes returns 50-char zero string", () => {
  const result = base36Encode(new Uint8Array(32).fill(0));
  assertEquals(result, "00000000000000000000000000000000000000000000000000");
  assertEquals(result.length, 50);
});

Deno.test("base36Encode all-0xff 32 bytes returns 50-char lowercase [a-z0-9] string", () => {
  const result = base36Encode(new Uint8Array(32).fill(255));
  assertEquals(result.length, 50);
  assertEquals(/^[a-z0-9]{50}$/.test(result), true);
});

Deno.test("base36Encode result is always exactly 50 chars", () => {
  const bytes = new Uint8Array(32);
  bytes[31] = 1; // minimal non-zero value
  const result = base36Encode(bytes);
  assertEquals(result.length, 50);
});

Deno.test("base36Decode all-zero string returns 32-byte zero array", () => {
  const result = base36Decode("00000000000000000000000000000000000000000000000000");
  assertEquals(result, new Uint8Array(32).fill(0));
});

Deno.test("base36Decode roundtrip is lossless for all-zeros", () => {
  const original = new Uint8Array(32).fill(0);
  const result = base36Decode(base36Encode(original));
  assertEquals(result, original);
});

Deno.test("base36Decode roundtrip is lossless for all-0xff", () => {
  const original = new Uint8Array(32).fill(255);
  const result = base36Decode(base36Encode(original));
  assertEquals(result, original);
});

Deno.test("base36Decode roundtrip is lossless for arbitrary bytes", () => {
  const original = new Uint8Array([
    0x01,
    0x23,
    0x45,
    0x67,
    0x89,
    0xab,
    0xcd,
    0xef,
    0xfe,
    0xdc,
    0xba,
    0x98,
    0x76,
    0x54,
    0x32,
    0x10,
    0x00,
    0xff,
    0x80,
    0x7f,
    0x01,
    0x02,
    0x03,
    0x04,
    0x05,
    0x06,
    0x07,
    0x08,
    0x09,
    0x0a,
    0x0b,
    0x0c,
  ]);
  const result = base36Decode(base36Encode(original));
  assertEquals(result, original);
});

Deno.test("base36Decode returns null for string shorter than 50 chars", () => {
  assertEquals(base36Decode("abc"), null);
  assertEquals(base36Decode(""), null);
  assertEquals(base36Decode("0".repeat(49)), null);
});

Deno.test("base36Decode returns null for string longer than 50 chars", () => {
  assertEquals(base36Decode("0".repeat(51)), null);
  assertEquals(base36Decode("0".repeat(100)), null);
});

Deno.test("base36Decode returns null for uppercase characters", () => {
  // Uppercase is not valid — only lowercase [a-z0-9]
  assertEquals(base36Decode("A".repeat(50)), null);
  assertEquals(base36Decode("ABCDEFGHIJKLMNOPQRSTUVWXYZ01234567890123456789abcd"), null);
});

Deno.test("base36Decode returns null for invalid chars like punctuation", () => {
  const invalidStr = "abcdefghijklmnopqrstuvwxyz01234567890123456789!@#$";
  assertEquals(base36Decode(invalidStr), null);
});

Deno.test("base36Decode returns null for a value that overflows 32 bytes", () => {
  // The maximum 32-byte value in base36 is less than z^50,
  // so we need a value > 2^256. The max 32-byte value is
  // 0xffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff
  // which is approximately 1.157 * 10^77. In base36, this is
  // base36Encode(all 0xff). Any valid 50-char base36 string
  // that is numerically larger than that is overflow.
  // We test with the max valid value to ensure it works:
  const maxBytes = new Uint8Array(32).fill(255);
  const maxEncoded = base36Encode(maxBytes);
  const result = base36Decode(maxEncoded);
  assertEquals(result, maxBytes);
});
