import type { Config } from "../types.ts";
import type { StorageClient } from "../storage/client.ts";
import { validateAuth } from "../auth/nostr.ts";
import { isBlocked } from "../storage/metadata.ts";
import { isValidSha256 } from "../util.ts";

/**
 * BUD-06: HEAD /upload — Upload pre-flight check
 *
 * Checks request headers:
 * - X-SHA-256: blob hash
 * - X-Content-Length: blob size in bytes
 * - X-Content-Type: blob MIME type
 * - Authorization: optional Nostr auth event
 *
 * Returns 200 if upload would be accepted, or appropriate error with X-Reason header.
 */
export async function handleUploadCheck(
  request: Request,
  storage: StorageClient,
  config: Config,
): Promise<Response> {
  // Validate auth if present
  const authHeader = request.headers.get("Authorization");
  if (authHeader) {
    const auth = await validateAuth(request, {
      verb: "upload",
      serverUrl: config.serverUrl,
    });
    if (!auth.authorized) {
      return new Response(null, {
        status: 403,
        headers: { "X-Reason": auth.error || "Invalid authorization" },
      });
    }
  }

  // Check X-Content-Length
  const contentLengthStr = request.headers.get("X-Content-Length");
  if (contentLengthStr) {
    const size = parseInt(contentLengthStr, 10);
    if (isNaN(size)) {
      return new Response(null, {
        status: 400,
        headers: { "X-Reason": "Invalid X-Content-Length header" },
      });
    }
    if (size > config.maxUploadSize) {
      return new Response(null, {
        status: 413,
        headers: {
          "X-Reason": `File too large. Maximum size is ${config.maxUploadSize} bytes`,
          "X-Max-Upload-Size": config.maxUploadSize.toString(),
        },
      });
    }
  }

  // Check X-SHA-256
  const sha256 = request.headers.get("X-SHA-256");
  if (sha256) {
    if (!isValidSha256(sha256)) {
      return new Response(null, {
        status: 400,
        headers: { "X-Reason": "Invalid X-SHA-256 header" },
      });
    }
    if (await isBlocked(storage, sha256)) {
      return new Response(null, {
        status: 403,
        headers: { "X-Reason": "This content has been blocked" },
      });
    }
  }

  return new Response(null, {
    status: 200,
    headers: {
      "X-Max-Upload-Size": config.maxUploadSize.toString(),
    },
  });
}
