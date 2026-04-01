---
phase: 03-blossom
verified: 2026-03-13T20:30:00Z
status: passed
score: 8/8 requirements verified
re_verification: true
gaps: []
resolution_note: "BLSM-05 requirement text updated to reflect v1 decision (open access, manifest check deferred to v2). No functional gaps."
human_verification:
  - test: "nsyte CLI upload integration"
    expected: "nsyte CLI can use https://nsite.run as a blossom upload target and successfully upload site blobs"
    why_human: "Cannot automate pre-deploy; requires live deployment to Bunny Edge and nsyte CLI interaction against production or staging environment"
---

# Phase 3: Blossom Verification Report

**Phase Goal:** The nsite-only blossom server stores and serves blobs for nsite manifests via standard BUD protocol
**Verified:** 2026-03-13T20:30:00Z
**Status:** passed
**Re-verification:** No — initial verification

---

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | GET /{sha256} returns blob content with correct Content-Type from metadata | VERIFIED | `handleBlobGet` in blob-get.ts: HEAD existence check, metadata content-type lookup, Range proxying, 5 tests pass |
| 2 | HEAD /{sha256} returns 200 with headers for existing blob, 404 for missing | VERIFIED | `handleBlobGet` handles `request.method === "HEAD"` returning null body with headers; storage.head() used for existence |
| 3 | PUT /upload with valid kind 24242 auth stores blob and returns BlobDescriptor | VERIFIED | `handleBlobUpload`: validateAuth + sha256Hex + storage.put + addOwner/addToIndex + jsonResponse(descriptor) |
| 4 | PUT /upload without auth returns 401 | VERIFIED | `handleBlobUpload` line 26: `return errorResponse(auth.error \|\| "Unauthorized", 401)` |
| 5 | PUT /upload with hash mismatch returns 400 | VERIFIED | `handleBlobUpload` lines 52-58: x tag check with `return errorResponse(..., 400)` |
| 6 | GET /list/{pubkey} returns array of BlobDescriptors | VERIFIED | `handleBlobList` in blob-list.ts: getIndex + pagination + map to BlobDescriptors + jsonResponse |
| 7 | DELETE /{sha256} with valid auth removes ownership | VERIFIED | `handleBlobDelete`: validateAuth(verb="delete") + owner check + removeOwner + removeFromIndex |
| 8 | Upload accepted without manifest check (BLSM-05 open access decision) | VERIFIED | No relay query or manifest lookup exists in blob-upload.ts; aligns with ROADMAP SC-2 |
| 9 | Blossom server builds successfully under 1MB bundle | VERIFIED | blossom.bundle.js: 51,517 bytes (~50.3 KB), well under 1MB limit |
| 10 | BLSM-05 requirement text reflects v1 decision | VERIFIED | Requirement text updated to "accepts any blob upload with valid auth (manifest check deferred to v2)" |

**Score:** 10/10 truths verified

