import { assertEquals } from "@std/assert";
import { sha256Hex } from "./sha256.ts";

Deno.test("sha256Hex produces correct hash for 'hello'", () => {
  const result = sha256Hex(new TextEncoder().encode("hello"));
  assertEquals(result, "2cf24dba5fb0a30e26e83b2ac5b9e29e1b161e5c1fa7425e73043362938b9824");
});

Deno.test("sha256Hex produces correct hash for empty input", () => {
  const result = sha256Hex(new Uint8Array(0));
  assertEquals(result, "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855");
});

Deno.test("sha256Hex returns a 64-character hex string", () => {
  const result = sha256Hex(new TextEncoder().encode("test"));
  assertEquals(result.length, 64);
  assertEquals(/^[0-9a-f]+$/.test(result), true);
});
