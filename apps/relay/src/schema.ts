/** SQL DDL statements for the nsite relay database schema.
 * All statements are idempotent (CREATE TABLE IF NOT EXISTS / CREATE INDEX IF NOT EXISTS).
 * Execute each statement in order via db.execute() during initSchema(). */
export const SCHEMA_DDL: string[] = [
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
