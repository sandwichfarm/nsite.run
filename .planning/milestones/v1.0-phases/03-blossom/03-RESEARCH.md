# Phase 3: Blossom - Research

**Researched:** 2026-03-13
**Domain:** BUD protocol blossom server, Bunny Storage REST API, nostr-tools event verification
**Confidence:** HIGH

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

**Source and porting strategy**
- Port blssm.us handler, auth, storage, and type modules into apps/blossom/src
- Strip payment gating middleware entirely (free public infrastructure)
- Keep all other features: BUD-01, BUD-02, BUD-04 (mirror), BUD-06 (preflight), BUD-08 (NIP-94 metadata), BUD-09 (reporting)
- Skip admin endpoints (price refresh, storage sweep) — admin via Bunny dashboard
- Adapt imports to use @nsite/shared types and constants where applicable
- Switch schnorr verification from @noble/curves to nostr-tools (consistency with relay)

**Auth verification (kind 24242)**
- 120-second expiration window (created_at must be within 120s of server time)
- Strict content-type match: auth event's `t` tag must match uploaded blob's actual content type
- Required `x` tag: auth event MUST include x tag with expected SHA-256 hash, verified against computed hash
- Open access: any pubkey can upload with valid auth — no whitelist, no access control restrictions
- Keep blssm.us batch auth event support (multiple x tags in single auth event — nsyte compatibility)

**Manifest reference check (BLSM-05)**
- No manifest check on upload path — auth + hash verification is the gate
- Upload-before-manifest is the natural nsyte workflow (upload files, then publish manifest)
- No garbage collection for v1 — keep all uploaded blobs indefinitely
- Manifest reference check deferred to background audit or future version

**Storage**
- Keep Bunny Storage metadata pattern from blssm.us (JSON metadata files alongside blobs)
- No libSQL for blossom — relay uses libSQL, blossom uses Bunny Storage only
- Keep sharded storage paths from blssm.us (2-char prefix: blobs/ab/abcd...)
- Env vars: BUNNY_STORAGE_PASSWORD, BUNNY_STORAGE_HOSTNAME, BUNNY_STORAGE_USERNAME, BUNNY_CDN_HOSTNAME, SERVER_URL

**Ownership and deletion**
- Keep multi-owner blob model from blssm.us
- Multiple pubkeys can upload the same hash (deduplication)
- DELETE removes your ownership; blob deleted from storage only when last owner removes it
- Keep content blocking feature (hash-based block list for illegal/reported content)

### Claude's Discretion
- How to structure the port (which files to split/merge during adaptation)
- Router implementation details (blssm.us router pattern vs new)
- CORS configuration specifics
- Max upload size default
- How to integrate server-info endpoint with nsite-specific information

### Deferred Ideas (OUT OF SCOPE)
- Payment gating (BUD-07) — may add later if storage costs become an issue
- Admin endpoints — manage via Bunny dashboard for v1
- Garbage collection for unreferenced blobs — defer unless storage becomes a concern
- Access control allowlist/blocklist — open access for v1, may restrict later
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| BLSM-01 | Blossom serves blobs via GET /{sha256} (BUD-01) | blob-get.ts handler ports directly; HEAD path split out for BLSM-08 |
| BLSM-02 | Blossom accepts blob uploads via PUT /upload with kind 24242 Nostr auth (BUD-02) | blob-upload.ts handler ports with payment gate stripped; auth via nostr-tools |
| BLSM-03 | Blossom lists blobs by pubkey via GET /list/{pubkey} (BUD-02) | blob-list.ts handler ports as-is; index stored in Bunny Storage JSON |
| BLSM-04 | Blossom deletes blob ownership via DELETE /{sha256} with auth (BUD-02) | blob-delete.ts handler ports with access.ts check stripped |
| BLSM-05 | Blossom only accepts blobs referenced in an nsite manifest | Decided: NO manifest check on upload path for v1; auth+hash is the gate |
| BLSM-06 | Blossom uses Bunny Storage for blob persistence | StorageClient ports as-is; same REST API used by blssm.us in production |
| BLSM-07 | Blossom validates SHA-256 integrity on upload | sha256Hex from @nsite/shared replaces @noble/hashes; async variant |
| BLSM-08 | Blossom supports HEAD /{sha256} for existence checks | HEAD path already in blob-get.ts; router dispatches both GET+HEAD to same handler |
</phase_requirements>

---

## Summary

Phase 3 is a focused port of blssm.us — a production blossom server — into apps/blossom/src. The blssm.us source lives at ~/Develop/blssm.us and has been reviewed in full. All core modules (auth, storage, handlers, router, CORS middleware) are ready to port with targeted modifications: strip payment gate, strip access control middleware, switch schnorr from @noble/curves to nostr-tools' `getEventHash`/`verifyEvent`, switch sha256 from @noble/hashes to @nsite/shared's `sha256Hex` (async SubtleCrypto), and replace blssm.us `Config`/`NostrEvent` types with @nsite/shared equivalents where they align.

The key behavioral change from blssm.us is that this server is open-access: any pubkey with a valid kind 24242 auth event can upload. There is no payment gate, no allowlist/blocklist, and no manifest reference check on the upload path (BLSM-05 is satisfied by deferral — the decision is explicitly "no check in v1"). Content blocking (hash-based blocked.toml) is retained as the only upload rejection mechanism beyond auth.

