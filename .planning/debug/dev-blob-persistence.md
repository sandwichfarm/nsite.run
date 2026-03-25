---
status: awaiting_human_verify
trigger: "In local dev, blobs uploaded via the SPA through the gateway's inline blossom handler report success (21/21 uploaded) but some or all blob files are missing from disk. The gateway resolver then can't serve the site (502 Bad Gateway: blob unavailable)."
created: 2026-03-25T00:00:00Z
updated: 2026-03-25T00:05:00Z
---

## Current Focus

hypothesis: The `ReadableStream.tee()` in blob-upload.ts splits the request body into two streams: storageStream (passed to LocalStorageClient.put()) and hashStream (read by the hasher). LocalStorageClient.put() does `new Response(body).arrayBuffer()` which consumes the storageStream. BUT `ReadableStream.tee()` in Deno/web platform requires both sides to be consumed concurrently — if the hash reader pulls from hashStream faster than storageStream is consumed, the tee() backpressure model may cause incomplete data to be written. Specifically: when the hash loop calls `reader.read()` on hashStream while storageStream is being consumed by `new Response(body).arrayBuffer()`, there may be a racing incomplete-read scenario.

HOWEVER — the deeper issue is different. After re-reading the code carefully:

The real bug is in how `blossom-dev.ts` initializes the LocalStorageClient's `serverUrl`. The inline blossom handler in blossom-dev.ts sets `serverUrl = http://localhost:3102` (BLOSSOM_PORT). But the `blobUrl()` method of LocalStorageClient uses this serverUrl. This is just for URL generation, not for the actual file write.

REAL ISSUE FOUND: The `LocalStorageClient.put()` method receives the ReadableStream (storageStream) as `body: BodyInit` and does `new Response(body).arrayBuffer()`. This should work.

The real culprit is the `tee()` behavior: when `new Response(storageStream).arrayBuffer()` is called, it internally starts consuming storageStream. But the storePromise is NOT awaited while the hashStream reader loop runs — they run concurrently. The ReadableStream.tee() contract guarantees both branches see all data, but there's a critical timing issue:

The hash reader loop runs SYNCHRONOUSLY pulling chunks. The storageStream is being consumed asynchronously by Response.arrayBuffer(). Because both come from tee(), they are linked. The backpressure is such that the tee() internal queue may grow unboundedly. In theory this is fine for small files.

ACTUAL ROOT CAUSE (most likely): The `checkExistence` step in SPA's upload.js makes HEAD requests to `http://localhost:3100/{sha256}`. The gateway routes these to `handleBlossom` (blob-get.ts's handleBlobGet). handleBlobGet's HEAD branch (line 84-96) does `storage.head(storage.blobPath(sha256))`. But wait — the HEAD request in checkExistence comes BEFORE upload. So that's not the issue.

REAL CULPRIT: The `handleBlobGet` in blob-get.ts (lines 113-119) verifies blob integrity on every GET. The resolver in resolver.ts calls `fetchBlob()` which fetches from `http://localhost:3100/{sha256}`. This triggers `handleBlobGet`. handleBlobGet reads the blob, computes SHA-256, and if it doesn't match, calls `storage.delete()` (line 119). The hash mismatch error in the symptoms: "[blossom] hash mismatch: sha256=d7bcdbe0... actual=7e99d287... size=15678" confirms this path is being triggered.

But WHY would the hash mismatch? This is the key question.

test: Trace what happens when the resolver fetches the blob via fetchBlob() → GET http://localhost:3100/{sha256} → handleBlobGet → reads blob from disk → computes hash → mismatch → deletes blob.
expecting: The blob on disk was written with corrupted content (wrong bytes), causing hash mismatch and subsequent deletion.
next_action: Investigate the tee()+arrayBuffer() concurrent consumption pattern to see if bytes can be interleaved/corrupted.

## Symptoms

expected: SPA deploys site → all 21 blobs written to .dev-blossom-storage/blobs/ → gateway resolves npub subdomain → site loads in browser
actual: SPA reports 21/21 uploaded, but blob files are missing from .dev-blossom-storage/blobs/ (0-20 of 21 persist). Gateway returns 502. index.html blob (50f0c11d...) consistently missing across multiple deploys.
errors: "Bad Gateway: blob unavailable" from gateway resolver. Blossom hash mismatch log: "[blossom] hash mismatch: sha256=d7bcdbe0... actual=7e99d287... size=15678"
reproduction: 1) Run `deno task dev` 2) Open localhost:3100 3) Deploy any SvelteKit site with anonymous key 4) Click the site URL → 502
started: Local dev harness built in Phase 12. Production deploy flow works.

