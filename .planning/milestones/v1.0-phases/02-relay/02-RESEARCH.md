# Phase 2: Relay - Research

**Researched:** 2026-03-13
**Domain:** NIP-01 Nostr relay over WebSocket, Bunny Edge Scripting (Deno 2.x), libSQL (Bunny DB), nostr-tools event verification
**Confidence:** MEDIUM-HIGH

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

**Event signature verification**
- Full verification on every EVENT: verify event id (SHA-256 of serialized event) AND schnorr signature
- Use nostr-tools library for event verification and serialization
- Synchronous verification — verify before storing, client gets OK true/false immediately
- Duplicate events (same event id already stored) return OK true silently, no message

**NIP-11 relay info document**
- Name: "nsite.run relay"
- Description: "nsite-only relay for kind 15128/35128/10002/10063 events"
- Contact: operator's npub — hardcode placeholder, fill in before deploy
- Include sensible limitation fields (max_message_length, max_filters, max_subscriptions) — Claude picks reasonable values
- Advertise supported NIPs and the kind restriction

**Storage and query scope**
- Enforce NIP-01 replaceable event semantics for kind 10002 and 10063 (newer event replaces older for same pubkey+kind)
- Enforce NIP-33 parameterized replaceable event semantics for kind 35128 (pubkey + kind + d-tag = unique, newer replaces older)
- Index all single-letter tags for REQ filter support (#d, #e, #p, #t, etc.)
- Support NIP-09 event deletion (kind 5) — accept kind 5 deletion events that reference stored events by the same pubkey. This adds kind 5 to the accepted kinds list.

**Error and rejection behavior**
- Non-allowed kinds: OK false with specific reason ("blocked: kind N not allowed on this relay")
- Basic per-IP rate limiting on EVENT and REQ messages — Claude picks reasonable thresholds
- Malformed WebSocket messages (invalid JSON, wrong format): send NOTICE, then close the connection
- Specific error messages for verification failures: differentiate "invalid: bad event id", "invalid: bad signature", "invalid: missing fields"

### Claude's Discretion
- Rate limit thresholds (events/min, reqs/min per IP)
- NIP-11 limitation values (max message size, max filters, max subscriptions)
- Bunny DB schema design and migration approach
- WebSocket connection management (ping/pong, idle timeout)
- Exact NIP-09 deletion implementation (soft delete vs hard delete)

### Deferred Ideas (OUT OF SCOPE)

None — discussion stayed within phase scope
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| RELAY-01 | Relay accepts and stores kind 15128 (root site manifest) events | ALLOWED_KINDS in shared/constants; EVENT handler stores after verification |
| RELAY-02 | Relay accepts and stores kind 35128 (named site manifest) events | NIP-33 replaceable logic; keyed on pubkey+kind+d-tag |
| RELAY-03 | Relay accepts and stores kind 10002 (relay list) events | NIP-01 replaceable; keyed on pubkey+kind |
| RELAY-04 | Relay accepts and stores kind 10063 (blossom server list) events | NIP-01 replaceable; keyed on pubkey+kind |
| RELAY-05 | Relay rejects events of any other kind | validateEventKind() from shared/validation; OK false response |
| RELAY-06 | Relay implements NIP-01 core protocol (EVENT, REQ, CLOSE, EOSE) over WebSocket | Deno.upgradeWebSocket API; message dispatch pattern |
| RELAY-07 | Relay uses Bunny DB (libSQL) for event storage | @libsql/client/web; createClient with URL+authToken env vars |
| RELAY-08 | Relay serves NIP-11 relay information document on HTTP GET with appropriate Accept header | Accept: application/nostr+json detection in fetch handler |
</phase_requirements>

---

## Summary

Phase 2 builds a NIP-01 compliant Nostr relay scoped to nsite event kinds (15128, 35128, 10002, 10063, and 5 for deletion). The relay runs as a Bunny Edge Script on the Deno 2.x runtime, which means WebSocket handling uses `Deno.upgradeWebSocket()` — the standard Deno API. Persistence uses Bunny DB via `@libsql/client/web`, the HTTP-based libSQL client required for edge runtimes that lack TCP sockets. Event verification uses `@nostr/tools/pure` from JSR (v2.23.3), which provides `verifyEvent()` and `getEventHash()`.

The main architectural challenge is that Bunny Edge Scripts run stateless per-request, meaning WebSocket state (subscriptions, rate limit counters) must be managed in-memory within the lifetime of an upgraded WebSocket connection. There is no shared memory across connections or requests. Rate limiting per-IP requires tracking within the WebSocket message handler using a Map keyed on a connection-level counter reset per connection lifetime — cross-connection IP rate limiting is not possible without an external store and is therefore out of scope for this phase.

The DB schema needs to support: event storage with full JSON, tag indexing for single-letter filter queries, and upsert logic for replaceable/parameterized-replaceable events. The fetch handler must serve NIP-11 on HTTP GET with `Accept: application/nostr+json` before attempting WebSocket upgrade.

**Primary recommendation:** Use `Deno.upgradeWebSocket()` for WebSocket handling, `@libsql/client/web` for DB, `@nostr/tools/pure` for verification, and follow the NIP-01 message dispatch pattern strictly.

---

## Standard Stack

### Core

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `@nostr/tools` (JSR) | 2.23.3 | Event verification, hash computation | Official nostr-tools on JSR; pure TS implementation; `verifyEvent()` checks both id and sig |
| `@libsql/client/web` (npm) | latest (^0.15+) | Bunny DB (libSQL) access from edge | Required `/web` subpath for HTTP-only runtimes; official SDK endorsed by Bunny docs |
| Deno built-in WebSocket | Deno 2.x | WebSocket server via `Deno.upgradeWebSocket` | Native to the runtime; no third-party WS library needed |

### Supporting

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| `@nsite/shared` (workspace) | 0.1.0 | NostrEvent, NostrFilter types, ALLOWED_KINDS, isAllowedKind(), sha256Hex() | Always — project-established shared package |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| `@nostr/tools/pure` | `@nostr/tools/wasm` | WASM has better perf but adds bundle size; pure JS fine for this relay's volume |
| `@libsql/client/web` | `bunny-libsql` (npm) | `bunny-libsql` is a Bunny-specific thin client; `@libsql/client/web` is official and better documented |
| In-memory Map for rate limits | External Redis/KV | No shared-memory KV available in this Bunny plan; per-connection limits are sufficient |

**Installation:**
```bash
# In apps/relay/deno.json imports (JSR preferred for Deno):
deno add jsr:@nostr/tools
npm:@libsql/client
```

Or via deno.json imports map:
```json
{
  "imports": {
    "@nostr/tools/pure": "jsr:@nostr/tools@^2.23.3/pure",
    "@libsql/client/web": "npm:@libsql/client/web"
  }
}
```

---

## Architecture Patterns

### Recommended Project Structure

```
apps/relay/src/
├── main.ts          # BunnySDK.net.http.serve entry point — dispatch NIP-11 vs WebSocket
├── relay.ts         # WebSocket handler: upgrade, message dispatch, subscription management
├── handler.ts       # NIP-01 message handlers: handleEvent, handleReq, handleClose
├── db.ts            # Database layer: createDb(), insertEvent(), queryEvents(), deleteEvent()
├── schema.ts        # SQL DDL strings (CREATE TABLE IF NOT EXISTS)
├── nip11.ts         # NIP-11 relay info document JSON builder
├── ratelimit.ts     # Per-connection rate limiter (Map<string, {count, resetAt}>)
└── types.ts         # Relay-local types (ClientMessage, RelayMessage, Subscription, etc.)
```

### Pattern 1: Dual-Mode fetch Handler (NIP-11 + WebSocket)

**What:** The single `fetch(request)` handler must detect whether to serve NIP-11 JSON or upgrade to WebSocket, based on request headers.
**When to use:** Always — this is the entry point shape that BunnySDK requires.

```typescript
// Source: NIP-11 spec + Deno.upgradeWebSocket Deno docs
export default {
  fetch(request: Request): Response | Promise<Response> {
    // NIP-11: HTTP GET with Accept: application/nostr+json
    if (
      request.method === "GET" &&
      request.headers.get("accept")?.includes("application/nostr+json")
    ) {
      return buildNip11Response();
    }

    // WebSocket upgrade
    if (request.headers.get("upgrade")?.toLowerCase() === "websocket") {
      return handleWebSocketUpgrade(request);
    }

    // Fallback for plain HTTP
    return new Response("nsite relay — connect via WebSocket", {
      status: 200,
      headers: { "Content-Type": "text/plain" },
    });
  },
};
```

### Pattern 2: WebSocket Upgrade with Deno.upgradeWebSocket

**What:** Bunny Edge Scripting runs on Deno 2.x — use `Deno.upgradeWebSocket()` to handle WebSocket connections.
**When to use:** On any request with `Upgrade: websocket` header.

```typescript
// Source: https://docs.deno.com/examples/http_server_websocket/
function handleWebSocketUpgrade(request: Request): Response {
  const { socket, response } = Deno.upgradeWebSocket(request);
  const state = createConnectionState(request);

  socket.onopen = () => {
    // Connection established
  };

  socket.onmessage = async (event) => {
    await handleMessage(socket, state, event.data);
  };

  socket.onclose = () => {
    // Clean up subscriptions for this connection
  };

  socket.onerror = (err) => {
    console.error("WebSocket error:", err);
  };

  return response; // MUST return this to complete the upgrade
}
```

### Pattern 3: NIP-01 Message Dispatch

**What:** Parse incoming WebSocket text as JSON array, dispatch on message type.
**When to use:** Inside `socket.onmessage`.

```typescript
// Source: NIP-01 spec (nips.nostr.com/1)
async function handleMessage(
  socket: WebSocket,
  state: ConnectionState,
  raw: string,
): Promise<void> {
  let msg: unknown;
  try {
    msg = JSON.parse(raw);
  } catch {
    socket.send(JSON.stringify(["NOTICE", "error: invalid JSON"]));
    socket.close();
    return;
  }

  if (!Array.isArray(msg) || msg.length === 0) {
    socket.send(JSON.stringify(["NOTICE", "error: expected JSON array"]));
    socket.close();
    return;
  }

  const [type, ...args] = msg;
  switch (type) {
    case "EVENT":
      await handleEvent(socket, state, args[0]);
      break;
    case "REQ":
      await handleReq(socket, state, args[0] as string, args.slice(1));
      break;
    case "CLOSE":
      handleClose(socket, state, args[0] as string);
      break;
    default:
      socket.send(JSON.stringify(["NOTICE", `error: unknown message type ${type}`]));
  }
}
```

### Pattern 4: Event Verification with @nostr/tools

**What:** Verify both event id (SHA-256 hash of serialized event) and schnorr signature before storing.
**When to use:** In handleEvent, before any DB write.

```typescript
// Source: jsr.io/@nostr/tools — /pure module
import { verifyEvent, getEventHash } from "@nostr/tools/pure";
import type { NostrEvent } from "@nsite/shared/types";

function verifyNostrEvent(
  event: NostrEvent,
): { valid: true } | { valid: false; reason: string } {
  // Check required fields
  if (!event.id || !event.pubkey || !event.sig || event.kind === undefined) {
    return { valid: false, reason: "invalid: missing fields" };
  }

  // verifyEvent checks both the event hash (id) and schnorr signature
  // Returns boolean — false means either bad id or bad sig
  // For specific error differentiation, check id separately first:
  const expectedId = getEventHash(event as Parameters<typeof getEventHash>[0]);
  if (expectedId !== event.id) {
    return { valid: false, reason: "invalid: bad event id" };
  }

  const sigValid = verifyEvent(event as Parameters<typeof verifyEvent>[0]);
  if (!sigValid) {
    return { valid: false, reason: "invalid: bad signature" };
  }

  return { valid: true };
}
```

### Pattern 5: Bunny DB (libSQL) Connection

**What:** Create a libSQL client using the `/web` subpath (HTTP-based, works in edge runtimes).
**When to use:** Once per request handler invocation; client is lightweight and stateless.

```typescript
// Source: docs.turso.tech/sdk/ts/reference, Bunny DB docs
import { createClient } from "@libsql/client/web";

function createDbClient() {
  return createClient({
    url: Deno.env.get("BUNNY_DB_URL") ?? "",
    authToken: Deno.env.get("BUNNY_DB_AUTH_TOKEN") ?? "",
  });
}
```

### Pattern 6: Upsert for Replaceable Events

**What:** For kinds 10002, 10063 (NIP-01 replaceable), and 35128 (NIP-33 parameterized replaceable), delete older version before insert.
**When to use:** In the DB layer, after kind validation.

```typescript
// Replaceable (kind 10002, 10063): pubkey + kind is unique
// DELETE older if new event has higher created_at, then INSERT
await db.batch([
  {
    sql: `DELETE FROM events WHERE kind = ? AND pubkey = ? AND created_at <= ?`,
    args: [event.kind, event.pubkey, event.created_at],
  },
  {
    sql: `INSERT OR IGNORE INTO events (id, pubkey, created_at, kind, tags, content, sig, raw)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    args: [event.id, event.pubkey, event.created_at, event.kind,
           JSON.stringify(event.tags), event.content, event.sig, JSON.stringify(event)],
  },
], "write");

