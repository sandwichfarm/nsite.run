---
phase: 02-relay
verified: 2026-03-13T16:30:00Z
status: passed
score: 20/20 must-haves verified
re_verification: false
---

# Phase 02: Relay Verification Report

**Phase Goal:** Build a minimal Nostr relay that accepts, stores, and serves kind-5 events over WebSocket per NIP-01, backed by a libSQL database
**Verified:** 2026-03-13T16:30:00Z
**Status:** passed
**Re-verification:** No — initial verification

---

## Goal Achievement

### Observable Truths — Plan 02-01 (Foundation)

| #  | Truth | Status | Evidence |
|----|-------|--------|----------|
| 1  | Kind 5 (deletion) is recognized as an allowed kind alongside 15128, 35128, 10002, 10063 | VERIFIED | `ALLOWED_KINDS = [5, 15128, 35128, 10002, 10063]` in constants.ts; 16/16 shared tests pass including 2 new kind-5 tests |
| 2  | DB schema can store events with full JSON, indexed tags, and d_tag for NIP-33 replaceables | VERIFIED | schema.ts exports SCHEMA_DDL with events table having `d_tag TEXT` and `deleted_at INTEGER` columns, plus all required indexes including `idx_events_kind_pubkey_dtag` |
| 3  | DB layer can insert, query, delete, and upsert (replaceable) events | VERIFIED | db.ts exports `createDb`, `initSchema`, `insertEvent`, `insertReplaceableEvent`, `insertParameterizedReplaceableEvent`, `queryEvents`, `deleteEvents`, `checkDuplicate` — all substantively implemented |
| 4  | NIP-11 relay info document returns correct JSON with relay name, description, limitations, and supported NIPs | VERIFIED | nip11.ts exports `buildNip11Response()` returning status 200, Content-Type `application/nostr+json`, CORS header, and full NIP-11 document with name, description, supported_nips [1,9,11,33], supported_kinds sourced from ALLOWED_KINDS |
| 5  | Relay-local types define the shape of WebSocket messages, subscriptions, and connection state | VERIFIED | types.ts exports `ClientMessage`, `RelayMessage`, `Subscription`, `ConnectionState`, `RateLimitBucket` — 34 lines, fully substantive |

### Observable Truths — Plan 02-02 (WebSocket Runtime)

| #  | Truth | Status | Evidence |
|----|-------|--------|----------|
| 6  | A WebSocket client can connect and receive NIP-01 messages | VERIFIED | relay.ts exports `handleWebSocketUpgrade` using `Deno.upgradeWebSocket`, sets up all socket event handlers, returns upgrade response |
| 7  | EVENT messages with valid signatures and allowed kinds are stored and acknowledged with OK true | VERIFIED | handler.ts `handleEvent` runs full 6-step chain, calls kind-specific DB insert, sends `["OK", event.id, true, ""]` on success |
| 8  | EVENT messages with disallowed kinds are rejected with OK false and a specific blocked message | VERIFIED | handler.ts line 80-88: `isAllowedKind` check sends `["OK", id, false, "blocked: kind ${event.kind} not allowed on this relay"]` |
| 9  | EVENT messages with bad event id or bad signature are rejected with specific error messages | VERIFIED | handler.ts lines 102-113: `getEventHash` comparison sends `"invalid: bad event id"`, `verifyEvent` failure sends `"invalid: bad signature"` |
| 10 | Duplicate events return OK true silently | VERIFIED | handler.ts lines 91-100: `checkDuplicate` sends `["OK", id, true, "duplicate: already have this event"]` and returns early |
| 11 | REQ messages return matching stored events followed by EOSE | VERIFIED | handler.ts `handleReq` calls `queryEvents`, iterates results sending `["EVENT", subId, event]`, then sends `["EOSE", subId]` |
| 12 | CLOSE messages remove the subscription and stop future events for that subscription id | VERIFIED | handler.ts `handleClose` calls `state.subscriptions.delete(subscriptionId)` |
| 13 | Replaceable events (10002, 10063) replace older versions for same pubkey+kind | VERIFIED | handler.ts switch dispatches to `insertReplaceableEvent`; db.ts DELETEs where `kind=? AND pubkey=? AND created_at<=?` then inserts |
| 14 | Parameterized replaceable events (35128) replace older versions for same pubkey+kind+d-tag | VERIFIED | handler.ts dispatches to `insertParameterizedReplaceableEvent`; db.ts DELETEs where `kind=? AND pubkey=? AND d_tag=? AND created_at<=?` |
| 15 | Kind 5 deletion events soft-delete referenced events owned by the same pubkey | VERIFIED | db.ts `deleteEvents` extracts `e` tags, runs `UPDATE events SET deleted_at=? WHERE id=? AND pubkey=? AND deleted_at IS NULL` per referenced id |
| 16 | Malformed WebSocket messages receive a NOTICE and the connection is closed | VERIFIED | relay.ts: JSON parse failure sends `["NOTICE", "error: invalid JSON"]` then `socket.close()`; non-array sends `["NOTICE", "error: expected JSON array"]` then closes |
| 17 | Per-connection rate limiting rejects excessive EVENT and REQ messages | VERIFIED | ratelimit.ts: 100 events/min, 20 req/min, 60s sliding window; relay.ts calls `checkRateLimit` before dispatch for EVENT and REQ |
| 18 | HTTP GET with Accept: application/nostr+json returns the NIP-11 document | VERIFIED | main.ts checks `request.headers.get("accept")?.includes("application/nostr+json")` and returns `buildNip11Response()` |
| 19 | HTTP GET without nostr+json accept returns a plain text fallback | VERIFIED | main.ts fallback returns `new Response("nsite relay - connect via WebSocket", ...)` with Content-Type `text/plain` |
| 20 | The relay bundle builds successfully under 1MB | VERIFIED | `deno task build` produces relay.bundle.js at 113.3KB; bundle size check confirms `OK: relay is 113.3KB` |