The most significant technical adaptation is the sha256 change: blssm.us uses `@noble/hashes/sha256` (synchronous), but `@nsite/shared/sha256` is async (WebCrypto `crypto.subtle.digest`). This means all callers of `sha256Hex` in upload and mirror handlers must be converted to `await`.

**Primary recommendation:** Port module-by-module in dependency order: types → util → storage → auth → middleware/cors → handlers → router → main.ts. Each module has a clean one-to-one mapping with well-understood modifications. Write unit tests alongside each handler using the Deno.test + mock StorageClient pattern established in blssm.us.

---

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| @nostr/tools/pure | ^2.23.3 (jsr) | Event ID computation, schnorr signature verification | Already in relay deno.json; pure variant avoids browser globals |
| @nsite/shared | workspace | sha256Hex, NostrEvent, NostrFilter, NsiteKind, ALLOWED_KINDS | Already in use by relay and gateway stubs |
| @std/toml | ^1.0.0 (jsr) | Parse blocked.toml from Bunny Storage | Used by blssm.us storage/metadata.ts for config/blocked.toml |
| @bunny.net/edgescript-sdk | (ambient) | BunnySDK.net.http.serve handler | Same pattern as relay main.ts |
| @std/assert | ^1.0.19 (jsr) | Test assertions | Already in root deno.json imports map; Deno.test framework |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| node:process | built-in | Read env vars in main.ts | Config initialization only |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| @nostr/tools getEventHash+verifyEvent | @noble/curves schnorr.verify | nostr-tools is already a relay dep; noble/curves would add bundle size for no gain |
| @nsite/shared sha256Hex (async) | @noble/hashes sha256 (sync) | shared package uses WebCrypto for edge runtime compatibility; must await all hash calls |
| Bunny Storage JSON metadata | libSQL | relay uses libSQL; blossom decision is Bunny Storage only — no DB dependency |

**Installation — add to apps/blossom/deno.json imports:**
```json
{
  "imports": {
    "@nostr/tools/pure": "jsr:@nostr/tools@^2.23.3/pure",
    "@std/toml": "jsr:@std/toml@^1.0.0"
  }
}
```

---

## Architecture Patterns

### Recommended Project Structure
```
apps/blossom/src/
├── main.ts              # BunnySDK.net.http.serve entry, config, StorageClient init
├── router.ts            # Route dispatcher — method+path matching, CORS wrap
├── types.ts             # BlobDescriptor, BlobMeta, BlobIndexEntry, Config, AuthResult, StoredReport, BlockedConfig
├── util.ts              # errorResponse, jsonResponse, isValidSha256, isValidPubkey, fromBase64, guessMimeType
├── auth/
│   └── nostr.ts         # validateAuth — kind 24242 validation using nostr-tools
├── storage/
│   ├── client.ts        # StorageClient — Bunny Storage REST wrapper
│   └── metadata.ts      # getMeta/putMeta, addOwner/removeOwner, getIndex/addToIndex/removeFromIndex, isBlocked, addReport
├── middleware/
│   └── cors.ts          # handleOptions, withCors — BUD CORS headers
└── handlers/
    ├── blob-get.ts      # GET/HEAD /{sha256} — BUD-01 + BLSM-08
    ├── blob-upload.ts   # PUT /upload — BUD-02 + BLSM-02
    ├── blob-delete.ts   # DELETE /{sha256} — BUD-02 + BLSM-04
    ├── blob-list.ts     # GET /list/{pubkey} — BUD-02 + BLSM-03
    ├── mirror.ts        # PUT /mirror — BUD-04
    ├── upload-check.ts  # HEAD /upload — BUD-06 preflight
    ├── report.ts        # PUT /report — BUD-09
    └── server-info.ts   # GET /server-info — nsite-specific server metadata
```

### Pattern 1: BunnySDK Handler Shape
**What:** Export default object with synchronous `fetch` method that returns a Promise<Response>. Initialize config and StorageClient outside the handler (module-level singletons).
**When to use:** Entry point main.ts only.
```typescript
// Source: apps/relay/src/main.ts (established relay pattern)
import * as BunnySDK from "@bunny.net/edgescript-sdk";
import process from "node:process";
import { route } from "./router.ts";
import { StorageClient } from "./storage/client.ts";
import type { Config } from "./types.ts";

const config = getConfig();
const storage = new StorageClient(config);

BunnySDK.net.http.serve(async (request: Request): Promise<Response> => {
  return route(request, storage, config);
});
```

### Pattern 2: nostr-tools Event Verification (replaces schnorr.ts)
**What:** Use `getEventHash` + `verifyEvent` from @nostr/tools/pure to replace blssm.us's @noble/curves schnorr.verify. Both computeEventId and verifySignature collapse into direct nostr-tools calls.
**When to use:** auth/nostr.ts wherever computeEventId and verifySignature are called.
```typescript
// Source: apps/relay/src/handler.ts (established relay pattern)
import { getEventHash, verifyEvent } from "@nostr/tools/pure";
import type { NostrEvent } from "@nsite/shared/types";

// Replaces computeEventId(event) from blssm.us schnorr.ts:
const computedId = getEventHash(event);

// Replaces verifySignature(event) from blssm.us schnorr.ts:
const sigValid = verifyEvent(event);
```