---

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `apps/blossom/src/types.ts` | BlobDescriptor, BlobMeta, BlobIndexEntry, Config, AuthResult + NostrEvent re-export | VERIFIED | All types present; NostrEvent re-exported from @nsite/shared/types; no payment/access types |
| `apps/blossom/src/util.ts` | fromBase64, isValidSha256, isValidPubkey, jsonResponse, errorResponse | VERIFIED | All 6 exports present; no @noble/hashes import |
| `apps/blossom/src/storage/client.ts` | StorageClient class with all REST methods | VERIFIED | Full Bunny Storage REST wrapper: put/get/head/delete/getJson/getText/getToml/putJson/blobPath/blobUrl/metaPath/listPath/reportPath/list |
| `apps/blossom/src/storage/metadata.ts` | getMeta, addOwner, removeOwner, getIndex, addToIndex, removeFromIndex, isBlocked | VERIFIED | All functions present; Array.isArray guard in getIndex |
| `apps/blossom/src/auth/nostr.ts` | validateAuth with nostr-tools, 120s window | VERIFIED | getEventHash + verifyEvent from @nostr/tools/pure; symmetric ±120s window; strict x tag enforcement |
| `apps/blossom/src/middleware/cors.ts` | handleOptions, withCors | VERIFIED | BUD-compliant CORS headers on all responses |
| `apps/blossom/src/handlers/blob-get.ts` | handleBlobGet (BUD-01 GET/HEAD) | VERIFIED | HEAD existence check, metadata Content-Type, range support, JSON descriptor |
| `apps/blossom/src/handlers/blob-upload.ts` | handleBlobUpload (BUD-02 PUT) | VERIFIED | async sha256Hex from @nsite/shared, batch x-tag, NIP-94, no access/payment middleware |
| `apps/blossom/src/handlers/blob-delete.ts` | handleBlobDelete (BUD-02 DELETE) | VERIFIED | Owner verification, removeOwner + removeFromIndex, returns BlobDescriptor |
| `apps/blossom/src/handlers/blob-list.ts` | handleBlobList (BUD-02 GET /list) | VERIFIED | cursor pagination, since/until filters, ascending sort, limit cap at 1000 |
| `apps/blossom/src/handlers/mirror.ts` | handleMirror (BUD-04) | VERIFIED | async sha256Hex, batch x-tag, remote fetch, no access/payment |
| `apps/blossom/src/handlers/upload-check.ts` | handleUploadCheck (BUD-06) | VERIFIED | Optional auth, X-Content-Length, X-SHA-256 blocked check |
| `apps/blossom/src/handlers/report.ts` | handleReport (BUD-09) | VERIFIED | getEventHash + verifyEvent from @nostr/tools/pure (not schnorr.ts) |
| `apps/blossom/src/handlers/server-info.ts` | handleServerInfo | VERIFIED | nsite-specific info: public:true, paymentsEnabled:false, Cache-Control: public, max-age=60 |
| `apps/blossom/src/router.ts` | Route dispatcher for all BUD routes | VERIFIED | All 8 handlers imported and dispatched; withCors wrapping; no admin or SPA routes |
| `apps/blossom/src/main.ts` | export default { fetch } entry point | VERIFIED | Config from env vars, StorageClient singleton, calls route() |
| `apps/blossom/dist/blossom.bundle.js` | Bundle under 1MB | VERIFIED | 51,517 bytes (~50.3 KB), 95% headroom |
| Test stubs (7 files) | All 7 test files with Deno.test blocks | VERIFIED | nostr.test.ts (9), client.test.ts (8), blob-get.test.ts (5), blob-upload.test.ts (7), blob-list.test.ts (3), blob-delete.test.ts (4), server-info.test.ts (2) = 38 total |

---

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| `auth/nostr.ts` | `@nostr/tools/pure` | `import { getEventHash, verifyEvent }` | WIRED | Line 3: import verified; both called at lines 101 and 107 |
| `storage/client.ts` | Bunny Storage REST API | `fetch() to baseUrl` | WIRED | Line 30-34: `await fetch(\`${this.baseUrl}/${path}\`, ...)` for PUT; same pattern for GET/HEAD/DELETE |
| `storage/metadata.ts` | `storage/client.ts` | `storage.getJson/putJson/getToml` | WIRED | Lines 6, 11, 74, 89, 108, 124: all StorageClient methods called with dependency injection |
| `handlers/blob-upload.ts` | `@nsite/shared/sha256` | `await sha256Hex(data)` | WIRED | Line 5 import, line 47 `const hash = await sha256Hex(data)` |
| `handlers/mirror.ts` | `@nsite/shared/sha256` | `await sha256Hex(remoteData)` | WIRED | Line 5 import, line 67 `const hash = await sha256Hex(remoteData)` |
| `handlers/blob-upload.ts` | `storage/metadata.ts` | `addOwner + addToIndex` | WIRED | Lines 4, 90-96: imported and called in Promise.all |
| `router.ts` | `handlers/*.ts` | imports all 8 handlers and dispatches | WIRED | Lines 7-14 imports, lines 39-67 dispatches by method+path |
| `main.ts` | `router.ts` | `route(request, storage, config)` | WIRED | Line 2 import, line 40 `return route(request, storage, config)` |
| `handlers/report.ts` | `@nostr/tools/pure` | `getEventHash + verifyEvent` | WIRED | Line 4 import; lines 44, 50 called with correct cast pattern |

