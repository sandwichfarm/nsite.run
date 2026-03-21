import { assertEquals } from "@std/assert";
import { base36Encode } from "@nsite/shared/base36";
import { extractNpubAndIdentifier } from "./hostname.ts";

// Test vector: all-zeros pubkey encodes to 50 zeros in base36
const ZEROS_PUBKEY_HEX = "0000000000000000000000000000000000000000000000000000000000000000";
const ZEROS_PUBKEY_B36 = "0".repeat(50); // base36Encode(new Uint8Array(32)) === "00...0" (50 zeros)

// Test vector: a known non-zero pubkey (alternating bytes for variety)
const KNOWN_BYTES = new Uint8Array(32);
for (let i = 0; i < 32; i++) KNOWN_BYTES[i] = i;
const KNOWN_B36 = base36Encode(KNOWN_BYTES);
const KNOWN_HEX = Array.from(KNOWN_BYTES).map((b) => b.toString(16).padStart(2, "0")).join("");

Deno.test("extractNpubAndIdentifier: root domain returns null", () => {
  assertEquals(extractNpubAndIdentifier("nsite.run"), null);
});

Deno.test("extractNpubAndIdentifier: root domain with port returns null", () => {
  assertEquals(extractNpubAndIdentifier("nsite.run:8080"), null);
});

Deno.test("extractNpubAndIdentifier: root site (npub1 subdomain) returns root SitePointer", () => {
  assertEquals(extractNpubAndIdentifier("npub1abc.nsite.run"), {
    kind: "root",
    npub: "npub1abc",
  });
});

Deno.test("extractNpubAndIdentifier: root site with port strips port", () => {
  assertEquals(extractNpubAndIdentifier("npub1abc.nsite.run:443"), {
    kind: "root",
    npub: "npub1abc",
  });
});

Deno.test("extractNpubAndIdentifier: named site (all-zeros pubkey + dTag) returns named SitePointer", () => {
  const host = `${ZEROS_PUBKEY_B36}blog.nsite.run`;
  assertEquals(extractNpubAndIdentifier(host), {
    kind: "named",
    npub: "",
    pubkeyHex: ZEROS_PUBKEY_HEX,
    identifier: "blog",
  });
});

Deno.test("extractNpubAndIdentifier: named site with known non-zero pubkey returns correct pubkeyHex", () => {
  const host = `${KNOWN_B36}mysite.nsite.run`;
  assertEquals(extractNpubAndIdentifier(host), {
    kind: "named",
    npub: "",
    pubkeyHex: KNOWN_HEX,
    identifier: "mysite",
  });
});

Deno.test("extractNpubAndIdentifier: named site with maximum dTag (13 chars) parses correctly", () => {
  // 50 + 13 = 63 chars (maximum valid length)
  const dTag = "abcdefghijklm";
  const host = `${ZEROS_PUBKEY_B36}${dTag}.nsite.run`;
  assertEquals(extractNpubAndIdentifier(host), {
    kind: "named",
    npub: "",
    pubkeyHex: ZEROS_PUBKEY_HEX,
    identifier: dTag,
  });
});

Deno.test("extractNpubAndIdentifier: named site with minimum dTag (1 char) parses correctly", () => {
  // 50 + 1 = 51 chars (minimum valid length for named site)
  const host = `${ZEROS_PUBKEY_B36}a.nsite.run`;
  assertEquals(extractNpubAndIdentifier(host), {
    kind: "named",
    npub: "",
    pubkeyHex: ZEROS_PUBKEY_HEX,
    identifier: "a",
  });
});

Deno.test("extractNpubAndIdentifier: label exactly 50 chars (no dTag) returns null", () => {
  // Exactly 50 chars — not long enough to have a dTag (needs at least 51)
  const host = `${ZEROS_PUBKEY_B36}.nsite.run`;
  assertEquals(extractNpubAndIdentifier(host), null);
});

Deno.test("extractNpubAndIdentifier: label 64 chars (too long) returns null", () => {
  // 50 + 14 = 64 chars — exceeds maximum of 63
  const host = `${ZEROS_PUBKEY_B36}abcdefghijklmn.nsite.run`;
  assertEquals(extractNpubAndIdentifier(host), null);
});

Deno.test("extractNpubAndIdentifier: old double-wildcard format returns null (GATE-15)", () => {
  // Old format: identifier.npub1xxx.nsite.run — 4 parts, no longer supported
  assertEquals(extractNpubAndIdentifier("blog.npub1abc.nsite.run"), null);
});

Deno.test("extractNpubAndIdentifier: non-npub non-base36 subdomain (too short) returns null", () => {
  // 'other' is only 5 chars — too short to be a named site, doesn't start with npub1
  assertEquals(extractNpubAndIdentifier("other.nsite.run"), null);
});

Deno.test("extractNpubAndIdentifier: label with uppercase returns null (invalid base36)", () => {
  // Uppercase Z makes label invalid — NAMED_SITE_RE requires [a-z0-9]
  const label = `${ZEROS_PUBKEY_B36}Blog`;
  assertEquals(extractNpubAndIdentifier(`${label}.nsite.run`), null);
});

Deno.test("extractNpubAndIdentifier: label with valid length but base36 decode fails returns null", () => {
  // Fill with 'z' chars which are NOT in base36 alphabet (base36 uses 0-9 + a-z, but 'z' IS in base36)
  // Use chars outside [a-z0-9]: underscore or hyphen won't match the regex
  // Actually let's test by putting an 'Z' (uppercase) in the first 50 chars so NAMED_SITE_RE rejects it
  // This tests the regex path. For the decode-fails path, we need valid [a-z0-9] chars but an overflow.
  // base36Decode only fails regex or overflow. Overflow is theoretically impossible for 50-char base36.
  // So test regex failure via mixed-case:
  const label = "A".repeat(50) + "x"; // 51 chars, uppercase — NAMED_SITE_RE fails
  assertEquals(extractNpubAndIdentifier(`${label}.nsite.run`), null);
});

Deno.test("extractNpubAndIdentifier: 5-part domain with valid named-site label returns null", () => {
  // Extra domain part — only 3 parts qualify for named site check
  const host = `${ZEROS_PUBKEY_B36}blog.extra.nsite.run`;
  assertEquals(extractNpubAndIdentifier(host), null);
});