### Pattern 3: Async sha256Hex (critical difference from blssm.us)
**What:** @nsite/shared sha256Hex is async (WebCrypto). blssm.us uses synchronous @noble/hashes. All call sites must use await.
**When to use:** blob-upload.ts and mirror.ts hash computation.
```typescript
// Source: packages/shared/src/sha256.ts
import { sha256Hex } from "@nsite/shared/sha256";

// Replaces: const hash = sha256Hex(data);  <- sync in blssm.us
const hash = await sha256Hex(data);          // async in @nsite/shared
```

### Pattern 4: Simplified Config (payment fields removed)
**What:** Config type strips payment/SPA fields from blssm.us. Only blossom-relevant env vars remain.
**When to use:** types.ts and main.ts.
```typescript
interface Config {
  storagePassword: string;
  storageHostname: string;
  storageUsername: string;
  cdnHostname: string;
  serverUrl: string;
  maxUploadSize: number;  // default: 100MB (104857600)
}
```

### Pattern 5: Open Access (no access.ts)
**What:** blssm.us has checkAccess() middleware gating upload/delete/mirror. Ported blossom removes all checkAccess calls. Auth (kind 24242) is the only gate.
**When to use:** blob-upload.ts, blob-delete.ts, mirror.ts, upload-check.ts — remove access middleware entirely.

### Pattern 6: BLSM-05 Satisfied by Decision
**What:** REQUIREMENTS.md BLSM-05 states "only accepts blobs referenced in an nsite manifest". CONTEXT.md overrides: no manifest check on upload path in v1. BLSM-05 is fulfilled by the explicit architectural decision to defer it.
**When to use:** blob-upload.ts — do NOT add manifest validation logic. Auth + hash verification is the complete gate.

### Pattern 7: Deno Unit Test with Mock StorageClient
**What:** Tests use `Deno.test()`, `@std/assert` assertEquals, and duck-typed StorageClient mocks. Handlers are tested by calling them directly with a Request object and mock storage — no HTTP server needed.
**When to use:** All handler unit tests.
```typescript
// Source: ~/Develop/blssm.us/src/handlers/admin-sweep.test.ts (established blssm.us pattern)
/// <reference lib="deno.ns" />
import { assertEquals } from "@std/assert";
import { handleBlobGet } from "./blob-get.ts";
import type { StorageClient } from "../storage/client.ts";

function makeStorage(exists: boolean): StorageClient {
  return {
    head: async (_path: string) => exists
      ? new Response(null, { status: 200, headers: { "Content-Type": "text/html" } })
      : null,
    blobPath: (sha256: string) => `blobs/${sha256.substring(0, 2)}/${sha256}`,
    blobUrl: (sha256: string) => `https://cdn.example.com/blobs/${sha256.substring(0, 2)}/${sha256}`,
  } as unknown as StorageClient;
}

