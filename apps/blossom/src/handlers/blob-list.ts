import type { BlobDescriptor, Config } from "../types.ts";
import type { StorageClient } from "../storage/client.ts";
import { getIndex } from "../storage/metadata.ts";
import { errorResponse, isValidPubkey, jsonResponse } from "../util.ts";

/**
 * BUD-02: GET /list/<pubkey> — List blobs owned by a pubkey
 *
 * Supports pagination:
 * - cursor: sha256 of last blob from previous page (exclusive)
 * - limit: max results (default 100, max 1000)
 * - since: minimum upload timestamp (deprecated but supported)
 * - until: maximum upload timestamp (deprecated but supported)
 *
 * Returns an array of BlobDescriptors sorted by upload date descending.
 */
export async function handleBlobList(
  request: Request,
  url: URL,
  storage: StorageClient,
  config: Config,
): Promise<Response> {
  const pubkey = url.pathname.split("/list/")[1];
  if (!pubkey || !isValidPubkey(pubkey)) {
    return errorResponse("Invalid pubkey", 400);
  }

  const cursor = url.searchParams.get("cursor");
  const sinceStr = url.searchParams.get("since");
  const untilStr = url.searchParams.get("until");
  const limitStr = url.searchParams.get("limit");
  const limit = Math.min(Math.max(parseInt(limitStr || "100", 10) || 100, 1), 1000);

  let entries = await getIndex(storage, pubkey);

  // Filter by time range
  if (sinceStr) {
    const since = parseInt(sinceStr, 10);
    if (!isNaN(since)) entries = entries.filter((e) => e.uploaded >= since);
  }
  if (untilStr) {
    const until = parseInt(untilStr, 10);
    if (!isNaN(until)) entries = entries.filter((e) => e.uploaded <= until);
  }

  // Sort by uploaded ascending (oldest first)
  entries.sort((a, b) => a.uploaded - b.uploaded);

  // Cursor-based pagination: find the cursor entry and skip past it
  if (cursor) {
    const cursorIdx = entries.findIndex((e) => e.sha256 === cursor);
    if (cursorIdx >= 0) {
      entries = entries.slice(cursorIdx + 1);
    }
  }

  // Apply limit
  const paginated = entries.slice(0, limit);

  // Convert to BlobDescriptors
  const descriptors: BlobDescriptor[] = paginated.map((e) => ({
    url: storage.blobUrl(e.sha256),
    sha256: e.sha256,
    size: e.size,
    type: e.type,
    uploaded: e.uploaded,
  }));

  return jsonResponse(descriptors);
}
