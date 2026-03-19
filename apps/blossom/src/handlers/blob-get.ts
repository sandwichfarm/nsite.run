import type { BlobDescriptor, Config } from "../types.ts";
import type { StorageClient } from "../storage/client.ts";
import { getMeta } from "../storage/metadata.ts";
import { isBlocked } from "../storage/metadata.ts";
import { errorResponse, isValidSha256, jsonResponse } from "../util.ts";

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

  // GET — proxy from Bunny Storage
  const blobResp = await storage.get(storage.blobPath(sha256));
  if (!blobResp) {
    return errorResponse("Blob data not found", 404);
  }

  // Build response headers — prefer metadata content type if available
  const meta = await getMeta(storage, sha256);
  const contentType = meta?.type || headResp.headers.get("Content-Type") ||
    "application/octet-stream";

  const headers = new Headers();
  headers.set("Content-Type", contentType);
  headers.set("X-Content-Type", contentType);
  headers.set("X-SHA-256", sha256);
  headers.set("Cache-Control", "public, max-age=31536000, immutable");

  // Forward content-length from storage
  const cl = blobResp.headers.get("Content-Length");
  if (cl) headers.set("Content-Length", cl);

  // Support range requests
  const rangeHeader = request.headers.get("Range");
  if (rangeHeader) {
    const contentRange = blobResp.headers.get("Content-Range");
    if (contentRange) headers.set("Content-Range", contentRange);
    return new Response(blobResp.body, {
      status: 206,
      headers,
    });
  }

  return new Response(blobResp.body, {
    status: 200,
    headers,
  });
}