## Eliminated

- hypothesis: Gateway using wrong DB (dev-gateway.db vs dev-relay.db)
  evidence: Already fixed — gateway now uses dev-relay.db
  timestamp: 2026-03-25T00:00:00Z

- hypothesis: Missing GATEWAY_URL causing self-reference not recognized
  evidence: Already fixed — GATEWAY_URL set to http://localhost:3100
  timestamp: 2026-03-25T00:00:00Z

- hypothesis: Port defaults mismatch (808x vs 310x)
  evidence: Already fixed — dev.ts defaults match orchestrator
  timestamp: 2026-03-25T00:00:00Z

- hypothesis: BLOSSOM_URL pointing at wrong process (3102 vs 3100)
  evidence: Already fixed — BLOSSOM_URL set to gateway port 3100
  timestamp: 2026-03-25T00:00:00Z

## Evidence

- timestamp: 2026-03-25T00:00:00Z
  checked: apps/blossom/src/handlers/blob-upload.ts lines 77-97
  found: request.body.tee() splits stream into [storageStream, hashStream]. storePromise = storage.put(storagePath, storageStream, contentType) is started. Then the hash loop reads from hashStream. THEN await storePromise is called AFTER the hash loop completes.
  implication: The two streams from tee() are consumed concurrently (storage.put starts the Response.arrayBuffer() immediately, hash loop drains hashStream). This is the tee() contract. For LocalStorageClient.put(), `new Response(storageStream).arrayBuffer()` will buffer the entire body in memory before writing to disk. The concurrent reading of hashStream and storageStream via the tee() backing store should work correctly per spec. BUT — if LocalStorageClient.put() fails silently or throws after arrayBuffer completes, the file may not be written.

- timestamp: 2026-03-25T00:00:00Z
  checked: apps/blossom/src/storage/local.ts LocalStorageClient.put() lines 29-34
  found: put() does: mkdir, new Response(body).arrayBuffer(), Deno.writeFile(). Returns true. Does NOT throw on error — any exception propagates up. The storePromise.then() result is awaited at line 97 of blob-upload.ts. If put() throws, the upload handler would catch it.
  implication: LocalStorageClient.put() with a ReadableStream body: `new Response(storageStream).arrayBuffer()` — this should consume the full stream. No truncation here.

- timestamp: 2026-03-25T00:00:00Z
  checked: apps/blossom/src/handlers/blob-get.ts lines 112-128
  found: On GET, if blob.byteLength <= 10MB, computes sha256 and compares. On mismatch: logs "[blossom] hash mismatch: sha256=... actual=... size=..." and calls storage.delete(). The error string in symptoms exactly matches this code path.
  implication: Blobs ARE being written but their content is WRONG (different bytes). The upload handler writes the blob at the expectedHash path, then the GET handler reads it back and finds the content doesn't hash to expectedHash.

- timestamp: 2026-03-25T00:00:00Z
  checked: The concurrency model — SPA uploads with UPLOAD_CONCURRENCY_PER_SERVER = 3 (3 concurrent uploads to the gateway). All 3 use the SAME LocalStorageClient singleton (blossom-dev.ts caches _storage).
  found: LocalStorageClient.put() uses `new Response(body).arrayBuffer()`. For ReadableStream bodies (from request.body.tee()), this consumes the stream to produce bytes. No shared mutable state in LocalStorageClient.put() — each call is independent. So 3 concurrent puts don't interfere with each other.
  implication: Concurrency between upload calls is NOT the issue.