Deno.test("blob-get: returns 404 for missing blob", async () => {
  const storage = makeStorage(false);
  const req = new Request("https://blossom.test/abc123..." /* 64-char sha256 */);
  const res = await handleBlobGet(req, storage, testConfig);
  assertEquals(res.status, 404);
});
```

### Anti-Patterns to Avoid
- **Keeping access.ts or payment-gate.ts:** These are stripped entirely. Do not port the middleware/access.ts, middleware/payment-gate.ts, middleware/payment-config.ts, or any payment middleware.
- **Keeping admin handlers:** Do not port admin-refresh-price.ts or admin-sweep.ts.
- **Keeping spa.ts handler:** blssm.us has a SPA fallback handler. Blossom has no SPA — drop it.
- **Using @noble/hashes synchronous sha256:** All hash computation must use async @nsite/shared sha256Hex.
- **Blocking upload when x tag is absent:** blssm.us auth/nostr.ts only validates the x tag if the x tag is present. The locked decision says x tag is REQUIRED on upload — update the auth logic: for verb=upload, absence of x tag should be an error.
- **Using @std/toml inside StorageClient constructor:** @std/toml is only needed in metadata.ts for blocked.toml. No other parse calls.
- **Testing via HTTP server spin-up:** Handlers accept (request, storage, config) and return Response directly — test them as functions, not via a listening server.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Schnorr signature verification | Custom EC math | `verifyEvent` from @nostr/tools/pure | Battle-tested, handles all NIP-01 edge cases |
| Event ID hashing | Custom SHA-256 serialization | `getEventHash` from @nostr/tools/pure | Handles NIP-01 canonical serialization format |
| CORS headers for BUD | Custom header logic | Port cors.ts as-is | BUD spec defines exact CORS requirements |
| Blob deduplication | Custom content-addressed map | Multi-owner metadata pattern from blssm.us | Handles concurrent uploads of same hash correctly |
| Base64 decode for auth header | atob alone | `fromBase64` utility from blssm.us util.ts | Handles padding and Uint8Array conversion correctly |

**Key insight:** blssm.us is a production-tested implementation of the entire BUD surface. Port it rather than reimplementing — the edge cases are already solved.

---

## Common Pitfalls

### Pitfall 1: sha256Hex is Async
**What goes wrong:** Calling `sha256Hex(data)` without await returns a Promise, not a hex string. Hash comparison silently fails (Promise !== string).
**Why it happens:** blssm.us sha256Hex is synchronous (@noble/hashes). @nsite/shared sha256Hex uses WebCrypto and is async.
**How to avoid:** Every call site — `const hash = await sha256Hex(data)` — handlers must be async functions (they already are).
**Warning signs:** Hash mismatch errors during upload even with correct data; TypeScript type error if strict mode catches Promise vs string.

### Pitfall 2: Auth x Tag Logic Change
**What goes wrong:** blssm.us validateAuth treats absent x tag as acceptable (only validates x tag if it IS present). The locked decision requires x tag for upload — but the current blssm.us nostr.ts code does NOT enforce this for upload verb.
**Why it happens:** blssm.us supports multiple verbs (get, delete, list) where x tag is optional. Port must tighten x tag requirement for upload.
**How to avoid:** In blob-upload.ts, after calling validateAuth, explicitly check that auth.event has at least one x tag before the hash comparison. Or add an `options.requireX` parameter to validateAuth.
**Warning signs:** Upload succeeds when nsyte sends a batch auth with no x tag — shouldn't happen in practice but is a security gap.

### Pitfall 3: @std/toml Import Not in blossom deno.json
**What goes wrong:** metadata.ts calls `storage.getToml()` which uses `@std/toml`. If not in blossom's deno.json imports, esbuild will fail to resolve it.
**Why it happens:** The root deno.json workspace only has `@std/assert`. Each app must declare its own imports.
**How to avoid:** Add `"@std/toml": "jsr:@std/toml@^1.0.0"` to apps/blossom/deno.json imports alongside the @nostr/tools entry.
**Warning signs:** Build error: `Could not resolve "@std/toml"`.

### Pitfall 4: Bunny Storage PUT Returns 201 Not 200
**What goes wrong:** Treating Bunny Storage PUT success as `resp.ok` (200-299) vs checking `resp.status === 201` specifically. The client.ts already handles this correctly — don't change it.
**Why it happens:** Bunny Storage REST API returns HTTP 201 Created on successful blob upload, not 200 OK.
**How to avoid:** Port client.ts as-is. The `put()` method correctly checks `resp.status === 201`.
**Warning signs:** Upload reports failure even though blob appears in storage.

### Pitfall 5: Range Request Proxying
**What goes wrong:** blob-get.ts proxies range requests to Bunny Storage, but Bunny Storage may not forward the Range header if not passed through. The blssm.us handler reads the Range header and returns 206 if Content-Range is present in the storage response.
**Why it happens:** The range request handling in blob-get.ts checks `blobResp.headers.get("Content-Range")` — if Bunny Storage doesn't return a Content-Range (because Range wasn't forwarded), the response will be 200 not 206.
**How to avoid:** When proxying range requests, forward the Range header to the storage GET call. Review blob-get.ts storage.get() call — pass Range header through.
**Warning signs:** Range requests return full body (200) instead of partial content (206).

### Pitfall 6: fromBase64 Utility Needed
**What goes wrong:** The Authorization header decoding needs `fromBase64` from blssm.us util.ts. @nsite/shared does not export this. Must include it in blossom's util.ts.
**Why it happens:** @nsite/shared only exports sha256Hex, NostrEvent, NostrFilter, NsiteKind, ValidationResult, ALLOWED_KINDS. Base64 decode is not shared.
**How to avoid:** Port `fromBase64` and other needed utilities (toBase64, bytesToHex, hexToBytes, isValidSha256, isValidPubkey, guessMimeType, jsonResponse, errorResponse) into apps/blossom/src/util.ts.
**Warning signs:** Import resolution failure for fromBase64; TypeScript error if trying to import from @nsite/shared.

### Pitfall 7: Test Files in apps/blossom/src Picked Up by Build
**What goes wrong:** esbuild bundles everything under src/ — if test files import from test-only modules or use Deno.test globals, the build may fail or bloat.
**Why it happens:** build.ts entrypoint is main.ts, but esbuild may tree-shake test files unless they import from main. Deno test runner auto-discovers *.test.ts files recursively.
**How to avoid:** Test files use `/// <reference lib="deno.ns" />` and are never imported by main.ts. esbuild entry is main.ts only — test files are not reachable and not bundled. This is the same pattern blssm.us uses successfully.
**Warning signs:** Build error referencing `Deno.test` or `@std/assert`.

---

## Code Examples

Verified patterns from official sources:

### Auth Validation with nostr-tools (replaces schnorr.ts)
```typescript
// Source: apps/relay/src/handler.ts — established pattern in this codebase
import { getEventHash, verifyEvent } from "@nostr/tools/pure";
import type { NostrEvent } from "@nsite/shared/types";

// In validateAuth — replaces computeEventId + verifySignature calls:
const computedId = getEventHash(event as Parameters<typeof getEventHash>[0]);
if (computedId !== event.id) {
  return { authorized: false, error: "Invalid event ID" };
}
const sigValid = verifyEvent(event as Parameters<typeof verifyEvent>[0]);
if (!sigValid) {
  return { authorized: false, error: "Invalid signature" };
}
```

### Async sha256Hex in Upload Handler
```typescript
// Source: packages/shared/src/sha256.ts
import { sha256Hex } from "@nsite/shared/sha256";

// In handleBlobUpload (async function):
const data = new Uint8Array(body);
const hash = await sha256Hex(data);  // was synchronous in blssm.us
```