**Score:** 20/20 truths verified

---

## Required Artifacts

### Plan 02-01 Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `packages/shared/src/constants.ts` | ALLOWED_KINDS with kind 5 | VERIFIED | Line 3: `[5, 15128, 35128, 10002, 10063]` |
| `apps/relay/src/types.ts` | ClientMessage, RelayMessage, Subscription, ConnectionState, RateLimitBucket | VERIFIED | 34 lines, all 5 types exported |
| `apps/relay/src/schema.ts` | SQL DDL strings for events, tags, schema_version tables | VERIFIED | `SCHEMA_DDL: string[]` with CREATE TABLE IF NOT EXISTS, all required columns including `d_tag` and `deleted_at`, all indexes |
| `apps/relay/src/db.ts` | createDb, initSchema, insertEvent, queryEvents, deleteEvents + more | VERIFIED | All 8 exports present: createDb, initSchema, insertEvent, insertReplaceableEvent, insertParameterizedReplaceableEvent, queryEvents, deleteEvents, checkDuplicate |
| `apps/relay/src/nip11.ts` | NIP-11 relay info document builder | VERIFIED | Exports `buildNip11Response()`, returns status 200, correct headers, full NIP-11 document |
| `apps/relay/deno.json` | @nostr/tools/pure and @libsql/client/web imports | VERIFIED | Both present in `imports` object |

### Plan 02-02 Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `apps/relay/src/ratelimit.ts` | createRateLimitBucket, checkRateLimit | VERIFIED | Both exported; 100 events/min, 20 req/min, 60s sliding window |
| `apps/relay/src/handler.ts` | handleEvent, handleReq, handleClose | VERIFIED | All 3 exported; handleEvent has 6-step verification chain + broadcast; handleReq queries+EOSE+stores sub; handleClose silently removes |
| `apps/relay/src/relay.ts` | handleWebSocketUpgrade | VERIFIED | Exported; uses Deno.upgradeWebSocket, per-connection state, rate-limited dispatch, returns upgrade response |
| `apps/relay/src/main.ts` | Entry point: NIP-11 + WebSocket + fallback dispatch | VERIFIED | 37 lines (well above 15 min); all 3 dispatch paths present; cold-start schema init |

---

## Key Link Verification

### Plan 02-01 Key Links

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| `db.ts` | `schema.ts` | `import { SCHEMA_DDL }` | WIRED | Line 4: `import { SCHEMA_DDL } from "./schema.ts"` used in `initSchema()` |
| `db.ts` | `@libsql/client/web` | `createClient` | WIRED | Line 1: `import { createClient }` used at line 13 in `createDb()` |
| `db.ts` | `types.ts` | `import type` | WIRED | Line 3: imports `NostrEvent`, `NostrFilter` from shared types (db.ts imports directly from `@nsite/shared/types`) |

### Plan 02-02 Key Links

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| `main.ts` | `nip11.ts` | `import buildNip11Response` | WIRED | Line 2: imported; line 19: called in Accept header dispatch |
| `main.ts` | `relay.ts` | `import handleWebSocketUpgrade` | WIRED | Line 3: imported; line 24: called in Upgrade header dispatch |
| `main.ts` | `db.ts` | `import createDb, initSchema` | WIRED | Line 1: imported; lines 6-7: both called at module load |
| `relay.ts` | `handler.ts` | `import handleEvent/handleReq/handleClose` | WIRED | Line 3: all 3 imported; lines 75, 89, 104: all called in message dispatch |
| `handler.ts` | `db.ts` | `import insert/query/delete functions` | WIRED | Lines 6-13: `checkDuplicate`, `deleteEvents`, `insertEvent`, `insertParameterizedReplaceableEvent`, `insertReplaceableEvent`, `queryEvents` all imported and used |
| `handler.ts` | `@nostr/tools/pure` | `import verifyEvent, getEventHash` | WIRED | Line 1: both imported; lines 103, 110: both called in `handleEvent` |
| `relay.ts` | `ratelimit.ts` | `import checkRateLimit` | WIRED | Line 4: `checkRateLimit`, `createRateLimitBucket` imported; lines 60, 81: `checkRateLimit` called for EVENT and REQ |