// NIP-33 parameterized replaceable (kind 35128): pubkey + kind + d-tag is unique
// Get d-tag value from event.tags
const dTag = event.tags.find(([name]) => name === "d")?.[1] ?? "";
await db.batch([
  {
    sql: `DELETE FROM events WHERE kind = ? AND pubkey = ? AND d_tag = ? AND created_at <= ?`,
    args: [event.kind, event.pubkey, dTag, event.created_at],
  },
  {
    sql: `INSERT OR IGNORE INTO events (id, pubkey, created_at, kind, tags, content, sig, raw, d_tag)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    args: [event.id, event.pubkey, event.created_at, event.kind,
           JSON.stringify(event.tags), event.content, event.sig, JSON.stringify(event), dTag],
  },
], "write");
```

### Pattern 7: DB Schema

```sql
-- events table: stores all accepted events
CREATE TABLE IF NOT EXISTS events (
  id          TEXT PRIMARY KEY,
  pubkey      TEXT NOT NULL,
  created_at  INTEGER NOT NULL,
  kind        INTEGER NOT NULL,
  tags        TEXT NOT NULL,    -- JSON array of tag arrays
  content     TEXT NOT NULL,
  sig         TEXT NOT NULL,
  raw         TEXT NOT NULL,    -- full JSON event string
  d_tag       TEXT              -- extracted d-tag value for NIP-33 kinds
);

-- Indexes for common REQ filter patterns
CREATE INDEX IF NOT EXISTS idx_events_pubkey ON events(pubkey);
CREATE INDEX IF NOT EXISTS idx_events_kind ON events(kind);
CREATE INDEX IF NOT EXISTS idx_events_created_at ON events(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_events_kind_pubkey ON events(kind, pubkey);

-- tags table: one row per tag value, for single-letter tag filter queries
CREATE TABLE IF NOT EXISTS tags (
  event_id    TEXT NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  tag_name    TEXT NOT NULL,    -- single letter: 'd', 'e', 'p', 't', etc.
  tag_value   TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_tags_name_value ON tags(tag_name, tag_value);
CREATE INDEX IF NOT EXISTS idx_tags_event_id ON tags(event_id);

-- Schema version tracking
CREATE TABLE IF NOT EXISTS schema_version (
  version INTEGER PRIMARY KEY
);
INSERT OR IGNORE INTO schema_version (version) VALUES (1);
```

### Anti-Patterns to Avoid

- **Storing tags as JSON and filtering in application code:** Query the `tags` table in SQL for `#d`, `#e`, `#p` filters — not JSON parsing in TS.
- **Creating a new DB client per-message:** Create once per WebSocket connection (or once per request in the handler), not per message.
- **Forgetting to return the WebSocket response:** `Deno.upgradeWebSocket` returns both a `socket` and `response` — you MUST return `response` from the fetch handler.
- **Sharing subscription state across connections:** Each WebSocket connection has its own subscriptions Map; there is no global relay state.
- **Using `@libsql/client` (not `/web`):** The non-web import uses native TCP and will fail in the Bunny edge runtime.
- **Checking `created_at` for duplicates without handling clock skew:** Accept events regardless of `created_at` being in the past; only reject future events beyond a threshold (e.g., 10 minutes ahead).

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Schnorr signature verification | Custom secp256k1 impl | `verifyEvent()` from `@nostr/tools/pure` | Cryptography has subtle bugs; noble-secp256k1 is audited |
| Event id computation | Custom SHA-256 of serialized event | `getEventHash()` from `@nostr/tools/pure` | Serialization format has specific rules (JSON key order, escaping) |
| libSQL HTTP protocol | Custom HTTP calls to libSQL pipeline endpoint | `@libsql/client/web` | The `/v2/pipeline` protocol has batchable transactions; client handles retries and encoding |
| WebSocket frame parsing | Manual WebSocket handshake | `Deno.upgradeWebSocket()` | WebSocket handshake has SHA-1 key exchange; Deno handles it natively |

**Key insight:** The Nostr event serialization format for hashing is exactly specified (sorted JSON with specific field order and escaping) — even a single field out of order produces the wrong hash. Always use the library.

---

## Common Pitfalls

### Pitfall 1: @libsql/client wrong import path
**What goes wrong:** Bundle fails or runtime error: `Cannot find module '@libsql/client'` or TCP connection errors.
**Why it happens:** The default `@libsql/client` import uses native TCP/WebSocket connections that don't work in HTTP-only edge runtimes.
**How to avoid:** Always import `from "@libsql/client/web"` in edge script code.
**Warning signs:** "URL_SCHEME_NOT_SUPPORTED" error, or "not enough arguments" TypeError at startup.

### Pitfall 2: verifyEvent vs separate id/sig checks
**What goes wrong:** Can't differentiate "bad event id" from "bad signature" error messages.
**Why it happens:** `verifyEvent()` returns a single boolean for both checks combined.
**How to avoid:** Call `getEventHash(event)` first to check id separately, then `verifyEvent()` for the combined check (which also covers sig). The locked decision requires distinct error messages.
**Warning signs:** All verification failures show the same generic error.

### Pitfall 3: Replaceable event race condition
**What goes wrong:** Two events from the same pubkey/kind arrive simultaneously; both get stored; the DELETE+INSERT sequence in a batch prevents this, but batch ordering matters.
**Why it happens:** Without a transaction, a concurrent insert could sneak between DELETE and INSERT.
**How to avoid:** Use `db.batch([DELETE, INSERT], "write")` — libSQL batches run as an implicit transaction.
**Warning signs:** Duplicate rows for same pubkey+kind in events table.

### Pitfall 4: EOSE not sent after REQ
**What goes wrong:** NIP-01 clients wait forever for more events after subscribing.
**Why it happens:** Relay returns stored events but forgets to send `["EOSE", subscriptionId]`.
**How to avoid:** After streaming all stored events for a REQ, always send EOSE. Add this as the last step in `handleReq`.
**Warning signs:** nsyte CLI hangs after publish, nostr clients never "settle".

### Pitfall 5: Kind 5 adds to ALLOWED_KINDS but CONTEXT.md says to update the constant
**What goes wrong:** Kind 5 events rejected because ALLOWED_KINDS in shared/constants.ts still only lists [15128, 35128, 10002, 10063].
**Why it happens:** The discussion added kind 5 support but the shared constants haven't been updated yet.
**How to avoid:** First task in the wave must add kind 5 to ALLOWED_KINDS in `packages/shared/src/constants.ts`.
**Warning signs:** Kind 5 events get "blocked: kind 5 not allowed" response.

### Pitfall 6: NIP-11 detection must check Accept header substring, not exact match
**What goes wrong:** NIP-11 not served because Accept header contains `application/nostr+json` with quality factors like `application/nostr+json, */*`.
**Why it happens:** HTTP Accept headers often contain multiple types with quality values.
**How to avoid:** Use `request.headers.get("accept")?.includes("application/nostr+json")` not strict equality.
**Warning signs:** Browser or client GET requests to the relay endpoint return 200 HTML instead of relay info JSON.

### Pitfall 7: Bunny Edge Script bundle size with @nostr/tools
**What goes wrong:** Bundle exceeds 1MB limit due to cryptographic dependencies.
**Why it happens:** `@nostr/tools/pure` pulls in `@noble/secp256k1` and `@noble/hashes` — combined ~180KB minified. WASM variant is larger.
**How to avoid:** Use `/pure` not `/wasm`. Monitor bundle size in CI (already enforced by Phase 1 infrastructure). Confirm size stays under 750KB warn threshold.
**Warning signs:** CI build-and-size-check job fails after adding nostr-tools.

---

## Code Examples

### NIP-11 Document

```typescript
// Source: NIP-11 spec (nostr-nips.com/nip-11)
function buildNip11Response(): Response {
  const doc = {
    name: "nsite.run relay",
    description: "nsite-only relay for kind 15128/35128/10002/10063 events",
    pubkey: "PLACEHOLDER_NPUB",  // fill before deploy
    contact: "mailto:operator@nsite.run",
    supported_nips: [1, 9, 11, 33],
    software: "https://github.com/nsite/nsite.run",
    version: "0.1.0",
    limitation: {
      max_message_length: 65536,     // 64KB per message
      max_subscriptions: 20,
      max_filters: 10,
      max_limit: 500,
      max_event_tags: 2500,
      max_content_length: 32768,
    },
    relay_countries: [],
    language_tags: [],
    tags: ["nsite"],
    posting_policy: "",
    payments_url: "",
    fees: {},
    icon: "",
  };

  return new Response(JSON.stringify(doc), {
    status: 200,
    headers: {
      "Content-Type": "application/nostr+json",
      "Access-Control-Allow-Origin": "*",
    },
  });
}
```

### NIP-01 OK Response Messages

```typescript
// Source: NIP-01 spec — relay OK message format
// ["OK", <event_id>, <true|false>, <message>]

// Success
socket.send(JSON.stringify(["OK", event.id, true, ""]));

// Duplicate (silent accept)
socket.send(JSON.stringify(["OK", event.id, true, "duplicate: already have this event"]));

// Kind not allowed
socket.send(JSON.stringify(["OK", event.id, false, `blocked: kind ${event.kind} not allowed on this relay`]));

// Bad event id
socket.send(JSON.stringify(["OK", event.id, false, "invalid: bad event id"]));

// Bad signature
socket.send(JSON.stringify(["OK", event.id, false, "invalid: bad signature"]));
```

### REQ Filter Query Pattern

```typescript
// Build SQL dynamically from NIP-01 filter fields
// Source: NIP-01 filter spec (nips.nostr.com/1)
function buildQuery(filter: NostrFilter): { sql: string; args: unknown[] } {
  const conditions: string[] = [];
  const args: unknown[] = [];

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
          `id IN (SELECT event_id FROM tags WHERE tag_name = ? AND tag_value IN (${values.map(() => "?").join(",")}))`
        );
        args.push(tagName, ...values);
      }
    }
  }

  const where = conditions.length ? `WHERE ${conditions.join(" AND ")}` : "";
  const limit = filter.limit ? Math.min(filter.limit, 500) : 500;

  return {
    sql: `SELECT raw FROM events ${where} ORDER BY created_at DESC LIMIT ?`,
    args: [...args, limit],
  };
}
```

### Per-Connection Rate Limiter

```typescript
// Simple in-memory rate limiter — scoped to one WebSocket connection
// NOT shared across connections (no global state in edge scripts)
interface RateLimitBucket {
  eventCount: number;
  reqCount: number;
  windowStart: number;
}

const WINDOW_MS = 60_000;           // 1 minute window
const MAX_EVENTS_PER_WINDOW = 100;  // 100 EVENT messages per minute per connection
const MAX_REQS_PER_WINDOW = 20;     // 20 REQ messages per minute per connection

function checkRateLimit(
  bucket: RateLimitBucket,
  type: "event" | "req",
): boolean {
  const now = Date.now();
  if (now - bucket.windowStart > WINDOW_MS) {
    bucket.eventCount = 0;
    bucket.reqCount = 0;
    bucket.windowStart = now;
  }
  if (type === "event") {
    if (bucket.eventCount >= MAX_EVENTS_PER_WINDOW) return false;
    bucket.eventCount++;
  } else {
    if (bucket.reqCount >= MAX_REQS_PER_WINDOW) return false;
    bucket.reqCount++;
  }
  return true;
}
```

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| `nostr-tools` (npm) | `@nostr/tools` (JSR) | 2024 | JSR package is canonical for Deno; import via `jsr:@nostr/tools` |
| Custom WebSocket handshake | `Deno.upgradeWebSocket()` | Deno 1.12+ | Native; no ws library needed |
| SQLite in-memory for tests | libSQL over HTTP (`@libsql/client/web`) | 2023-2024 | Edge-compatible; same SQL dialect |
| Hard-coded event JSON serialization | `getEventHash()` from nostr-tools | Always | Handles exact NIP-01 serialization spec |

**Deprecated/outdated:**
- `nostr-tools` (npm version < 2.x): Split into `@nostr/tools` on JSR; npm version still exists but JSR is preferred for Deno.
- `@libsql/client` (non-web import): Do not use in edge scripts — TCP-based, fails in HTTP-only runtimes.

---

## Open Questions

1. **Does Bunny Edge Scripting actually support `Deno.upgradeWebSocket()`?**
   - What we know: Bunny Edge Scripting runs on Deno 2.x (confirmed upgraded to Deno 2.1.5 in March 2025 blog post). `Deno.upgradeWebSocket` is a stable Deno API available since Deno 1.12. Bunny docs show WebSocket support is enabled.
   - What's unclear: Whether BunnySDK intercepts/wraps the WebSocket upgrade API or whether `Deno.upgradeWebSocket` is directly callable inside `BunnySDK.net.http.serve()`.
   - Recommendation: In Wave 1, implement a minimal WebSocket echo handler and test end-to-end. If `Deno.upgradeWebSocket` is not available, use the CDN WebSocket passthrough (Pull Zone → WebSockets) and confirm the relay origin handles upgrades differently.

2. **Bunny DB URL and auth token format**
   - What we know: `@libsql/client/web` needs a URL (must be `https://` or `libsql://` scheme) and authToken. Bunny DB is libSQL-compatible. Environment variables must be set as Bunny Edge Script secrets.
   - What's unclear: The exact Bunny DB URL format and credential naming convention in the Bunny dashboard for this project.
   - Recommendation: Document env var names as `BUNNY_DB_URL` and `BUNNY_DB_AUTH_TOKEN` in a `.env.example`. Operator must provision the DB and copy credentials before deploying.

3. **Schema initialization (migration approach)**
   - What we know: Claude's discretion. libSQL `/web` client supports DDL statements via `execute()`.
   - What's unclear: Whether `CREATE TABLE IF NOT EXISTS` should run on every cold start or via a separate migration script.
   - Recommendation: Run schema DDL on every cold start inside an init function called from `main.ts`. `CREATE TABLE IF NOT EXISTS` is idempotent and cheap on libSQL. No separate migration tooling needed for Phase 2.

4. **Cross-connection rate limiting**
   - What we know: In-memory state in edge scripts is per-request/per-connection. No shared global state across connections.
   - What's unclear: Whether Bunny provides any KV store accessible from edge scripts for cross-connection rate limiting.
   - Recommendation: Implement per-connection rate limiting only (as designed). True per-IP cross-connection limiting can be added in v2 if needed. This is Claude's discretion per CONTEXT.md.

---

## Sources

### Primary (HIGH confidence)
- Deno docs (docs.deno.com/api/deno/~/Deno.upgradeWebSocket) — WebSocket upgrade API
- Deno HTTP server WebSocket example (docs.deno.com/examples/http_server_websocket/) — canonical usage pattern
- NIP-01 spec (nips.nostr.com/1) — message formats, filter fields, replaceable event semantics
- NIP-11 spec (nostr-nips.com/nip-11) — relay info document structure and fields
- NIP-09 spec (nips.nostr.com/9) — deletion request (kind 5) relay behavior
- Turso libSQL TypeScript reference (docs.turso.tech/sdk/ts/reference) — createClient, execute, batch APIs
- JSR @nostr/tools (jsr.io/@nostr/tools) — version 2.23.3, verifyEvent, getEventHash from /pure

### Secondary (MEDIUM confidence)
- Bunny blog: Edge Scripting Evolves (bunny.net/blog) — confirms Deno 2.1.5 runtime in March 2025
- Cloudflare Workers + libSQL tutorial (developers.cloudflare.com) — confirms @libsql/client/web pattern for edge runtimes
- Bunny Launcher bundling docs (bunny-launcher.net/edge-scripting/bundling/) — confirms 1MB limit, esbuild, unavailable modules
- WebSearch on NIP-33 parameterized replaceable events — confirmed pubkey+kind+d-tag coordinate

### Tertiary (LOW confidence)
- WebSearch on nostr relay SQLite schema patterns — Nostrify (nostrify.dev) and nostr-rs-relay practices; general patterns, not Bunny-specific
- WebSearch on Bunny WebSocket CDN support — CDN-level passthrough confirmed; edge script WebSocket handling inferred from Deno runtime

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — @nostr/tools version confirmed on JSR, @libsql/client/web confirmed for edge, Deno.upgradeWebSocket confirmed as stable API on Deno 2.x
- Architecture: HIGH — NIP-01 message format is spec-defined; pattern derived directly from spec + Deno docs
- DB schema: MEDIUM — derived from NIP-01 filter requirements + community patterns; Bunny DB is libSQL-compatible so standard SQLite DDL applies
- Bunny WebSocket support: MEDIUM — inferred from Deno 2.x runtime + Bunny WebSocket announcement; direct Bunny edge script WebSocket example not found in docs

**Research date:** 2026-03-13
**Valid until:** 2026-04-13 (30 days — nostr-tools and libSQL are stable; Bunny edge scripting API changes infrequently)
