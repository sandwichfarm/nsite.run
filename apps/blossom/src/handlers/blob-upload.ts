import type { Config, BlobDescriptor } from "../types.ts";
import type { StorageClient } from "../storage/client.ts";
import { validateAuth } from "../auth/nostr.ts";
import { addOwner, addToIndex, isBlocked } from "../storage/metadata.ts";
import { sha256 } from "@noble/hashes/sha256";
import { errorResponse, jsonResponse } from "../util.ts";

/** Convert bytes to hex string using pre-computed lookup */
const HEX_TABLE: string[] = Array.from({ length: 256 }, (_, i) =>
  i.toString(16).padStart(2, "0"),
);
function bytesToHex(bytes: Uint8Array): string {
  let hex = "";
  for (let i = 0; i < bytes.length; i++) hex += HEX_TABLE[bytes[i]];
  return hex;
}

/**
 * BUD-02: PUT /upload — Upload a blob (streaming)
 *
 * Streams the request body to storage while simultaneously computing
 * the SHA-256 hash, avoiding buffering the entire file in memory.
 *
 * Requires Nostr auth with t=upload and at least one `x` tag containing
 * the expected blob hash. The blob is written to storage at the expected
 * hash path. After upload, the computed hash is verified against the
 * expected hash — on mismatch the stored blob is deleted.
 */
export async function handleBlobUpload(
  request: Request,
  storage: StorageClient,
  config: Config,
): Promise<Response> {
  // Validate auth
  const auth = await validateAuth(request, {
    verb: "upload",
    serverUrl: config.serverUrl,
  });
  if (!auth.authorized || !auth.pubkey) {
    return errorResponse(auth.error || "Unauthorized", 401);
  }

  // Require x tags so we know the target hash for streaming storage
  const xTags = auth.event?.tags.filter((t) => t[0] === "x") ?? [];
  if (xTags.length === 0) {
    return errorResponse("Auth event must include at least one 'x' tag with expected blob hash", 400);
  }

  // Use the first x tag as the expected hash (for storage path)
  // After upload, we verify the actual hash matches ANY x tag
  const expectedHash = xTags[0][1];

  // Check Content-Length against size limit before reading body
  const contentLength = parseInt(request.headers.get("Content-Length") ?? "0", 10);
  if (contentLength > config.maxUploadSize) {
    return errorResponse(
      `File too large. Maximum size is ${config.maxUploadSize} bytes`,
      413,
    );
  }

  // Check if blocked before reading body
  if (await isBlocked(storage, expectedHash)) {
    return errorResponse("This content has been blocked", 403);
  }

  if (!request.body) {
    return errorResponse("Empty upload body", 400);
  }

  // Determine content type
  const contentType =
    request.headers.get("X-Content-Type") ||
    request.headers.get("Content-Type") ||
    "application/octet-stream";

  // Tee the body: one stream for storage, one for hashing
  const [storageStream, hashStream] = request.body.tee();

  // Start streaming to storage immediately at the expected hash path
  const storagePath = storage.blobPath(expectedHash);
  const storePromise = storage.put(storagePath, storageStream, contentType);

  // Compute SHA-256 incrementally from the hash stream
  const hasher = sha256.create();
  let totalSize = 0;
  const reader = hashStream.getReader();
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    hasher.update(value);
    totalSize += value.length;
  }
  const computedHash = bytesToHex(hasher.digest());

  // Wait for storage write to complete
  await storePromise;

  if (totalSize === 0) {
    await storage.delete(storagePath);
    return errorResponse("Empty upload body", 400);
  }

  // Check actual size against limit
  if (totalSize > config.maxUploadSize) {
    await storage.delete(storagePath);
    return errorResponse(
      `File too large. Maximum size is ${config.maxUploadSize} bytes`,
      413,
    );
  }

  // Verify computed hash matches any x tag
  if (!xTags.some((t) => t[1] === computedHash)) {
    await storage.delete(storagePath);
    return errorResponse(
      `Hash mismatch: uploaded blob SHA-256 is ${computedHash}, not found in auth event x tags`,
      400,
    );
  }

  // If the computed hash differs from expectedHash (first x tag),
  // the blob was stored at the wrong path — move it
  if (computedHash !== expectedHash) {
    // Re-store at the correct path (rare edge case — only if first x tag wasn't the matching one)
    const correctPath = storage.blobPath(computedHash);
    const resp = await storage.get(storagePath);
    if (resp) {
      const data = new Uint8Array(await resp.arrayBuffer());
      await storage.put(correctPath, data, contentType);
      await storage.delete(storagePath);
    }
  }

  // Extract NIP-94 metadata from auth event tags (BUD-08)
  let nip94: string[][] | undefined;
  if (auth.event) {
    const nip94Tags = auth.event.tags.filter(
      (t) => t.length >= 2 && !["t", "x", "expiration", "server"].includes(t[0]),
    );
    if (nip94Tags.length > 0) {
      nip94 = nip94Tags;
    }
  }

  // Update metadata and index in parallel
  const now = Math.floor(Date.now() / 1000);
  const [meta] = await Promise.all([
    addOwner(storage, computedHash, auth.pubkey, totalSize, contentType, nip94),
    addToIndex(storage, auth.pubkey, {
      sha256: computedHash,
      size: totalSize,
      type: contentType,
      uploaded: now,
    }),
  ]);

  // Return blob descriptor
  const descriptor: BlobDescriptor = {
    url: storage.blobUrl(computedHash),
    sha256: computedHash,
    size: totalSize,
    type: contentType,
    uploaded: meta.uploaded,
  };
  if (nip94) {
    descriptor.nip94 = nip94;
  }

  return jsonResponse(descriptor);
}
