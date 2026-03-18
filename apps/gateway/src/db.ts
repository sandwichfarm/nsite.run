/**
 * Gateway database access layer.
 * Direct libSQL client for querying/persisting events in the shared Bunny DB.
 *
 * Copied from apps/relay/src/db.ts (intentional duplication — no cross-package imports).
 * See RESEARCH.md Pitfall 6: relay and gateway are independent Edge Scripts with separate module
 * graphs. Cross-importing would break the build.
 *
 * Functions included: createDb, initSchema, queryEvents, insertReplaceableEvent,
 *   insertParameterizedReplaceableEvent (+ internal helpers).
 * Functions excluded: insertEvent, deleteEvents, checkDuplicate (not needed by gateway).
 */

import { createClient } from "@nsite/shared/libsql";
import type { Client, SqlValue } from "@nsite/shared/libsql";
import type { NostrEvent, NostrFilter } from "@nsite/shared/types";

type InValue = SqlValue;

// Re-export Client type for consumers
export type { Client };

// --- Schema DDL (copied from apps/relay/src/schema.ts) ---
// The gateway shares the same database as the relay, so DDL must match exactly.

const SCHEMA_DDL: string[] = [
  // events table: stores all accepted Nostr events
  `CREATE TABLE IF NOT EXISTS events (
    id          TEXT PRIMARY KEY,
    pubkey      TEXT NOT NULL,
    created_at  INTEGER NOT NULL,
    kind        INTEGER NOT NULL,
    tags        TEXT NOT NULL,
    content     TEXT NOT NULL,
    sig         TEXT NOT NULL,
    raw         TEXT NOT NULL,
    d_tag       TEXT,
    deleted_at  INTEGER
  )`,

  // Indexes for common REQ filter patterns
  `CREATE INDEX IF NOT EXISTS idx_events_pubkey ON events(pubkey)`,
  `CREATE INDEX IF NOT EXISTS idx_events_kind ON events(kind)`,
  `CREATE INDEX IF NOT EXISTS idx_events_created_at ON events(created_at DESC)`,
  `CREATE INDEX IF NOT EXISTS idx_events_kind_pubkey ON events(kind, pubkey)`,
  // NIP-33 parameterized replaceable event lookups (kind + pubkey + d-tag)
  `CREATE INDEX IF NOT EXISTS idx_events_kind_pubkey_dtag ON events(kind, pubkey, d_tag)`,

  // tags table: one row per tag value, enables single-letter tag filter queries (#d, #e, #p, etc.)
  `CREATE TABLE IF NOT EXISTS tags (
    event_id    TEXT NOT NULL REFERENCES events(id) ON DELETE CASCADE,
    tag_name    TEXT NOT NULL,
    tag_value   TEXT NOT NULL
  )`,

  `CREATE INDEX IF NOT EXISTS idx_tags_name_value ON tags(tag_name, tag_value)`,
  `CREATE INDEX IF NOT EXISTS idx_tags_event_id ON tags(event_id)`,

  // Schema version tracking for future migrations
  `CREATE TABLE IF NOT EXISTS schema_version (
    version INTEGER PRIMARY KEY
  )`,
  `INSERT OR IGNORE INTO schema_version (version) VALUES (1)`,
];

// --- Public API ---

/** Create a libSQL client connected to Bunny DB.
 * Reads BUNNY_DB_URL and BUNNY_DB_AUTH_TOKEN from environment.
 * If vars are missing, uses empty strings — the client will error at first query with a clear message. */
export function createDb(): Client {
  return createClient({
    url: Deno.env.get("BUNNY_DB_URL") ?? "",
    authToken: Deno.env.get("BUNNY_DB_AUTH_TOKEN") ?? "",
  });
}

/** Run all DDL statements in a single batch.
 * Idempotent — safe to call on every cold start.
 * Batched to minimize fetch() calls (Bunny Edge Scripting has fetch limits). */
export async function initSchema(db: Client): Promise<void> {
  await db.batch(SCHEMA_DDL.map((sql) => ({ sql, args: [] })));
}

/** Query events matching any of the provided NIP-01 filters.
 * Runs each filter as a separate SQL query and deduplicates results by event id.
 * Returns events parsed from the raw column, ordered by created_at DESC. */
export async function queryEvents(
  db: Client,
  filters: NostrFilter[],
): Promise<NostrEvent[]> {
  const seen = new Set<string>();
  const results: NostrEvent[] = [];

  for (const filter of filters) {
    const { sql, args } = buildFilterQuery(filter);
    const rows = await db.execute({ sql, args });
    for (const row of rows.rows) {
      const raw = row[0] as string;
      const event = JSON.parse(raw) as NostrEvent;
      if (!seen.has(event.id)) {
        seen.add(event.id);
        results.push(event);
      }
    }
  }

  return results;
}

/** Insert or replace a NIP-01 replaceable event (kinds 10002, 10063, 15128).
 * Replaces the existing event for this pubkey+kind if the incoming event is newer. */
