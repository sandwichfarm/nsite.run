import type { BlobDescriptor, Config } from "../types.ts";
import type { StorageClient } from "../storage/client.ts";
import { validateAuth } from "../auth/nostr.ts";
import { getMeta, removeFromIndex, removeOwner } from "../storage/metadata.ts";
import { errorResponse, isValidSha256, jsonResponse } from "../util.ts";

/**
 * BUD-02: DELETE /<sha256> — Delete a blob
 *
 * Requires Nostr auth with t=delete.
 * Only removes the requesting pubkey as owner.
 * Blob is actually deleted only when no owners remain.
 * Returns a BlobDescriptor for the deleted blob.
 */
export async function handleBlobDelete(
  request: Request,
  storage: StorageClient,
  config: Config,
): Promise<Response> {
  const url = new URL(request.url);
  const sha256 = url.pathname.slice(1);

  if (!isValidSha256(sha256)) {
    return errorResponse("Invalid SHA-256 hash", 400);
  }

  // Validate auth
  const auth = await validateAuth(request, {
    verb: "delete",
    sha256,
    serverUrl: config.serverUrl,
  });
  if (!auth.authorized || !auth.pubkey) {
    return errorResponse(auth.error || "Unauthorized", 401);
  }

  // Check blob exists
  const meta = await getMeta(storage, sha256);
  if (!meta) {
    return errorResponse("Blob not found", 404);
  }

  // Check the pubkey is an owner
  if (!meta.owners.includes(auth.pubkey)) {
    return errorResponse("You are not an owner of this blob", 403);
  }

  // Remove owner and index entry in parallel (independent storage paths)
  await Promise.all([
    removeOwner(storage, sha256, auth.pubkey),
    removeFromIndex(storage, auth.pubkey, sha256),
  ]);

  // Return descriptor of the deleted blob
  const descriptor: BlobDescriptor = {
    url: storage.blobUrl(sha256),
    sha256,
    size: meta.size,
    type: meta.type,
    uploaded: meta.uploaded,
  };

  return jsonResponse(descriptor);
}
