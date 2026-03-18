import { assertEquals } from "@std/assert";
import { extractNpubAndIdentifier } from "./hostname.ts";

Deno.test("extractNpubAndIdentifier: root domain returns null", () => {
  assertEquals(extractNpubAndIdentifier("nsite.run"), null);
});

Deno.test("extractNpubAndIdentifier: root domain with port returns null", () => {
  assertEquals(extractNpubAndIdentifier("nsite.run:8080"), null);
});

Deno.test("extractNpubAndIdentifier: npub subdomain returns root SitePointer", () => {
  assertEquals(extractNpubAndIdentifier("npub1abc.nsite.run"), {
    kind: "root",
    npub: "npub1abc",
  });
});

Deno.test("extractNpubAndIdentifier: npub subdomain with port strips port", () => {
  assertEquals(extractNpubAndIdentifier("npub1abc.nsite.run:443"), {
    kind: "root",
    npub: "npub1abc",
  });
});

Deno.test("extractNpubAndIdentifier: named-site subdomain returns named SitePointer", () => {
  assertEquals(extractNpubAndIdentifier("blog.npub1abc.nsite.run"), {
    kind: "named",
    npub: "npub1abc",
    identifier: "blog",
  });
});

Deno.test("extractNpubAndIdentifier: hyphens in identifier are valid", () => {
  assertEquals(extractNpubAndIdentifier("my-site.npub1abc.nsite.run"), {
    kind: "named",
    npub: "npub1abc",
    identifier: "my-site",
  });
});

Deno.test("extractNpubAndIdentifier: underscores in identifier are valid", () => {
  assertEquals(extractNpubAndIdentifier("under_score.npub1abc.nsite.run"), {
    kind: "named",
    npub: "npub1abc",
    identifier: "under_score",
  });
});

Deno.test("extractNpubAndIdentifier: non-npub subdomain returns null", () => {
  assertEquals(extractNpubAndIdentifier("other.nsite.run"), null);
});

Deno.test("extractNpubAndIdentifier: invalid identifier characters returns null", () => {
  assertEquals(extractNpubAndIdentifier("bad chars!.npub1abc.nsite.run"), null);
});

Deno.test("extractNpubAndIdentifier: too many parts with no npub1 at index 1 returns null", () => {
  assertEquals(extractNpubAndIdentifier("a.b.c.nsite.run"), null);
});