### Router Pattern (simplified from blssm.us)
```typescript
// Source: ~/Develop/blssm.us/src/router.ts — port with admin/spa removed
const BLOB_PATH_RE = /^\/[0-9a-f]{64}/;
const BLOB_PATH_EXACT_RE = /^\/[0-9a-f]{64}$/;

export async function route(request: Request, storage: StorageClient, config: Config): Promise<Response> {
  if (request.method === "OPTIONS") return handleOptions();
  const url = new URL(request.url);
  const path = url.pathname;
  const method = request.method;
  let response: Response;
  try {
    if (path === "/upload" && method === "PUT") {
      response = await handleBlobUpload(request, storage, config);
    } else if (path === "/upload" && method === "HEAD") {
      response = await handleUploadCheck(request, storage, config);
    } else if (path === "/mirror" && method === "PUT") {
      response = await handleMirror(request, storage, config);
    } else if (path === "/report" && method === "PUT") {
      response = await handleReport(request, storage, config);
    } else if (path.startsWith("/list/") && method === "GET") {
      response = await handleBlobList(request, url, storage, config);
    } else if ((method === "GET" || method === "HEAD") && BLOB_PATH_RE.test(path)) {
      response = await handleBlobGet(request, storage, config);
    } else if (method === "DELETE" && BLOB_PATH_EXACT_RE.test(path)) {
      response = await handleBlobDelete(request, storage, config);
    } else if (path === "/server-info" && method === "GET") {
      response = await handleServerInfo(storage, config);
    } else {
      response = errorResponse("Not Found", 404);
    }
  } catch (err) {
    console.error("Handler error:", err);
    response = errorResponse("Internal Server Error", 500);
  }
  return withCors(response);
}
```

### BUD CORS Headers (BUD-01 requirement)
```typescript
// Source: ~/Develop/blssm.us/src/middleware/cors.ts — port as-is
const CORS_HEADERS: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, HEAD, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Authorization, Content-Type, X-Content-Type, X-SHA-256",
  "Access-Control-Expose-Headers": "X-Content-Type, X-SHA-256, X-Upload-Message",
  "Access-Control-Max-Age": "86400",
};
```

### server-info Simplified for nsite
```typescript
// blssm.us server-info aggregates payment/access config. Simplified for nsite-blossom:
export async function handleServerInfo(storage: StorageClient, config: Config): Promise<Response> {
  return jsonResponse({
    name: "nsite.run blossom",
    description: "nsite-only blossom server for nsite manifests",
    public: true,
    paymentsEnabled: false,
    serverUrl: config.serverUrl,
    maxUploadSize: config.maxUploadSize,
  }, 200, { "Cache-Control": "public, max-age=60" });
}
```

---

## Module-by-Module Porting Guide

This table is the primary planning artifact. Each row = one file to create/port.

| Source File (blssm.us) | Target File (apps/blossom/src) | Action | Key Changes |
|------------------------|-------------------------------|--------|-------------|
| src/types.ts | src/types.ts | Port + strip | Remove PaymentConfig, AccessConfig, LightningConfig, CacheConfig, PricingConfig, PaymentInfo, MintEntry, PaymentAmounts, ServerInfo (simplify). Keep BlobDescriptor, BlobMeta, BlobIndexEntry, StoredReport, BlockedConfig, AuthResult. Import NostrEvent from @nsite/shared/types. Inline simplified Config without SPA/payment fields. |
| src/util.ts | src/util.ts | Port + strip | Remove guessMimeType (not needed), toBase64 (not needed). Keep: fromBase64, bytesToHex, hexToBytes, isValidSha256, isValidPubkey, jsonResponse, errorResponse. Remove @noble/hashes sha256 (not used — sha256Hex moved to shared). |
| src/auth/schnorr.ts | (deleted — inline into auth/nostr.ts) | Replace | No separate file needed; use getEventHash+verifyEvent from @nostr/tools/pure directly in auth/nostr.ts |
| src/auth/nostr.ts | src/auth/nostr.ts | Port + adapt | Replace computeEventId/verifySignature calls with getEventHash/verifyEvent. Adjust clock skew from 60s to 120s per decision. |
| src/storage/client.ts | src/storage/client.ts | Port + strip | Remove @std/toml import+getToml method (blocked.toml now read differently) OR keep getToml and add @std/toml to deno.json. Keep all other methods. |
| src/storage/metadata.ts | src/storage/metadata.ts | Port as-is | No changes needed except import paths (relative within blossom). |
| src/middleware/cors.ts | src/middleware/cors.ts | Port as-is | No changes. |
| src/middleware/access.ts | (not ported) | Delete | Open access — no access control middleware. |
| src/middleware/payment-gate.ts | (not ported) | Delete | No payment gating. |
| src/handlers/blob-get.ts | src/handlers/blob-get.ts | Port as-is | No changes needed (no access check in blob-get). |
| src/handlers/blob-upload.ts | src/handlers/blob-upload.ts | Port + strip | Remove checkAccess + paymentGate calls. sha256Hex becomes async (await). Keep batch x-tag support. |
| src/handlers/blob-delete.ts | src/handlers/blob-delete.ts | Port + strip | Remove checkAccess call. Keep owner verification logic. |
| src/handlers/blob-list.ts | src/handlers/blob-list.ts | Port as-is | No changes needed. |
| src/handlers/mirror.ts | src/handlers/mirror.ts | Port + strip | Remove checkAccess + paymentGate calls. sha256Hex becomes async (await). |
| src/handlers/upload-check.ts | src/handlers/upload-check.ts | Port + strip | Remove checkAccess + paymentGate calls. Open access: auth is optional check only. |
| src/handlers/report.ts | src/handlers/report.ts | Port as-is | No changes (already no payment/access dependency). |
| src/handlers/server-info.ts | src/handlers/server-info.ts | Replace | Simplify: no payment/access aggregation. Return nsite-specific static info + config.maxUploadSize. |
| src/handlers/admin-*.ts | (not ported) | Delete | Admin via Bunny dashboard. |
| src/handlers/spa.ts | (not ported) | Delete | No SPA in blossom. |
| src/router.ts | src/router.ts | Port + strip | Remove admin routes, SPA fallback. Keep all BUD routes. |
| src/main.ts | src/main.ts | Replace | Config without payment/SPA vars. BunnySDK.net.http.serve pattern. |

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| blssm.us @noble/curves for schnorr | @nostr/tools/pure getEventHash+verifyEvent | This port | Bundle consistency; one nostr dep instead of two |
| blssm.us @noble/hashes for sha256 | @nsite/shared sha256Hex (WebCrypto) | This port | Must await all sha256Hex calls |
| blssm.us payment gating (BUD-07) | Removed — open access | This port | Simpler code, free infrastructure |
| blssm.us access control middleware | Removed — any pubkey with auth | This port | Removes access.ts/payment-gate.ts entirely |
| blssm.us SPA handler | Removed | This port | Not needed for blossom-only service |

