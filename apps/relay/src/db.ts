import { createClient } from "@libsql/client/web";
import type { Client, InValue } from "@libsql/client/web";
import type { NostrEvent, NostrFilter } from "@nsite/shared/types";
import { SCHEMA_DDL } from "./schema.ts";

// Re-export Client type for consumers that need it
export type { Client };

/** Create a libSQL client connected to Bunny DB.
 * Reads BUNNY_DB_URL and BUNNY_DB_AUTH_TOKEN from environment.
 * If vars are missing, uses empty strings — the client will error at first query with a clear message. */
export function createDb(): Client {
  return createClient({
    url: Deno.env.get("BUNNY_DB_URL") ?? "",
    authToken: Deno.env.get("BUNNY_DB_AUTH_TOKEN") ?? "",
  });
}

/** Run all DDL statements from schema.ts in a single batch.
 * Idempotent — safe to call on every cold start.
 * Batched to minimize fetch() calls (Bunny Edge Scripting has fetch limits). */
export async function initSchema(db: Client): Promise<void> {
  await db.batch(SCHEMA_DDL.map((sql) => ({ sql, args: [] })));
}

/** Insert a regular (non-replaceable) event into the events and tags tables.
 * Uses a batch write for atomicity. */
export async function insertEvent(
  db: Client,
  event: NostrEvent,
): Promise<void> {
  const dTag = extractDTag(event);
  const tagInserts = buildTagInserts(event);

  await db.batch(
    [
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

/** Insert or replace a NIP-01 replaceable event (kinds 10002, 10063).
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

/** Handle a NIP-09 deletion event (kind 5).
 * Soft-deletes referenced events by the same author, then stores the deletion event itself. */
export async function deleteEvents(
  db: Client,
  deletionEvent: NostrEvent,
): Promise<void> {
  // Extract referenced event ids from 'e' tags
  const referencedIds = deletionEvent.tags
    .filter(([tagName]) => tagName === "e")
    .map(([, tagValue]) => tagValue)
    .filter((id): id is string => typeof id === "string" && id.length > 0);

  const statements: Array<{ sql: string; args: InValue[] }> = [];

  // Soft-delete each referenced event if it belongs to the same pubkey
  for (const refId of referencedIds) {
    statements.push({
      sql: `UPDATE events SET deleted_at = ? WHERE id = ? AND pubkey = ? AND deleted_at IS NULL`,
      args: [deletionEvent.created_at, refId, deletionEvent.pubkey],
    });
  }

  // Insert the deletion event itself
  const dTag = extractDTag(deletionEvent);
  const tagInserts = buildTagInserts(deletionEvent);
  statements.push({
    sql:
      `INSERT OR IGNORE INTO events (id, pubkey, created_at, kind, tags, content, sig, raw, d_tag)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    args: [
      deletionEvent.id,
      deletionEvent.pubkey,
      deletionEvent.created_at,
      deletionEvent.kind,
      JSON.stringify(deletionEvent.tags),
      deletionEvent.content,
      deletionEvent.sig,
      JSON.stringify(deletionEvent),
      dTag,
    ],
  });
  for (const tagInsert of tagInserts) {
    statements.push(tagInsert);
  }

  if (statements.length > 0) {
    await db.batch(statements, "write");
  }
}

/** Check if an event id already exists in the database.
 * Used to short-circuit EVENT handling with OK true (duplicate) before full processing. */
export async function checkDuplicate(
  db: Client,
  eventId: string,
): Promise<boolean> {
  const result = await db.execute({
    sql: `SELECT 1 FROM events WHERE id = ? LIMIT 1`,
    args: [eventId],
  });
  return result.rows.length > 0;
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
 * Caps limit at 500 per filter. Excludes soft-deleted events. */
function buildFilterQuery(
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