---

## Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|-------------|-------------|--------|----------|
| RELAY-01 | 02-01, 02-02 | Relay accepts and stores kind 15128 events | SATISFIED | `isAllowedKind(15128)` returns true; handler.ts switch default calls `insertEvent` for kind 15128 |
| RELAY-02 | 02-01, 02-02 | Relay accepts and stores kind 35128 events | SATISFIED | `isAllowedKind(35128)` returns true; handler.ts dispatches to `insertParameterizedReplaceableEvent` |
| RELAY-03 | 02-01, 02-02 | Relay accepts and stores kind 10002 events | SATISFIED | `isAllowedKind(10002)` returns true; handler.ts dispatches to `insertReplaceableEvent` |
| RELAY-04 | 02-01, 02-02 | Relay accepts and stores kind 10063 events | SATISFIED | `isAllowedKind(10063)` returns true; handler.ts dispatches to `insertReplaceableEvent` |
| RELAY-05 | 02-01, 02-02 | Relay rejects events of any other kind | SATISFIED | handler.ts: `!isAllowedKind(event.kind)` sends `["OK", id, false, "blocked: kind N not allowed on this relay"]` |
| RELAY-06 | 02-02 | Relay implements NIP-01 core protocol (EVENT, REQ, CLOSE, EOSE) over WebSocket | SATISFIED | relay.ts dispatches all three client message types; handler.ts sends OK, EVENT, EOSE, NOTICE responses |
| RELAY-07 | 02-01 | Relay uses Bunny DB (libSQL) for event storage | SATISFIED | db.ts imports `@libsql/client/web`, reads `BUNNY_DB_URL` and `BUNNY_DB_AUTH_TOKEN` env vars |
| RELAY-08 | 02-01, 02-02 | Relay serves NIP-11 relay information document on HTTP GET with appropriate Accept header | SATISFIED | main.ts checks `Accept: application/nostr+json` header and calls `buildNip11Response()` |

**Traceability note:** REQUIREMENTS.md marks RELAY-06 as "Pending" in the traceability table but marks it [x] complete in the requirements list. The code fully implements RELAY-06 — the traceability table contains a stale inconsistency. The [x] checkbox is the authoritative status.

---

## Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| `apps/relay/src/nip11.ts` | 8, 40-41 | `PLACEHOLDER_NPUB` with TODO comment | Info | Operator npub not set; intentional pre-deploy placeholder, does not affect relay protocol operation |
| `apps/relay/src/relay.ts` | 34 | `socket.onopen = () => {}` | Info | Empty onopen handler; correct behavior (no action needed on open), not a stub |

No blockers. No warnings. Both noted items are intentional.

---

## Human Verification Required

### 1. Real WebSocket Client Connection

**Test:** Connect a NIP-01 client (e.g., `wscat` or a Nostr client) to the relay WebSocket endpoint.
**Expected:** Client connects, can send `["EVENT", {...}]` with a valid signed Nostr event and receive `["OK", id, true, ""]`, then send `["REQ", "sub1", {"kinds":[15128]}]` and receive matching events plus `["EOSE", "sub1"]`.
**Why human:** Live WebSocket protocol behavior, real event signatures, and actual database connectivity (requires BUNNY_DB_URL and BUNNY_DB_AUTH_TOKEN env vars) cannot be verified statically.

### 2. NIP-09 Deletion Cross-Pubkey Enforcement

**Test:** Send a kind-5 deletion event referencing an event owned by a different pubkey.
**Expected:** The referenced event should NOT be soft-deleted (the `WHERE pubkey=?` clause enforces same-author ownership).
**Why human:** Requires live database state and real cryptographic pubkeys to test cross-pubkey isolation.

### 3. Subscription Broadcast After EVENT Store

**Test:** Open two WebSocket connections. On connection A, send `["REQ", "sub1", {"kinds":[15128]}]`. On connection B, send a valid kind 15128 EVENT.
**Expected:** Connection A does NOT receive the event (subscriptions are per-connection, not cross-connection). On the same connection, subscribe then publish — verify the new event is sent to matching subscriptions.
**Why human:** Real-time subscription fan-out behavior requires a live relay instance with multiple concurrent connections.

---

## Gaps Summary

No gaps found. All 20 must-have truths are verified, all 10 artifacts exist and are substantive, all 7 key links are wired, and all 8 requirement IDs (RELAY-01 through RELAY-08) are satisfied by the implementation.

The PLACEHOLDER_NPUB in nip11.ts is an intentional pre-deploy placeholder documented in both plans and summaries. It does not affect relay protocol operation and is not a gap.

The REQUIREMENTS.md traceability table marks RELAY-06 as "Pending" while the [x] checkbox marks it complete — this is a documentation inconsistency in REQUIREMENTS.md, not a code gap. The implementation is complete.

---

_Verified: 2026-03-13T16:30:00Z_
_Verifier: Claude (gsd-verifier)_
