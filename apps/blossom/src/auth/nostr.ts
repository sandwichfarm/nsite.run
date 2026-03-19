import type { AuthResult, NostrEvent } from "../types.ts";
import { fromBase64 } from "../util.ts";
import { computeEventId, verifySignature } from "./schnorr.ts";

/** Extract and validate a Nostr auth event from the Authorization header.
 *
 * Validates:
 * - kind = 24242
 * - created_at is within ±120s of server time
 * - expiration tag is in the future (if present)
 * - `t` tag matches expected verb (get, upload, delete, list, media, mirror)
 * - `x` tag is present and matches expected hash (if sha256 option provided)
 * - `server` tag matches expected server URL (if provided)
 * - Event ID matches SHA-256 of serialized event
 * - Schnorr signature is valid
 */
export async function validateAuth(
  request: Request,
  options: {
    verb: string;
    sha256?: string;
    serverUrl?: string;
  },
): Promise<AuthResult> {
  const authHeader = request.headers.get("Authorization");
  if (!authHeader) {
    return { authorized: false, error: "Missing Authorization header" };
  }

  const match = authHeader.match(/^Nostr\s+(.+)$/i);
  if (!match) {
    return { authorized: false, error: "Invalid Authorization header format" };
  }

  let event: NostrEvent;
  try {
    const decoded = fromBase64(match[1]);
    event = JSON.parse(new TextDecoder().decode(decoded));
  } catch {
    return { authorized: false, error: "Invalid base64 or JSON in Authorization header" };
  }

  // Validate kind
  if (event.kind !== 24242) {
    return { authorized: false, error: `Invalid event kind: ${event.kind}, expected 24242` };
  }

  const now = Math.floor(Date.now() / 1000);

  // Validate created_at: must be within ±120s of server time
  if (event.created_at > now + 120) {
    return { authorized: false, error: "Event created_at is in the future" };
  }
  if (event.created_at < now - 120) {
    return { authorized: false, error: "Event created_at is too old (outside 120s window)" };
  }

  // Validate expiration (if tag is present)
  const expirationTag = event.tags.find((t) => t[0] === "expiration");
  if (expirationTag) {
    const expiration = parseInt(expirationTag[1], 10);
    if (expiration < now) {
      return { authorized: false, error: "Auth event has expired" };
    }
  }

  // Validate `t` tag (verb)
  const tTag = event.tags.find((t) => t[0] === "t");
  if (!tTag) {
    return { authorized: false, error: "Missing 't' (verb) tag" };
  }
  if (tTag[1] !== options.verb) {
    return { authorized: false, error: `Invalid verb: ${tTag[1]}, expected ${options.verb}` };
  }

  // Validate `x` tag (hash) if expected
  if (options.sha256) {
    const xTag = event.tags.find((t) => t[0] === "x");
    if (!xTag) {
      return { authorized: false, error: "Missing 'x' (hash) tag" };
    }
    if (xTag[1] !== options.sha256) {
      return { authorized: false, error: "Hash mismatch in 'x' tag" };
    }
  }

  // Validate `server` tag if provided
  if (options.serverUrl) {
    const serverTag = event.tags.find((t) => t[0] === "server");
    if (serverTag) {
      // Normalize: strip trailing slash
      const eventServer = serverTag[1].replace(/\/+$/, "");
      const expectedServer = options.serverUrl.replace(/\/+$/, "");
      if (eventServer !== expectedServer) {
        return { authorized: false, error: "Server URL mismatch" };
      }
    }
  }

  // Verify event ID
  const computedId = computeEventId(event);
  if (computedId !== event.id) {
    return { authorized: false, error: "Invalid event ID" };
  }

  // Verify schnorr signature
  const sigValid = verifySignature(event);
  if (!sigValid) {
    return { authorized: false, error: "Invalid signature" };
  }

  return { authorized: true, pubkey: event.pubkey, event };
}