**Deprecated/outdated in this port:**
- `src/auth/schnorr.ts`: replaced entirely by nostr-tools functions
- `src/middleware/access.ts`: dropped — open access
- `src/middleware/payment-gate.ts` and all payment middleware: dropped
- `src/handlers/admin-*.ts`: dropped — Bunny dashboard
- `src/handlers/spa.ts`: dropped — not applicable

---

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Deno built-in test runner (no config file needed) |
| Config file | none — `deno test` auto-discovers `*.test.ts` |
| Quick run command | `deno test --allow-all apps/blossom/src/` |
| Full suite command | `deno test --allow-all --recursive` (root task: `deno task test`) |

No existing test files exist in apps/blossom/src/. All test files listed below are Wave 0 gaps to create.

### Test Approach

All blossom handlers follow the (request, storage, config) → Response function shape. This makes unit testing direct and fast: mock the StorageClient as a duck-typed object literal, call the handler with a synthetic Request, assert on the returned Response. No HTTP server spin-up required. This is the exact pattern blssm.us uses in its own test files.

**Mock StorageClient shape (used across all handler tests):**
```typescript
function makeStorage(overrides: Partial<StorageClient>): StorageClient {
  return {
    get: async (_path: string) => null,
    head: async (_path: string) => null,
    put: async (_path: string, _body: BodyInit) => true,
    delete: async (_path: string) => true,
    getJson: async (_path: string) => null,
    putJson: async (_path: string, _data: unknown) => true,
    getToml: async (_path: string) => null,
    blobPath: (sha256: string) => `blobs/${sha256.substring(0, 2)}/${sha256}`,
    blobUrl: (sha256: string) => `https://cdn.test/blobs/${sha256.substring(0, 2)}/${sha256}`,
    metaPath: (sha256: string) => `meta/${sha256.substring(0, 2)}/${sha256}.json`,
    listPath: (pubkey: string) => `lists/${pubkey.substring(0, 2)}/${pubkey}/index.json`,
    reportPath: (sha256: string) => `reports/${sha256}.json`,
    ...overrides,
  } as unknown as StorageClient;
}
```

**Test config fixture (used across all handler tests):**
```typescript
const testConfig = {
  storagePassword: "test-pass",
  storageHostname: "storage.bunnycdn.com",
  storageUsername: "test-zone",
  cdnHostname: "cdn.test",
  serverUrl: "https://blossom.test",
  maxUploadSize: 104857600,
};
```

### Phase Requirements to Test Map

| Req ID | Behavior | Test Type | Automated Command | Test File | Wave 0? |
|--------|----------|-----------|-------------------|-----------|---------|
| BLSM-01 | GET /{sha256} returns blob content with correct status | unit | `deno test --allow-all apps/blossom/src/handlers/blob-get.test.ts` | `src/handlers/blob-get.test.ts` | Wave 0 |
| BLSM-01 | GET /{sha256} returns 404 for missing blob | unit | `deno test --allow-all apps/blossom/src/handlers/blob-get.test.ts` | `src/handlers/blob-get.test.ts` | Wave 0 |
| BLSM-02 | PUT /upload with valid auth + hash returns 200 + BlobDescriptor | unit | `deno test --allow-all apps/blossom/src/handlers/blob-upload.test.ts` | `src/handlers/blob-upload.test.ts` | Wave 0 |
| BLSM-02 | PUT /upload without Authorization returns 401 | unit | `deno test --allow-all apps/blossom/src/handlers/blob-upload.test.ts` | `src/handlers/blob-upload.test.ts` | Wave 0 |
| BLSM-02 | PUT /upload with hash mismatch returns 400 | unit | `deno test --allow-all apps/blossom/src/handlers/blob-upload.test.ts` | `src/handlers/blob-upload.test.ts` | Wave 0 |
| BLSM-02 | PUT /upload with blocked hash returns 403 | unit | `deno test --allow-all apps/blossom/src/handlers/blob-upload.test.ts` | `src/handlers/blob-upload.test.ts` | Wave 0 |
| BLSM-03 | GET /list/{pubkey} returns array of BlobDescriptors | unit | `deno test --allow-all apps/blossom/src/handlers/blob-list.test.ts` | `src/handlers/blob-list.test.ts` | Wave 0 |
| BLSM-03 | GET /list/{pubkey} returns empty array when no blobs | unit | `deno test --allow-all apps/blossom/src/handlers/blob-list.test.ts` | `src/handlers/blob-list.test.ts` | Wave 0 |
| BLSM-04 | DELETE /{sha256} with valid auth removes ownership | unit | `deno test --allow-all apps/blossom/src/handlers/blob-delete.test.ts` | `src/handlers/blob-delete.test.ts` | Wave 0 |
| BLSM-04 | DELETE /{sha256} with auth for non-owner returns 403 | unit | `deno test --allow-all apps/blossom/src/handlers/blob-delete.test.ts` | `src/handlers/blob-delete.test.ts` | Wave 0 |
| BLSM-05 | Upload accepted without manifest check (open access) | unit | `deno test --allow-all apps/blossom/src/handlers/blob-upload.test.ts` | `src/handlers/blob-upload.test.ts` | Wave 0 (covered by BLSM-02 test) |
| BLSM-06 | StorageClient PUT stores blob via Bunny Storage REST API | unit | `deno test --allow-all apps/blossom/src/storage/client.test.ts` | `src/storage/client.test.ts` | Wave 0 |
| BLSM-06 | StorageClient GET retrieves blob, returns null on 404 | unit | `deno test --allow-all apps/blossom/src/storage/client.test.ts` | `src/storage/client.test.ts` | Wave 0 |
| BLSM-07 | Upload with correct hash succeeds; wrong hash returns 400 | unit | `deno test --allow-all apps/blossom/src/handlers/blob-upload.test.ts` | `src/handlers/blob-upload.test.ts` | Wave 0 (covered by BLSM-02 tests) |
| BLSM-08 | HEAD /{sha256} returns 200 for existing blob | unit | `deno test --allow-all apps/blossom/src/handlers/blob-get.test.ts` | `src/handlers/blob-get.test.ts` | Wave 0 |
| BLSM-08 | HEAD /{sha256} returns 404 for missing blob | unit | `deno test --allow-all apps/blossom/src/handlers/blob-get.test.ts` | `src/handlers/blob-get.test.ts` | Wave 0 |

### Auth Module Tests (cross-cutting — enables BLSM-02, BLSM-04)

| Behavior | Test Type | Command | Test File | Wave 0? |
|----------|-----------|---------|-----------|---------|
| validateAuth: missing Authorization header → 401 | unit | `deno test --allow-all apps/blossom/src/auth/nostr.test.ts` | `src/auth/nostr.test.ts` | Wave 0 |
| validateAuth: wrong kind → 401 | unit | same | same | Wave 0 |
| validateAuth: expired created_at → 401 | unit | same | same | Wave 0 |
| validateAuth: within 120s window → accepted | unit | same | same | Wave 0 |
| validateAuth: missing t tag → 401 | unit | same | same | Wave 0 |
| validateAuth: t tag mismatch → 401 | unit | same | same | Wave 0 |
| validateAuth: missing x tag on upload → 401 (LOCKED decision) | unit | same | same | Wave 0 |
| validateAuth: x tag hash mismatch → 401 | unit | same | same | Wave 0 |
| validateAuth: valid event (real schnorr) → authorized + pubkey | unit | same | same | Wave 0 |

Note: validateAuth tests that require a valid schnorr signature need a pre-signed test fixture. A valid kind 24242 event signed by a known test key (generated once, hard-coded in tests) is the pattern. The blssm.us tests avoid this by testing everything except the final signature step — the relay codebase already uses nostr-tools so real signature testing is feasible.

### Success Criteria Validation

| Success Criterion | Test Coverage | Method |
|-------------------|---------------|--------|
| 1. Blob can be uploaded via PUT /upload with valid kind 24242 auth event and retrieved via GET /{sha256} | blob-upload.test.ts (upload path) + blob-get.test.ts (retrieval path) | unit — mock storage verifies roundtrip at handler level |
| 2. Upload containing blob not referenced by any nsite manifest in relay is accepted (BLSM-05 deferred) | blob-upload.test.ts — verify no manifest check code exists in handler | unit — absence test: upload succeeds without relay query |
| 3. Blob list for a pubkey returned via GET /list/{pubkey} | blob-list.test.ts | unit |
| 4. nsyte CLI can use https://nsite.run as a blossom upload target | manual — deploy blossom, run `nsyte deploy` against nsite.run | manual/integration — cannot automate pre-deploy |
| 5. HEAD /{sha256} returns 200 for existing blob and 404 for missing one | blob-get.test.ts | unit |

### Sampling Rate
- **Per task commit:** `deno test --allow-all apps/blossom/src/`
- **Per wave merge:** `deno test --allow-all --recursive`
- **Phase gate:** Full suite green before marking phase complete

### Wave 0 Gaps (test files to create before or alongside implementation)

All test files listed here are new — none exist yet in apps/blossom/src/:

- [ ] `apps/blossom/src/auth/nostr.test.ts` — covers validateAuth logic (BLSM-02, BLSM-04 auth gate)
- [ ] `apps/blossom/src/handlers/blob-get.test.ts` — covers BLSM-01, BLSM-08
- [ ] `apps/blossom/src/handlers/blob-upload.test.ts` — covers BLSM-02, BLSM-05, BLSM-07
- [ ] `apps/blossom/src/handlers/blob-list.test.ts` — covers BLSM-03
- [ ] `apps/blossom/src/handlers/blob-delete.test.ts` — covers BLSM-04
- [ ] `apps/blossom/src/storage/client.test.ts` — covers BLSM-06 (StorageClient with globalThis.fetch stub)
- [ ] `apps/blossom/src/handlers/server-info.test.ts` — covers server-info response shape (supporting)

No test framework install needed: `deno test` is built-in. `@std/assert` is already in root deno.json imports map.

---

## Open Questions

1. **Range request forwarding in blob-get.ts**
   - What we know: blssm.us blob-get.ts calls `storage.get(storage.blobPath(sha256))` which does a plain GET without forwarding the Range header.
   - What's unclear: Does Bunny Storage automatically handle range requests when the request arrives at the CDN? Or does the Edge Script need to explicitly forward the Range header to the storage backend?
   - Recommendation: Port blob-get.ts as-is from blssm.us (which is in production). If range requests don't work, investigate forwarding the Range header in storage.get(). This is a low-risk gap — most nsyte clients will GET the full blob.

2. **@std/toml vs blocked.toml decision**
   - What we know: blocked.toml is the hash-based content block list. metadata.ts uses `storage.getToml<BlockedConfig>()`. This requires @std/toml.
   - What's unclear: @std/toml adds bundle size. Could use JSON for blocked list instead.
   - Recommendation: Keep @std/toml to match blssm.us pattern exactly (production-tested). Add to apps/blossom/deno.json imports. Bundle size impact is small (~10KB).

3. **nostr-tools type compatibility with @nsite/shared NostrEvent**
   - What we know: getEventHash and verifyEvent expect the nostr-tools internal Event type. @nsite/shared NostrEvent is structurally identical.
   - What's unclear: TypeScript may require a cast or satisfies when passing @nsite/shared NostrEvent to nostr-tools functions.
   - Recommendation: Use `as Parameters<typeof getEventHash>[0]` cast pattern. The relay already does this successfully — follow its pattern.

4. **Test fixture for valid kind 24242 signed event**
   - What we know: validateAuth tests that exercise the full signature verification path require a pre-signed event with a known private key.
   - What's unclear: Should tests generate keys via nostr-tools `generateSecretKey`/`getPublicKey`/`finalizeEvent` at test time, or use a hardcoded fixture?
   - Recommendation: Use `generateSecretKey` + `finalizeEvent` from @nostr/tools/pure at test time. This avoids hardcoding private keys while enabling real signature coverage. Tests that don't need signature verification can use a dummy event with a tampered id to trigger the "Invalid event ID" path instead.

---

## Sources

### Primary (HIGH confidence)
- `~/Develop/blssm.us/src/` — Full source review of production blssm.us implementation
- `~/Develop/blssm.us/src/handlers/server-info.test.ts` — Confirmed Deno.test + mock StorageClient test pattern
- `~/Develop/blssm.us/src/handlers/admin-sweep.test.ts` — Confirmed globalThis.fetch stub + duck-typed mock pattern
- `~/Develop/nsite.run/apps/relay/src/handler.ts` — Established nostr-tools usage pattern in this codebase
- `~/Develop/nsite.run/packages/shared/src/sha256.ts` — @nsite/shared sha256Hex implementation (async WebCrypto)
- `~/Develop/nsite.run/packages/shared/src/types.ts` — Available shared types
- `~/Develop/nsite.run/apps/blossom/` — Existing stub + build config
- `~/Develop/nsite.run/deno.json` — Root workspace: test command `deno test --allow-all --recursive`, @std/assert in imports

### Secondary (MEDIUM confidence)
- `~/Develop/nsite.run/.planning/phases/03-blossom/03-CONTEXT.md` — User decisions constraining this phase
- BUD protocol specification (inferred from blssm.us implementation + CONTEXT.md references to BUD-01/02/04/06/08/09)

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — all libraries are in-codebase, exact versions from deno.json files
- Architecture: HIGH — full source review of reference implementation (blssm.us)
- Pitfalls: HIGH — identified from direct code inspection of both codebases
- Module porting guide: HIGH — one-to-one mapping confirmed by reading every source file
- Validation architecture: HIGH — test pattern confirmed from blssm.us test files; framework confirmed from root deno.json

**Research date:** 2026-03-13
**Valid until:** 2026-06-13 (stable — all libraries pinned, BUD protocol is stable)