---

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|------------|-------------|--------|----------|
| BLSM-01 | 03-00, 03-02 | Blossom serves blobs via GET /{sha256} (BUD-01) | SATISFIED | blob-get.ts: handleBlobGet handles GET with Content-Type, range, metadata |
| BLSM-02 | 03-00, 03-01, 03-02 | Blossom accepts blob uploads via PUT /upload with kind 24242 auth (BUD-02) | SATISFIED | blob-upload.ts: validateAuth(verb="upload") + storage + BlobDescriptor return |
| BLSM-03 | 03-00, 03-02 | Blossom lists blobs by pubkey via GET /list/{pubkey} (BUD-02) | SATISFIED | blob-list.ts: getIndex + pagination + descriptor map |
| BLSM-04 | 03-00, 03-02 | Blossom deletes blob ownership via DELETE /{sha256} with auth (BUD-02) | SATISFIED | blob-delete.ts: validateAuth(verb="delete") + owner check + removeOwner |
| BLSM-05 | 03-00, 03-02 | Blossom accepts any blob upload with valid auth (manifest check deferred to v2) | SATISFIED | Requirement text updated to reflect v1 decision; aligns with ROADMAP SC-2 and locked architecture decision |
| BLSM-06 | 03-00, 03-01 | Blossom uses Bunny Storage for blob persistence | SATISFIED | StorageClient wraps Bunny Storage REST API; all blob/meta/index writes use storage.put/putJson |
| BLSM-07 | 03-00, 03-01, 03-02 | Blossom validates SHA-256 integrity on upload | SATISFIED | blob-upload.ts line 47: `await sha256Hex(data)` then x-tag match check |
| BLSM-08 | 03-00, 03-02 | Blossom supports HEAD /{sha256} for existence checks | SATISFIED | blob-get.ts lines 79-91: `request.method === "HEAD"` branch returns null body with Content-Type/Content-Length headers |

---

### Forbidden Files Check

| File | Status |
|------|--------|
| `apps/blossom/src/auth/schnorr.ts` | ABSENT (correct — replaced by nostr-tools) |
| `apps/blossom/src/middleware/access.ts` | ABSENT (correct — open access, no check) |
| `apps/blossom/src/middleware/payment-gate.ts` | ABSENT (correct — free public server) |
| `apps/blossom/src/handlers/spa.ts` | ABSENT (correct — no SPA route) |

---

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| `storage/client.ts` | 44, 54, 70, 74, 81, 85, 92, 96, 150, 153, 161 | `return null` / `return []` | INFO | Intentional null-return pattern for "not found" cases — not stubs. All backed by actual HTTP calls to Bunny Storage. |

No blocker anti-patterns found. No TODO/FIXME/placeholder comments in production code. No payment or access middleware references in handlers.

---

### Human Verification Required

#### 1. nsyte CLI Integration Test

**Test:** Deploy the blossom bundle to Bunny Edge Scripting at nsite.run (or a staging environment), then run `nsyte deploy` targeting https://nsite.run as the blossom upload endpoint.
**Expected:** nsyte CLI successfully authenticates with a kind 24242 event, uploads site blobs via PUT /upload, and reports successful uploads. Blobs are retrievable via GET /{sha256}.
**Why human:** Cannot automate pre-deployment; requires live Bunny Edge deployment and nsyte CLI interaction against a running service.

---

### Gaps Summary

**No gaps.** All BUD protocol endpoints are implemented, wired, and substantive. The blossom server correctly implements BUD-01 (GET/HEAD), BUD-02 (upload/delete/list), BUD-04 (mirror), BUD-06 (preflight), BUD-09 (report), and CORS/auth. BLSM-05 requirement text updated to reflect v1 open-access decision (manifest check deferred to v2).

---

_Verified: 2026-03-13T20:30:00Z_
_Verifier: Claude (gsd-verifier)_