- timestamp: 2026-03-25T00:00:00Z
  checked: The hash mismatch symptom: "sha256=d7bcdbe0... actual=7e99d287... size=15678". The sha256 tag is the EXPECTED hash. The actual hash of what's on disk is 7e99d287. The file has 15678 bytes.
  found: The blob was written at path blobs/d7/d7bcdbe0... but its content hashes to 7e99d287. This means a DIFFERENT blob's content was written to this path. This is a path collision — two different blobs writing to paths that collide somehow? No — paths are 64-char hex hashes, no collision possible. OR — the content written was actually the content of another blob (wrong body written to wrong path).
  implication: CRITICAL. The content at path d7bcdbe0 hashes to 7e99d287. This strongly suggests that when 3 concurrent uploads run, the ReadableStream bodies are getting crossed. Specifically: when tee() is used, the storageStream and hashStream share a backing queue. If the hashStream reader runs to completion BEFORE the storageStream is consumed, the tee() internal buffer holds all the chunks. But with 3 concurrent uploads happening via parallelMap with concurrency=3, could the tee() backing queues interfere? No — each upload has its own tee() call on its own request.body.

- timestamp: 2026-03-25T00:00:00Z
  checked: The upload flow in blob-upload.ts more carefully.
  found: LINE 82: `const storePromise = storage.put(storagePath, storageStream, contentType)` — put() is called immediately, returning a Promise. Inside LocalStorageClient.put(), `new Response(body).arrayBuffer()` starts consuming storageStream. LINE 86-93: The hash reader loop reads ALL chunks from hashStream. LINE 97: `await storePromise` — waits for the storage write. This design relies on tee() providing both branches with data correctly. However, there is a CRITICAL ISSUE: `new Response(storageStream).arrayBuffer()` internally queues microtasks to consume the stream. The hash reader loop uses `await reader.read()` in a while loop. In Deno's event loop, the hash reader loop and the Response.arrayBuffer() internal reader will interleave. This is fine for correctness per the tee() spec.

- timestamp: 2026-03-25T00:00:00Z
  checked: What the actual hash mismatch means more carefully.
  found: If sha256=d7bcdbe0 is the expected hash (from auth event x tag), and the actual content hashes to 7e99d287, then the CONTENT on disk belongs to a different blob. With 3 concurrent uploads, if blob A (hash=d7bcdbe0) and blob B (hash=7e99d287) are uploading concurrently, and they BOTH write their content to blob A's path (blobs/d7/d7bcdbe0), the last write wins — leaving blob B's content at blob A's path.
  implication: This would happen if `storage.put(storagePath, ...)` is called with the WRONG storageStream for that storagePath. How could that happen? If tee() streams from different uploads get mixed up — impossible since each is a separate request.body. OR — if the wrong `expectedHash` is computed. Let's look at this more carefully.

- timestamp: 2026-03-25T00:00:00Z
  checked: blob-upload.ts line 52: `const expectedHash = xTags[0][1]` — the path written to is the FIRST x tag from the auth event.
  found: In upload.js, auth events are signed in batches of 50 (AUTH_BATCH_SIZE=50). Each batch includes up to 50 file hashes as x tags: `hashes.map(h => ['x', h])`. So a SINGLE auth event has 50 x tags. When blob-upload.ts does `xTags[0][1]`, it gets the FIRST hash in the batch, not necessarily the hash of the blob being uploaded!
  implication: THIS IS THE ROOT CAUSE. Each upload request carries the SAME auth event (which has all 50 hashes), but `expectedHash = xTags[0][1]` always picks the FIRST x tag. So ALL blobs in the batch are stored at the PATH of the FIRST BLOB'S HASH. Concurrent writes overwrite each other, and verify hash checks fail because the wrong content is at each path.

## Resolution

root_cause: In apps/spa/src/lib/upload.js, auth events were built in batches of up to 50 files. Each auth event included ALL batch file hashes as x tags. The SAME signed auth header was then stored for every hash in the batch. In apps/blossom/src/handlers/blob-upload.ts, `expectedHash = xTags[0][1]` picks only the FIRST x tag as the storage path. When blob B is uploaded with an auth event whose first x tag is hashA, the blob is stored at hashA's path, not hashB's path. All blobs in a batch overwrite each other at the first blob's hash path. The hash verification (line 114) passes because computedHash IS in the x tags list — it's just not at index 0. Result: wrong content at each path, causing hash mismatch on GET → blob deletion → 502.
fix: Changed auth signing in uploadBlobs() to sign one auth event per file (not batched). Each upload now carries an auth event with exactly one x tag matching the specific file's hash, matching what the server expects (xTags[0][1] = the blob being uploaded).
verification: empty until verified
files_changed: [apps/spa/src/lib/upload.js]
