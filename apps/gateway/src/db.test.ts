/**
 * Unit tests for apps/gateway/src/db.ts
 *
 * Tests focus on pure logic (buildFilterQuery, module shape) since full DB integration
 * requires a live libSQL connection and is verified during Phase 5 integration testing.
 */

import { assertEquals, assertExists, assertMatch } from "@std/assert";
import {
  buildFilterQuery,
  createDb,
  initSchema,
  insertParameterizedReplaceableEvent,
  insertReplaceableEvent,
  queryEvents,
} from "./db.ts";
import type { Client } from "./db.ts";

// --- Module shape tests ---

Deno.test("db.ts exports createDb function", () => {
  assertEquals(typeof createDb, "function");
});

Deno.test("db.ts exports initSchema function", () => {
  assertEquals(typeof initSchema, "function");
});

Deno.test("db.ts exports queryEvents function", () => {
  assertEquals(typeof queryEvents, "function");
});

Deno.test("db.ts exports insertReplaceableEvent function", () => {
  assertEquals(typeof insertReplaceableEvent, "function");
});

Deno.test("db.ts exports insertParameterizedReplaceableEvent function", () => {
  assertEquals(typeof insertParameterizedReplaceableEvent, "function");
});

Deno.test("db.ts exports buildFilterQuery function", () => {
  assertEquals(typeof buildFilterQuery, "function");
});

// --- createDb tests ---

Deno.test(
  { name: "createDb returns a Client object with execute method", permissions: { env: true } },
  () => {
    // Set minimal env vars so createClient doesn't throw
    Deno.env.set("BUNNY_DB_URL", "libsql://test.turso.io");
    Deno.env.set("BUNNY_DB_AUTH_TOKEN", "test-token");

    const client = createDb();
    assertExists(client);
    assertEquals(typeof client.execute, "function");
    assertEquals(typeof client.batch, "function");
  },
);

// --- buildFilterQuery tests ---

Deno.test("buildFilterQuery: empty filter returns base query", () => {
  const { sql, args } = buildFilterQuery({});
  assertMatch(
    sql,
    /SELECT raw FROM events WHERE deleted_at IS NULL ORDER BY created_at DESC LIMIT \?/,
  );
  assertEquals(args.length, 1); // just the limit
  assertEquals(args[0], 500);
});

Deno.test("buildFilterQuery: authors filter produces pubkey IN clause", () => {
  const { sql, args } = buildFilterQuery({ authors: ["pubkey1", "pubkey2"] });
  assertMatch(sql, /pubkey IN \(\?,\?\)/);
  assertEquals(args.includes("pubkey1"), true);
  assertEquals(args.includes("pubkey2"), true);
});

Deno.test("buildFilterQuery: kinds filter produces kind IN clause", () => {
  const { sql, args } = buildFilterQuery({ kinds: [15128, 35128] });
  assertMatch(sql, /kind IN \(\?,\?\)/);
  assertEquals(args.includes(15128), true);
  assertEquals(args.includes(35128), true);
});

Deno.test("buildFilterQuery: ids filter produces id IN clause", () => {
  const { sql, args } = buildFilterQuery({ ids: ["abc123", "def456"] });
  assertMatch(sql, /id IN \(\?,\?\)/);
  assertEquals(args.includes("abc123"), true);
  assertEquals(args.includes("def456"), true);
});

Deno.test("buildFilterQuery: since/until produce created_at range conditions", () => {
  const { sql, args } = buildFilterQuery({ since: 1000, until: 2000 });
  assertMatch(sql, /created_at >= \?/);
  assertMatch(sql, /created_at <= \?/);
  assertEquals(args.includes(1000), true);
  assertEquals(args.includes(2000), true);
});

Deno.test("buildFilterQuery: custom limit is capped at 500", () => {
  const { args } = buildFilterQuery({ limit: 1000 });
  // Last arg is the LIMIT value
  assertEquals(args[args.length - 1], 500);
});

Deno.test("buildFilterQuery: limit below 500 is preserved", () => {
  const { args } = buildFilterQuery({ limit: 10 });
  assertEquals(args[args.length - 1], 10);
});

// --- Critical: #d tag filter for named site resolution (GATE-02) ---

Deno.test("buildFilterQuery: #d tag filter generates tag subquery", () => {
  const { sql, args } = buildFilterQuery({ "#d": ["my-site"] });
  // Must contain a tag subquery for tag_name = 'd' and tag_value = 'my-site'
  assertMatch(
    sql,
    /id IN \(SELECT event_id FROM tags WHERE tag_name = \? AND tag_value IN \(\?\)\)/,
  );
  assertEquals(args.includes("d"), true);
  assertEquals(args.includes("my-site"), true);
});

Deno.test("buildFilterQuery: #d tag filter with multiple values", () => {
  const { sql, args } = buildFilterQuery({ "#d": ["site-a", "site-b"] });
  assertMatch(sql, /tag_name = \? AND tag_value IN \(\?,\?\)/);
  assertEquals(args.includes("d"), true);
  assertEquals(args.includes("site-a"), true);
  assertEquals(args.includes("site-b"), true);
});

Deno.test("buildFilterQuery: #e tag filter generates tag subquery", () => {
  const { sql, args } = buildFilterQuery({ "#e": ["eventid1"] });
  assertMatch(
    sql,
    /id IN \(SELECT event_id FROM tags WHERE tag_name = \? AND tag_value IN \(\?\)\)/,
  );
  assertEquals(args.includes("e"), true);
  assertEquals(args.includes("eventid1"), true);
});

Deno.test("buildFilterQuery: #p tag filter generates tag subquery", () => {
  const { sql: _sql, args } = buildFilterQuery({ "#p": ["pubkey1"] });
  assertEquals(args.includes("p"), true);
  assertEquals(args.includes("pubkey1"), true);
});

Deno.test("buildFilterQuery: combined filter for named site query (authors + kinds + #d)", () => {
  // This is the exact filter Plan 03 resolver uses for GATE-02
  const { sql, args } = buildFilterQuery({
    authors: ["hex-pubkey-abc"],
    kinds: [35128],
    "#d": ["my-blog"],
    limit: 1,
  });
  assertMatch(sql, /pubkey IN \(\?\)/);
  assertMatch(sql, /kind IN \(\?\)/);
  assertMatch(sql, /tag_name = \? AND tag_value IN \(\?\)/);
  assertEquals(args.includes("hex-pubkey-abc"), true);
  assertEquals(args.includes(35128), true);
  assertEquals(args.includes("d"), true);
  assertEquals(args.includes("my-blog"), true);
  // Limit is 1, so last arg should be 1
  assertEquals(args[args.length - 1], 1);
});

Deno.test("buildFilterQuery: empty tag filter array is ignored", () => {
  const { sql } = buildFilterQuery({ "#d": [] });
  // Empty array should not add a tag subquery condition
  assertEquals(sql.includes("tag_name"), false);
});

// Type compatibility check: Client type is exported
Deno.test("db.ts Client type is exported and usable", () => {
  // This test verifies the type export compiles — if Client type is missing, this file won't compile
  const _typeCheck: Client | null = null;
  assertEquals(_typeCheck, null);
});
