import type { Config, NostrEvent } from "../types.ts";
import type { StorageClient } from "../storage/client.ts";
import { addReport } from "../storage/metadata.ts";
import { computeEventId, verifySignature } from "../auth/schnorr.ts";
import { errorResponse, isValidSha256, jsonResponse } from "../util.ts";

/**
 * BUD-09: PUT /report — Report content
 *
 * Accepts a NIP-56 (kind 1984) moderation event.
 * The event must reference a blob hash via an `x` tag.
 * Validates the event signature and stores the report.
 */
export async function handleReport(
  request: Request,
  storage: StorageClient,
  _config: Config,
): Promise<Response> {
  // Parse request body as a Nostr event
  let event: NostrEvent;
  try {
    event = await request.json();
  } catch {
    return errorResponse("Invalid JSON body", 400);
  }

  // Validate kind 1984
  if (event.kind !== 1984) {
    return errorResponse("Expected kind 1984 (moderation/report) event", 400);
  }

  // Find the x tag referencing a blob hash
  const xTag = event.tags.find((t) => t[0] === "x");
  if (!xTag || !xTag[1]) {
    return errorResponse("Missing 'x' tag with blob hash", 400);
  }
  const sha256 = xTag[1];

  if (!isValidSha256(sha256)) {
    return errorResponse("Invalid SHA-256 hash in 'x' tag", 400);
  }

  // Verify event ID
  const computedId = computeEventId(event);
  if (computedId !== event.id) {
    return errorResponse("Invalid event ID", 400);
  }

  // Verify schnorr signature
  const sigValid = verifySignature(event);
  if (!sigValid) {
    return errorResponse("Invalid signature", 400);
  }

  // Store report (even if blob doesn't exist — report can pre-date upload)
  await addReport(storage, sha256, event);

  return jsonResponse({ message: "Report received" });
}