export async function insertReplaceableEvent(
  db: Client,
  event: NostrEvent,
): Promise<void> {
  const tagInserts = buildTagInserts(event);

  await db.batch(
    [
      // Delete older version for this pubkey+kind
      {
        sql: `DELETE FROM events WHERE kind = ? AND pubkey = ? AND created_at <= ?`,
        args: [event.kind, event.pubkey, event.created_at] as InValue[],
      },
      // Insert new version (OR IGNORE handles the case where same created_at already stored)
      {
        sql: `INSERT OR IGNORE INTO events (id, pubkey, created_at, kind, tags, content, sig, raw)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        args: [
          event.id,
          event.pubkey,
          event.created_at,
          event.kind,
          JSON.stringify(event.tags),
          event.content,
          event.sig,
          JSON.stringify(event),
        ] as InValue[],
      },
      ...tagInserts,
    ],
    "write",
  );
}

/** Insert or replace a NIP-33 parameterized replaceable event (kind 35128).
 * Replaces the existing event for this pubkey+kind+d-tag if the incoming event is newer. */
export async function insertParameterizedReplaceableEvent(
  db: Client,
  event: NostrEvent,
): Promise<void> {
  const dTag = extractDTag(event);
  const tagInserts = buildTagInserts(event);

  await db.batch(
    [
      // Delete older version for this pubkey+kind+d-tag coordinate
      {
        sql: `DELETE FROM events WHERE kind = ? AND pubkey = ? AND d_tag = ? AND created_at <= ?`,
        args: [
          event.kind,
          event.pubkey,
          dTag,
          event.created_at,
        ] as InValue[],
      },
      // Insert new version
      {
        sql:
          `INSERT OR IGNORE INTO events (id, pubkey, created_at, kind, tags, content, sig, raw, d_tag)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        args: [
          event.id,
          event.pubkey,
          event.created_at,
          event.kind,
          JSON.stringify(event.tags),
          event.content,
          event.sig,
          JSON.stringify(event),
          dTag,
        ] as InValue[],
      },
      ...tagInserts,
    ],
    "write",
  );
}

// --- Internal helpers ---

/** Extract the d-tag value from an event's tags, if present. */
function extractDTag(event: NostrEvent): string | null {
  return event.tags.find(([name]) => name === "d")?.[1] ?? null;
}

/** Build INSERT statements for all single-letter tags of an event.
 * Single-letter tags are indexed for NIP-01 filter queries (#d, #e, #p, etc.). */
function buildTagInserts(
  event: NostrEvent,
): Array<{ sql: string; args: InValue[] }> {
  return event.tags
    .filter(
      ([tagName, tagValue]) =>
        typeof tagName === "string" &&
        tagName.length === 1 &&
        typeof tagValue === "string" &&
        tagValue.length > 0,
    )
    .map(([tagName, tagValue]) => ({
      sql: `INSERT OR IGNORE INTO tags (event_id, tag_name, tag_value) VALUES (?, ?, ?)`,
      args: [event.id, tagName, tagValue] as InValue[],
    }));
}

/** Build a parameterized SQL SELECT query from a NIP-01 filter.
 * Caps limit at 500 per filter. Excludes soft-deleted events.
 *
 * Handles generic single-letter tag filters: "#d", "#e", "#p", etc.
 * This is critical for named site resolution which queries with "#d": [identifier].
 */
export function buildFilterQuery(
  filter: NostrFilter,
): { sql: string; args: InValue[] } {
  const conditions: string[] = ["deleted_at IS NULL"];
  const args: InValue[] = [];

  if (filter.ids?.length) {
    conditions.push(`id IN (${filter.ids.map(() => "?").join(",")})`);
    args.push(...filter.ids);
  }
  if (filter.authors?.length) {
    conditions.push(`pubkey IN (${filter.authors.map(() => "?").join(",")})`);
    args.push(...filter.authors);
  }
  if (filter.kinds?.length) {
    conditions.push(`kind IN (${filter.kinds.map(() => "?").join(",")})`);
    args.push(...filter.kinds);
  }
  if (filter.since !== undefined) {
    conditions.push(`created_at >= ?`);
    args.push(filter.since);
  }
  if (filter.until !== undefined) {
    conditions.push(`created_at <= ?`);
    args.push(filter.until);
  }

  // Single-letter tag filters: "#d", "#e", "#p", etc.
  // Iterates all filter keys — handles any #X tag generically.
  for (const key of Object.keys(filter)) {
    if (key.startsWith("#") && key.length === 2) {
      const tagName = key[1];
      const values = filter[key] as string[];
      if (values?.length) {
        conditions.push(
          `id IN (SELECT event_id FROM tags WHERE tag_name = ? AND tag_value IN (${
            values.map(() => "?").join(",")
          }))`,
        );
        args.push(tagName, ...values);
      }
    }
  }

  const where = `WHERE ${conditions.join(" AND ")}`;
  const limit = filter.limit !== undefined ? Math.min(filter.limit, 500) : 500;

  return {
    sql: `SELECT raw FROM events ${where} ORDER BY created_at DESC LIMIT ?`,
    args: [...args, limit],
  };
}
