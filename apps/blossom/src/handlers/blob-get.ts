import type { BlobDescriptor, Config } from "../types.ts";
import type { StorageClient } from "../storage/client.ts";
import { getMeta } from "../storage/metadata.ts";
import { isBlocked } from "../storage/metadata.ts";
import { sha256Hex } from "@nsite/shared/sha256";
import { errorResponse, isValidSha256, jsonResponse } from "../util.ts";

/** Maximum blob size for full SHA-256 verification on read (10 MB).
 * Larger blobs use size-check only to avoid excessive memory/CPU on the edge. */
const HASH_VERIFY_LIMIT = 10 * 1024 * 1024;

/**
 * BUD-01: GET/HEAD /<sha256> — Retrieve a blob
 *
 * Supports:
 * - Content-Type from metadata
 * - Range requests (proxied to Bunny Storage)
 * - Optional file extension in path (e.g. /<sha256>.png)
 * - HEAD returns headers only
 * - Returns blob descriptor as JSON if Accept: application/json
 */
export async function handleBlobGet(
  request: Request,
  storage: StorageClient,
  config: Config,
): Promise<Response> {
  const url = new URL(request.url);
  // Extract sha256 from path, ignoring optional extension
  const pathMatch = url.pathname.match(/^\/([0-9a-f]{64})/);
  if (!pathMatch) {
    return errorResponse("Invalid hash", 400);
  }
  const sha256 = pathMatch[1];

  if (!isValidSha256(sha256)) {
    return errorResponse("Invalid SHA-256 hash", 400);
  }

  // Check if blocked
  if (await isBlocked(storage, sha256)) {
    return errorResponse("Blob has been blocked", 403);
  }

  // Quick existence check via HEAD
  const headResp = await storage.head(storage.blobPath(sha256));
  if (!headResp) {
    // For JSON descriptor requests, try metadata fallback
    const accept = request.headers.get("Accept") || "";
    if (accept.includes("application/json")) {
      const meta = await getMeta(storage, sha256);
      if (!meta) return errorResponse("Blob not found", 404);
      const descriptor: BlobDescriptor = {
        url: storage.blobUrl(sha256),
        sha256,
        size: meta.size,
        type: meta.type,
        uploaded: meta.uploaded,
      };
      if (meta.nip94) descriptor.nip94 = meta.nip94;
      return jsonResponse(descriptor);
    }
    return errorResponse("Blob not found", 404);
  }

  // If client wants JSON descriptor, use metadata
  const accept = request.headers.get("Accept") || "";
  if (accept.includes("application/json")) {
    const meta = await getMeta(storage, sha256);
    if (!meta) return errorResponse("Blob not found", 404);
    const descriptor: BlobDescriptor = {
      url: storage.blobUrl(sha256),
      sha256,
      size: meta.size,
      type: meta.type,
      uploaded: meta.uploaded,
    };
    if (meta.nip94) {
      descriptor.nip94 = meta.nip94;
    }
    return jsonResponse(descriptor);
  }

  // For HEAD requests, return headers without body
  if (request.method === "HEAD") {
    const contentType = headResp.headers.get("Content-Type") || "application/octet-stream";
    const contentLength = headResp.headers.get("Content-Length") || "0";
    return new Response(null, {
      status: 200,
      headers: {
        "Content-Type": contentType,
        "Content-Length": contentLength,
        "X-Content-Type": contentType,
        "X-SHA-256": sha256,
      },
    });
  }

  // GET — fetch from Bunny Storage and verify integrity
  const blobResp = await storage.get(storage.blobPath(sha256));
  if (!blobResp) {
    return errorResponse("Blob data not found", 404);
  }

  // Build response headers — prefer metadata content type if available
  const meta = await getMeta(storage, sha256);
  const contentType = meta?.type || headResp.headers.get("Content-Type") ||
    "application/octet-stream";

  // Buffer blob data for integrity verification
  const blobData = new Uint8Array(await blobResp.arrayBuffer());

  // Integrity verification: hash check for small blobs, size check for large blobs
  if (blobData.byteLength <= HASH_VERIFY_LIMIT) {
    const actualHash = sha256Hex(blobData);
    if (actualHash !== sha256) {
      console.error(
        `[blossom] hash mismatch: sha256=${sha256} actual=${actualHash} size=${blobData.byteLength}`,
      );
      storage.delete(storage.blobPath(sha256)).catch(() => {});
      return errorResponse("Blob not found", 404);
    }
  } else if (meta && blobData.byteLength !== meta.size) {
    console.error(
      `[blossom] size mismatch: sha256=${sha256} expected=${meta.size} actual=${blobData.byteLength}`,
    );
    storage.delete(storage.blobPath(sha256)).catch(() => {});
    return errorResponse("Blob not found", 404);
  }

  const headers = new Headers();
  headers.set("Content-Type", contentType);
  headers.set("X-Content-Type", contentType);
  headers.set("X-SHA-256", sha256);
  headers.set("Cache-Control", "public, max-age=31536000, immutable");
  headers.set("Content-Length", String(blobData.byteLength));

  return new Response(blobData, {
    status: 200,
    headers,
  });
}
