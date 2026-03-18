import { ALLOWED_KINDS } from "./constants.ts";
import type { NostrEvent, ValidationResult } from "./types.ts";

/**
 * Returns true if the given kind is in the list of allowed nsite event kinds.
 */
export function isAllowedKind(kind: number): boolean {
  return (ALLOWED_KINDS as readonly number[]).includes(kind);
}

/**
 * Validates that a Nostr event has an allowed kind.
 * Returns `{ valid: true }` or `{ valid: false, reason: "..." }`.
 */
export function validateEventKind(event: NostrEvent): ValidationResult {
  if (isAllowedKind(event.kind)) {
    return { valid: true };
  }
  return {
    valid: false,
    reason: `Kind ${event.kind} is not allowed. Allowed kinds: ${ALLOWED_KINDS.join(", ")}`,
  };
}
